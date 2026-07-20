import pg from "pg";

const connectionString = process.env.DATABASE_URL || "postgres://wafex:wafex@127.0.0.1:5432/wafex";

// Railway's public proxy (…proxy.rlwy.net) requires SSL; the internal host does not.
const needsSSL =
  process.env.PGSSLMODE === "require" ||
  /proxy\.rlwy\.net|amazonaws|render|neon|supabase/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      banner        TEXT NOT NULL,
      suburb        TEXT NOT NULL,
      bc_customer_no TEXT NOT NULL UNIQUE,
      contact       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalogue (
      sku         TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      unit_cost   NUMERIC(10,2) NOT NULL,
      unit_price  NUMERIC(10,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merchandisers (
      id   SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id            SERIAL PRIMARY KEY,
      store_id      INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      order_no      TEXT NOT NULL UNIQUE,
      delivery_date DATE NOT NULL,
      status        TEXT NOT NULL DEFAULT 'Open',
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS order_lines (
      id         SERIAL PRIMARY KEY,
      order_id   INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      sku        TEXT NOT NULL REFERENCES catalogue(sku),
      qty        INT NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id         SERIAL PRIMARY KEY,
      mime       TEXT NOT NULL,
      bytes      BYTEA NOT NULL,
      caption    TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS visits (
      id           SERIAL PRIMARY KEY,
      store_id     INT NOT NULL REFERENCES stores(id),
      merchandiser TEXT NOT NULL,
      visit_date   DATE NOT NULL,
      time_in      TEXT NOT NULL,
      time_out     TEXT NOT NULL,
      condition    TEXT NOT NULL,
      notes        TEXT NOT NULL,
      concerns     TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS visit_photos (
      visit_id INT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
      photo_id INT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      PRIMARY KEY (visit_id, photo_id)
    );

    CREATE TABLE IF NOT EXISTS credits (
      id             SERIAL PRIMARY KEY,
      visit_id       INT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
      sku            TEXT NOT NULL REFERENCES catalogue(sku),
      qty            INT NOT NULL,
      unit_cost      NUMERIC(10,2) NOT NULL,
      reason         TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      bc_credit_memo TEXT,
      decided_by     TEXT,
      decided_at     TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS credit_photos (
      credit_id INT NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
      photo_id  INT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      PRIMARY KEY (credit_id, photo_id)
    );

    -- Synthetic Business Central sync log; the real integration replaces this module.
    CREATE TABLE IF NOT EXISTS bc_sync_log (
      id          SERIAL PRIMARY KEY,
      direction   TEXT NOT NULL,          -- outbound | inbound
      doc_type    TEXT NOT NULL,          -- credit_memo | sales_order
      doc_no      TEXT,
      payload     JSONB,
      status      TEXT NOT NULL,          -- posted | received | failed
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE SEQUENCE IF NOT EXISTS bc_credit_memo_seq START 872;
    CREATE INDEX IF NOT EXISTS idx_visits_date ON visits (visit_date DESC);
    CREATE INDEX IF NOT EXISTS idx_credits_status ON credits (status);
    CREATE INDEX IF NOT EXISTS idx_orders_delivery ON sales_orders (delivery_date);
  `);
}
