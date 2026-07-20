import express from "express";
import multer from "multer";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, migrate } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { postCreditMemo, refreshSalesOrders, lastSync } from "./bc.js";
import { authConfigured, authRouter, permissionsFor, requireAuth, requireRole, ROLES, sessionMiddleware } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(compression());
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const asyncH = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Railway terminates TLS at its proxy; needed for secure cookies.
app.set("trust proxy", 1);

// Public healthcheck (Railway probes this without a session).
app.get("/api/health", asyncH(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, auth: authConfigured ? "entra" : "demo" });
}));

app.use(sessionMiddleware());
app.use(authRouter());
if (!authConfigured)
  console.warn("Microsoft Entra SSO not configured (AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET). Running in open demo mode.");

// Everything under /api past this point requires a signed-in user.
app.use("/api", requireAuth);

app.get("/api/me", (req, res) => {
  res.json({
    user: { name: req.user.name, email: req.user.email, roles: req.user.roles, demo: !!req.user.demo },
    authConfigured,
    permissions: permissionsFor(req.user),
  });
});

// ---------- Reference data ----------

app.get("/api/bootstrap", asyncH(async (_req, res) => {
  const [stores, catalogue, merch, sync] = await Promise.all([
    pool.query(`SELECT id, name, banner, suburb, bc_customer_no AS "bcCustomerNo", contact FROM stores ORDER BY name`),
    pool.query(`SELECT sku, description, unit_cost::float AS "unitCost", unit_price::float AS "unitPrice" FROM catalogue ORDER BY sku`),
    pool.query(`SELECT name FROM merchandisers ORDER BY name`),
    lastSync(),
  ]);
  res.json({
    stores: stores.rows,
    catalogue: catalogue.rows,
    merchandisers: merch.rows.map((r) => r.name),
    reasons: [
      "Waste — past best before",
      "Quality — wilted / drooping heads",
      "Damaged in transit",
      "Short delivery",
      "Water damage on sleeve",
    ],
    bcLastSync: sync,
  });
}));

// ---------- Photos ----------

app.get("/api/photos/:id", asyncH(async (req, res) => {
  const { rows } = await pool.query(`SELECT mime, bytes FROM photos WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).end();
  res.set("Content-Type", rows[0].mime);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(rows[0].bytes);
}));

// ---------- Visits ----------

const photoUrl = (id) => `/api/photos/${id}`;

async function loadVisits(where = "", params = []) {
  const visits = (
    await pool.query(
      `SELECT v.id, v.store_id AS "storeId", v.merchandiser,
              to_char(v.visit_date, 'YYYY-MM-DD') AS date,
              v.time_in AS "timeIn", v.time_out AS "timeOut",
              v.condition, v.notes, v.concerns, v.created_at AS "createdAt"
       FROM visits v ${where}
       ORDER BY v.visit_date DESC, v.created_at DESC`,
      params
    )
  ).rows;
  if (visits.length === 0) return [];
  const ids = visits.map((v) => v.id);

  const [vp, credits, cp] = await Promise.all([
    pool.query(
      `SELECT vp.visit_id, p.id, p.caption FROM visit_photos vp JOIN photos p ON p.id = vp.photo_id
       WHERE vp.visit_id = ANY($1) ORDER BY p.id`,
      [ids]
    ),
    pool.query(
      `SELECT c.id, c.visit_id AS "visitId", c.sku, cat.description, c.qty,
              c.unit_cost::float AS "unitCost", c.reason, c.status,
              c.bc_credit_memo AS "bcCreditMemo", c.decided_by AS "decidedBy", c.decided_at AS "decidedAt"
       FROM credits c JOIN catalogue cat ON cat.sku = c.sku
       WHERE c.visit_id = ANY($1) ORDER BY c.id`,
      [ids]
    ),
    pool.query(
      `SELECT cp.credit_id, p.id, p.caption FROM credit_photos cp JOIN photos p ON p.id = cp.photo_id
       WHERE cp.credit_id IN (SELECT id FROM credits WHERE visit_id = ANY($1)) ORDER BY p.id`,
      [ids]
    ),
  ]);

  const photosByVisit = {};
  for (const r of vp.rows)
    (photosByVisit[r.visit_id] ??= []).push({ id: r.id, src: photoUrl(r.id), caption: r.caption });
  const photosByCredit = {};
  for (const r of cp.rows)
    (photosByCredit[r.credit_id] ??= []).push({ id: r.id, src: photoUrl(r.id), caption: r.caption });
  const creditsByVisit = {};
  for (const c of credits.rows)
    (creditsByVisit[c.visitId] ??= []).push({ ...c, photos: photosByCredit[c.id] ?? [] });

  return visits.map((v) => ({
    ...v,
    displayPhotos: photosByVisit[v.id] ?? [],
    credits: creditsByVisit[v.id] ?? [],
  }));
}

app.get("/api/visits", asyncH(async (_req, res) => {
  res.json(await loadVisits());
}));

// Create a visit. multipart/form-data:
//   payload            JSON string (visit fields + credit lines)
//   display[]          image files for the display
//   credit_<idx>[]     image files per credit line (idx matches payload.credits order)
app.post("/api/visits", upload.any(), asyncH(async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(req.body.payload ?? "{}");
  } catch {
    return res.status(400).json({ error: "payload must be valid JSON" });
  }
  const { storeId, date, timeIn, timeOut, condition, notes, concerns, credits = [] } = payload;
  const merchandiser = req.user.name; // identity comes from SSO, not the client
  if (!storeId || !date || !timeIn || !timeOut || !condition || !notes?.trim())
    return res.status(400).json({ error: "Missing required visit fields" });
  if (!["Excellent", "Good", "Needs attention"].includes(condition))
    return res.status(400).json({ error: "Invalid condition" });

  const files = req.files ?? [];
  const displayFiles = files.filter((f) => f.fieldname === "display");
  if (displayFiles.length === 0)
    return res.status(400).json({ error: "At least one display photo is required" });
  for (let i = 0; i < credits.length; i++) {
    if (!files.some((f) => f.fieldname === `credit_${i}`))
      return res.status(400).json({ error: `Credit line ${i + 1} needs at least one photo` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const v = await client.query(
      `INSERT INTO visits (store_id, merchandiser, visit_date, time_in, time_out, condition, notes, concerns)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [storeId, merchandiser, date, timeIn, timeOut, condition, notes.trim(), concerns?.trim() || null]
    );
    const visitId = v.rows[0].id;

    const savePhoto = async (file, caption) => {
      const r = await client.query(
        `INSERT INTO photos (mime, bytes, caption) VALUES ($1,$2,$3) RETURNING id`,
        [file.mimetype, file.buffer, caption ?? null]
      );
      return r.rows[0].id;
    };

    for (const f of displayFiles) {
      const pid = await savePhoto(f, f.originalname);
      await client.query(`INSERT INTO visit_photos (visit_id, photo_id) VALUES ($1,$2)`, [visitId, pid]);
    }

    for (let i = 0; i < credits.length; i++) {
      const c = credits[i];
      const item = await client.query(`SELECT unit_cost::float AS cost FROM catalogue WHERE sku = $1`, [c.sku]);
      if (!item.rows[0]) throw Object.assign(new Error(`Unknown SKU ${c.sku}`), { status: 400 });
      const qty = Math.max(1, parseInt(c.qty, 10) || 1);
      const cr = await client.query(
        `INSERT INTO credits (visit_id, sku, qty, unit_cost, reason) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [visitId, c.sku, qty, item.rows[0].cost, String(c.reason ?? "Waste — past best before")]
      );
      for (const f of files.filter((x) => x.fieldname === `credit_${i}`)) {
        const pid = await savePhoto(f, f.originalname);
        await client.query(`INSERT INTO credit_photos (credit_id, photo_id) VALUES ($1,$2)`, [cr.rows[0].id, pid]);
      }
    }

    await client.query("COMMIT");
    const [created] = await loadVisits("WHERE v.id = $1", [visitId]);
    res.status(201).json(created);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

// ---------- Credits ----------

app.post("/api/credits/:id/decision", requireRole(ROLES.BOUQUET), asyncH(async (req, res) => {
  const { decision } = req.body ?? {};
  if (!["approved", "rejected"].includes(decision))
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });

  const { rows } = await pool.query(
    `SELECT c.*, s.bc_customer_no AS customer_no
     FROM credits c JOIN visits v ON v.id = c.visit_id JOIN stores s ON s.id = v.store_id
     WHERE c.id = $1`,
    [req.params.id]
  );
  const credit = rows[0];
  if (!credit) return res.status(404).json({ error: "Credit not found" });
  if (credit.status !== "pending")
    return res.status(409).json({ error: `Credit already ${credit.status}` });

  let memo = null;
  if (decision === "approved") {
    memo = await postCreditMemo({
      creditId: credit.id,
      customerNo: credit.customer_no,
      sku: credit.sku,
      qty: credit.qty,
      unitCost: Number(credit.unit_cost),
      reason: credit.reason,
    });
  }

  const updated = await pool.query(
    `UPDATE credits SET status = $1, bc_credit_memo = $2, decided_by = $3, decided_at = now()
     WHERE id = $4
     RETURNING id, status, bc_credit_memo AS "bcCreditMemo", decided_by AS "decidedBy", decided_at AS "decidedAt"`,
    [decision, memo, req.user.name, req.params.id]
  );
  res.json(updated.rows[0]);
}));

// ---------- Orders ----------

app.get("/api/orders", asyncH(async (_req, res) => {
  const stores = (
    await pool.query(
      `SELECT id, name, banner, suburb, bc_customer_no AS "bcCustomerNo", contact FROM stores ORDER BY name`
    )
  ).rows;
  const orders = (
    await pool.query(
      `SELECT o.id, o.store_id AS "storeId", o.order_no AS "orderNo",
              to_char(o.delivery_date, 'YYYY-MM-DD') AS "deliveryDate", o.status, o.synced_at AS "syncedAt"
       FROM sales_orders o
       WHERE o.delivery_date >= CURRENT_DATE
       ORDER BY o.delivery_date`
    )
  ).rows;
  const lines = (
    await pool.query(
      `SELECT l.order_id AS "orderId", l.sku, c.description, l.qty, l.unit_price::float AS "unitPrice"
       FROM order_lines l JOIN catalogue c ON c.sku = l.sku ORDER BY l.id`
    )
  ).rows;
  const linesByOrder = {};
  for (const l of lines) (linesByOrder[l.orderId] ??= []).push(l);
  res.json(
    stores.map((s) => ({
      ...s,
      orders: orders
        .filter((o) => o.storeId === s.id)
        .map((o) => ({ ...o, lines: linesByOrder[o.id] ?? [] })),
    }))
  );
}));

// ---------- Synthetic BC sync ----------

app.post("/api/bc/refresh-orders", asyncH(async (_req, res) => {
  res.json(await refreshSalesOrders());
}));

app.get("/api/bc/log", asyncH(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, direction, doc_type AS "docType", doc_no AS "docNo", status, created_at AS "createdAt"
     FROM bc_sync_log ORDER BY id DESC LIMIT 50`
  );
  res.json(rows);
}));

// ---------- Static client ----------

const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist, { maxAge: "1h", index: "index.html" }));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

// ---------- Errors ----------

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : "Something went wrong on the server" });
});

const port = process.env.PORT || 3000;
await migrate();
await seedIfEmpty();
app.listen(port, "0.0.0.0", () => console.log(`Wafex portal listening on :${port}`));
