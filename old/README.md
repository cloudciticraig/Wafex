# Wafex Merchandising & Credits Portal

A full-stack web app for the Wafex bouquet team and field merchandisers.

- **Merchandisers** log store visits from a tablet: photos of the displays (camera opens directly on Android/iPad), display condition, visit notes, anything raised with the in-store team, and credit requests with photos of the product being written off.
- **The bouquet team** reviews visits, approves or rejects credits (approvals generate a credit memo and post it to the Business Central sync layer), and sees upcoming sales orders per store — one Business Central customer per store, one sales order per delivery date.
- Works on a desktop/laptop on a big screen (sidebar layout) and on tablets (top navigation, touch-sized controls) — just visit the URL.

## Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| Backend   | Node.js 20+ / Express |
| Auth      | Microsoft Entra ID (OIDC auth-code + PKCE via MSAL), sessions in Postgres |
| Database  | PostgreSQL (photos stored in the DB as `bytea` — no external object storage needed) |
| BC sync   | Synthetic for now — isolated in `server/bc.js`, swap its internals for the real Business Central API calls |

Everything is served from one process: Express hosts the REST API under `/api/*` and the built React app for every other route.

## Deploy on Railway

1. Push this folder to a GitHub repo (or use `railway up` from the CLI).
2. In Railway: **New Project → Deploy from GitHub repo** and pick the repo.
3. In the same project: **Create → Database → PostgreSQL.**
4. On the app service → **Variables → Add Variable Reference** → select the Postgres service's `DATABASE_URL`. (Use the internal `postgres.railway.internal` URL — no SSL config needed. If you point at the public `proxy.rlwy.net` URL instead, also set `PGSSLMODE=require`.)
5. Deploy. On first boot the app creates the schema and seeds it with synthetic Business Central data (stores, catalogue, sales orders, sample visits). Seeding only runs when the `stores` table is empty, so redeploys never duplicate data.
6. Settings → **Networking → Generate Domain** to get the public URL. Open it on the big screen and on the tablets.

`railway.json` already sets the build (`npm run build`), start (`npm start`), and a healthcheck on `/api/health`.

## Microsoft Entra ID SSO

Until the variables below are set, the app runs in **open demo mode** (a banner is shown and everyone acts as a full-access demo user). To require sign-in:

1. **Entra admin centre → App registrations → New registration.**
   - Name: `Wafex Merchandising Portal`; single tenant.
   - Redirect URI (Web): `https://<your-railway-domain>/auth/callback` (add `http://localhost:3000/auth/callback` too for local dev).
2. **Certificates & secrets → New client secret** — copy the value.
3. **App roles → Create app role**, twice:
   - Display name `Bouquet team`, value `BouquetTeam`, allowed member types Users/Groups.
   - Display name `Merchandiser`, value `Merchandiser`, allowed member types Users/Groups.
4. **Enterprise applications → Wafex Merchandising Portal → Users and groups** — assign people (or groups) to the two roles.
5. On the Railway app service, set the variables: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `APP_BASE_URL` (the public Railway URL), and `SESSION_SECRET` (any long random string). Redeploy.

Behaviour:

- Every `/api/*` route (except the healthcheck) requires a signed-in session; unauthenticated visitors get the branded sign-in screen.
- The merchandiser recorded on a visit and the approver recorded on a credit come from the signed-in identity — the client cannot spoof them.
- Approving/rejecting credits requires the `BouquetTeam` role (server-enforced 403 + read-only queue in the UI).
- Users whose token carries **no** roles get full access by default so you can roll out SSO before configuring roles; set `REQUIRE_ROLES=true` to turn that off.
- Sessions live in the Postgres `session` table (created automatically), survive restarts, and last 8 hours; sign-out also signs out of Entra.

The MSAL client in `server/auth.js` is the same foundation the Business Central integration will use — BC API calls need an Entra token from this same tenant, so step 1's app registration can be extended with BC API permissions next.

## Run locally

```bash
# Needs a local Postgres, e.g.: createdb wafex
export DATABASE_URL=postgres://user:pass@localhost:5432/wafex

npm install
npm run build     # installs client deps and builds the frontend
npm start         # serves app + API on http://localhost:3000
```

For frontend development with hot reload: `node server/index.js` in one terminal, `npm --prefix client run dev` in another (Vite proxies `/api` to :3000).

## API

| Method & path | Purpose |
|---|---|
| `GET /api/bootstrap` | Stores, catalogue, merchandisers, credit reasons, last BC sync |
| `GET /api/visits` | All visits with photos and credit lines |
| `POST /api/visits` | Create a visit — `multipart/form-data`: `payload` (JSON), `display` files, `credit_<n>` files per credit line. Validates that the display and every credit line have at least one photo |
| `GET /api/photos/:id` | Serves a stored photo (immutable cache headers) |
| `POST /api/credits/:id/decision` | `{ "decision": "approved" \| "rejected" }` — approval posts a credit memo through the BC sync layer; deciding twice returns 409 |
| `GET /api/orders` | Stores with their upcoming sales orders and lines |
| `POST /api/bc/refresh-orders` | Synthetic inbound order refresh |
| `GET /api/bc/log` | Recent BC sync activity |
| `GET /api/health` | Healthcheck (used by Railway) |

## Swapping in the real Business Central integration

All BC touchpoints live in `server/bc.js`:

- `postCreditMemo(...)` — currently generates `CM-xxxxxx` from a DB sequence and writes to `bc_sync_log`. Replace with an OAuth client-credentials call to `POST /companies({id})/salesCreditMemos` (+ lines, + post action), keeping the same return value (the memo number).
- `refreshSalesOrders()` — currently touches `synced_at`. Replace with a pull from `GET /companies({id})/salesOrders?$expand=salesOrderLines` upserting into `sales_orders` / `order_lines`.

The `bc_sync_log` table is already in place for auditing both directions.

## Notes for production hardening

- Add authentication (e.g. Microsoft Entra ID SSO, since you're already in the Microsoft stack) and role separation (merchandiser vs bouquet team).
- Photos are downscaled client-side to ≤1600px before upload and capped at 8 MB server-side. If photo volume grows large, move `photos.bytes` to object storage (Railway volume or S3-compatible) — only `server/index.js` photo handlers change.
- Consider a nightly BC reconciliation job once the real sync is in.
