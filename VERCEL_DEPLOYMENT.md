# Deploy Home-Treding / NIFTY 009

Vercel hosts the React dashboard and an authenticated API gateway. The existing Node engine runs continuously on your own computer or another persistent host, with its SQLite data directory retained. Vercel Functions do not guarantee persistent local filesystem storage: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel. The gateway never starts a second trading engine or stores broker credentials in Vercel.

## 1. Persistent engine

Use Node 22.18+ and run `npm ci`, `npm run build`, then `npm start` from this repository. Default local operation is unchanged: http://127.0.0.1:4310. Stop the old engine before using the same data directory with this copy; a lock prevents two engines owning it.

For remote access, configure process environment variables:

- `N009_GATEWAY_SECRET`: your random secret, at least 32 characters. Generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it private.
- `N009_DATA_DIR`: an absolute persistent directory for SQLite and the encryption key. Existing local account data may be reused locally; never commit or upload it to GitHub.
- `N009_HOST`: keep `127.0.0.1` when an HTTPS tunnel forwards to localhost. Use `0.0.0.0` only when your engine host requires it; the app then requires the gateway secret. The same secret is required on every engine request, including localhost requests while remote mode is configured.
- `PORT`: defaults to `4310`.

Environment variables must be set in the process manager or shell before `npm start`; the app does not automatically read `.env`. A free HTTPS tunnel to your own running computer can supply an engine URL; the computer and tunnel must remain running. This repository does not require a paid data subscription or hosting plan. Check the quotas of the hosting/tunnel services you choose.

## 2. Vercel project

Import `satvik8373/Home-Treding`, branch `main`. Set **Root Directory** to the repository root (empty / `.`), replacing any old `frontend` root override. Remove old build/output overrides so `vercel.json` supplies them:

- Framework: Vite
- Install: `npm ci`
- Build: `npm run build:vercel`
- Output: `dist`
- Node: 22.x

Set these server-side environment variables for each deployment environment you use:

- `N009_ENGINE_ORIGIN`: the HTTPS origin of your persistent engine, without a path or query.
- `N009_GATEWAY_SECRET`: exactly the engine's secret.
- `N009_DASHBOARD_PASSWORD`: your separate private dashboard password, at least 24 characters.

Do not prefix any of these values with `VITE_`. Do not put them in GitHub. Redeploy after setting them. No real secrets are shipped in `.env.example`.

The website shows **Connect your trading engine** until configuration exists, then requests the dashboard password. The access cookie is signed, HttpOnly, Secure and SameSite=Strict. Use **Lock dashboard** to clear it; rotating the gateway secret revokes existing access cookies. Account tokens and live order state remain encrypted in the persistent engine's SQLite directory.

## 3. Verify

Unlock the dashboard, connect mStock, run read-only broker diagnostics, and test paper mode/backtesting. Confirm displayed timestamps and segment permissions. Building/deploying this repository does not verify a live order or actual broker fill.

The API gateway streams events for bounded requests and reconnects; dashboard polling also refreshes state. The broker WebSocket, strategy loop and historical/backtest jobs continue on the persistent engine independently of the browser and Vercel request lifetime. If the engine is unavailable, the dashboard reports a connection issue and does not synthesize prices or fills.

`npm test` covers engine authorization, dashboard login, cross-site rejection, cookie tampering, header filtering, CSRF preservation, and sanitized connection errors. `npm run build:vercel` builds the deployable dashboard and type-checks the gateway.
