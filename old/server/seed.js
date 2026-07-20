import { pool } from "./db.js";
import { seedPhotoSVG } from "./svgPhotos.js";

const CATALOGUE = [
  ["BQ-1001", "Seasonal Mixed Bouquet — Large", 11.4, 16.5],
  ["BQ-1002", "Seasonal Mixed Bouquet — Petite", 6.9, 10.0],
  ["BQ-2004", "Waxflower Market Bunch", 4.8, 8.0],
  ["BQ-2101", "Reflexed Chrysanthemum Bunch", 5.6, 9.0],
  ["BQ-3110", "Rose 10-Stem — Blush", 8.2, 13.0],
  ["BQ-4020", "WA Native Mix — Banksia & Kangaroo Paw", 9.7, 15.0],
  ["BQ-5008", "Oriental Lily 3-Stem", 7.1, 12.0],
];

const MERCHANDISERS = ["Tegan Marsh", "Lucas Nguyen", "Priya Raman", "Sam Whitfield"];

const STORES = [
  ["Woolworths Karrinyup", "Woolworths", "Karrinyup", "C01015", "Fresh Manager — Dana K."],
  ["Coles Claremont", "Coles", "Claremont", "C01022", "Fresh Manager — Marco T."],
  ["IGA Subiaco", "IGA", "Subiaco", "C01031", "Store Owner — Helen P."],
  ["Farmer Jack's Mosman Park", "Farmer Jack's", "Mosman Park", "C01044", "Grocery Lead — Aaron V."],
  ["Woolworths Innaloo", "Woolworths", "Innaloo", "C01016", "Fresh Manager — Ruth O."],
];

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function insertPhoto(client, kind, seed, caption) {
  const svg = seedPhotoSVG(kind, seed);
  const { rows } = await client.query(
    `INSERT INTO photos (mime, bytes, caption) VALUES ('image/svg+xml', $1, $2) RETURNING id`,
    [Buffer.from(svg, "utf8"), caption ?? null]
  );
  return rows[0].id;
}

export async function seedIfEmpty() {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM stores`);
  if (rows[0].n > 0) return false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [sku, description, cost, price] of CATALOGUE)
      await client.query(
        `INSERT INTO catalogue (sku, description, unit_cost, unit_price) VALUES ($1,$2,$3,$4)`,
        [sku, description, cost, price]
      );

    for (const m of MERCHANDISERS)
      await client.query(`INSERT INTO merchandisers (name) VALUES ($1)`, [m]);

    const storeIds = [];
    for (const [name, banner, suburb, cust, contact] of STORES) {
      const r = await client.query(
        `INSERT INTO stores (name, banner, suburb, bc_customer_no, contact) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [name, banner, suburb, cust, contact]
      );
      storeIds.push(r.rows[0].id);
    }

    // Synthetic BC sales orders: one order per delivery date per store.
    let orderSeq = 102384;
    const order = async (storeIdx, dayOffset, status, lines) => {
      const r = await client.query(
        `INSERT INTO sales_orders (store_id, order_no, delivery_date, status) VALUES ($1,$2,$3,$4) RETURNING id`,
        [storeIds[storeIdx], `SO-${orderSeq++}`, day(dayOffset), status]
      );
      for (const [sku, qty] of lines) {
        const price = CATALOGUE.find((c) => c[0] === sku)[3];
        await client.query(
          `INSERT INTO order_lines (order_id, sku, qty, unit_price) VALUES ($1,$2,$3,$4)`,
          [r.rows[0].id, sku, qty, price]
        );
      }
    };

    await order(0, 1, "Released", [["BQ-1001", 24], ["BQ-2004", 30], ["BQ-3110", 18]]);
    await order(0, 4, "Open", [["BQ-1001", 24], ["BQ-1002", 20], ["BQ-4020", 12]]);
    await order(0, 8, "Open", [["BQ-1001", 28], ["BQ-5008", 16]]);
    await order(1, 1, "Released", [["BQ-1002", 20], ["BQ-2101", 24]]);
    await order(1, 5, "Open", [["BQ-1001", 18], ["BQ-2004", 24], ["BQ-3110", 12]]);
    await order(2, 2, "Released", [["BQ-4020", 10], ["BQ-1002", 14]]);
    await order(2, 7, "Open", [["BQ-2101", 16], ["BQ-5008", 8]]);
    await order(3, 3, "Open", [["BQ-1001", 12], ["BQ-2004", 18]]);
    await order(4, 1, "Released", [["BQ-1001", 22], ["BQ-3110", 14], ["BQ-5008", 10]]);
    await order(4, 6, "Open", [["BQ-1001", 22], ["BQ-2101", 20]]);

    // Sample visits with photos + credits so the app isn't empty on first deploy.
    const visit = async (storeIdx, merch, dayOffset, tin, tout, condition, notes, concerns, photoSpecs, creditSpecs) => {
      const r = await client.query(
        `INSERT INTO visits (store_id, merchandiser, visit_date, time_in, time_out, condition, notes, concerns)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [storeIds[storeIdx], merch, day(dayOffset), tin, tout, condition, notes, concerns]
      );
      const visitId = r.rows[0].id;
      for (const [seed, caption] of photoSpecs) {
        const pid = await insertPhoto(client, "display", seed, caption);
        await client.query(`INSERT INTO visit_photos (visit_id, photo_id) VALUES ($1,$2)`, [visitId, pid]);
      }
      for (const c of creditSpecs) {
        const item = CATALOGUE.find((x) => x[0] === c.sku);
        const cr = await client.query(
          `INSERT INTO credits (visit_id, sku, qty, unit_cost, reason, status, bc_credit_memo, decided_by, decided_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [visitId, c.sku, c.qty, item[2], c.reason, c.status ?? "pending", c.memo ?? null, c.by ?? null, c.at ?? null]
        );
        for (const s of c.photoSeeds) {
          const pid = await insertPhoto(client, "waste", s, null);
          await client.query(`INSERT INTO credit_photos (credit_id, photo_id) VALUES ($1,$2)`, [cr.rows[0].id, pid]);
        }
      }
    };

    await visit(0, "Tegan Marsh", 0, "07:40", "08:25", "Good",
      "Rotated stock, topped up water in all buckets and re-faced the entrance stand. Sold through well over the weekend — Large Seasonal nearly out before Friday delivery.",
      "Dana asked whether the rose 10-stem can move to the entrance stand permanently — selling faster there. Flagged for account manager.",
      [[1, "Main floral stand — entrance"], [2, "Secondary bucket display — produce"], [3, "Rose feature end"]],
      [
        { sku: "BQ-2101", qty: 3, reason: "Quality — wilted / drooping heads", photoSeeds: [11, 14] },
        { sku: "BQ-1001", qty: 2, reason: "Waste — past best before", photoSeeds: [12, 15] },
      ]);

    await visit(1, "Lucas Nguyen", 0, "09:10", "09:50", "Excellent",
      "Display in great shape. Re-sleeved a few petite bouquets, removed two spent chrys bunches. Water levels fine.",
      null,
      [[4, "Front-of-store display"], [5, "Chrysanthemum bunches — refreshed"]],
      [{ sku: "BQ-2101", qty: 2, reason: "Waste — past best before", photoSeeds: [13] }]);

    await visit(2, "Priya Raman", -1, "13:05", "13:55", "Needs attention",
      "Aircon vent above the feature table is drying stock quickly. Moved natives to the shaded side and rotated bouquets forward.",
      "Requested store move the floral table one bay across, away from the vent. Helen agreeable — needs a follow-up to confirm it happened.",
      [[6, "Native mix feature table"], [7, "Counter posy unit"]],
      [
        { sku: "BQ-5008", qty: 4, reason: "Quality — wilted / drooping heads", photoSeeds: [16, 17] },
        { sku: "BQ-1002", qty: 3, reason: "Water damage on sleeve", photoSeeds: [18] },
      ]);

    await visit(4, "Sam Whitfield", -1, "07:30", "08:05", "Good",
      "Standard visit. Re-faced, culled two damaged sleeves, water topped up.",
      null,
      [[8, "Main stand after re-face"]],
      [{ sku: "BQ-3110", qty: 2, reason: "Damaged in transit", status: "approved", memo: "CM-000871", by: "J. Whitcombe", at: new Date(Date.now() - 86400000).toISOString(), photoSeeds: [19] }]);

    await visit(3, "Tegan Marsh", -2, "11:20", "11:50", "Excellent",
      "Fast visit — everything fresh from Monday delivery. Aaron happy with sell-through.",
      null,
      [[9, "Bucket display — front"], [10, "Close-up, waxflower"]],
      []);

    await visit(0, "Lucas Nguyen", -3, "08:00", "08:40", "Good",
      "Set the new week's display, merged remaining weekend stock to front row.",
      null,
      [[20, "Entrance stand — Monday set-up"]],
      [
        { sku: "BQ-2004", qty: 5, reason: "Waste — past best before", status: "rejected", by: "J. Whitcombe", at: new Date(Date.now() - 3 * 86400000).toISOString(), photoSeeds: [21] },
        { sku: "BQ-1001", qty: 1, reason: "Damaged in transit", status: "approved", memo: "CM-000868", by: "M. Okafor", at: new Date(Date.now() - 3 * 86400000).toISOString(), photoSeeds: [22] },
      ]);

    await client.query(
      `INSERT INTO bc_sync_log (direction, doc_type, status, payload) VALUES ('inbound','sales_order','received','{"note":"initial synthetic seed"}')`
    );

    await client.query("COMMIT");
    console.log("Seeded database with synthetic Business Central data.");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
