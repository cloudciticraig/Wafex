// Synthetic Business Central integration.
// Replace the internals of these functions with real BC API calls
// (OAuth + /companies({id})/salesCreditMemos etc.) when ready — the rest
// of the app only talks to this module.

import { pool } from "./db.js";

/** Simulate posting a sales credit memo to BC. Returns the memo number. */
export async function postCreditMemo({ creditId, customerNo, sku, qty, unitCost, reason }) {
  const { rows } = await pool.query(`SELECT nextval('bc_credit_memo_seq') AS n`);
  const memoNo = `CM-${String(rows[0].n).padStart(6, "0")}`;
  await pool.query(
    `INSERT INTO bc_sync_log (direction, doc_type, doc_no, payload, status)
     VALUES ('outbound', 'credit_memo', $1, $2, 'posted')`,
    [memoNo, JSON.stringify({ creditId, customerNo, sku, qty, unitCost, reason })]
  );
  return memoNo;
}

/** Simulate an inbound refresh of sales orders from BC (touches synced_at). */
export async function refreshSalesOrders() {
  await pool.query(`UPDATE sales_orders SET synced_at = now()`);
  await pool.query(
    `INSERT INTO bc_sync_log (direction, doc_type, status, payload)
     VALUES ('inbound', 'sales_order', 'received', $1)`,
    [JSON.stringify({ note: "synthetic refresh" })]
  );
  return { syncedAt: new Date().toISOString() };
}

export async function lastSync() {
  const { rows } = await pool.query(
    `SELECT created_at FROM bc_sync_log ORDER BY id DESC LIMIT 1`
  );
  return rows[0]?.created_at ?? null;
}
