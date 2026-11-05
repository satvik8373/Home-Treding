# Deploy Home-Treding / NIFTY 009

Vercel hosts the React dashboard and an authenticated API gateway. There are two execution transports: a Vercel-native hosted **Paper** worker with encrypted PostgreSQL persistence, or the original external persistent engine. Vercel Functions do not guarantee persistent local filesystem storage: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel. The gateway does not itself start a trading loop.

## Vercel-native hosted Paper engine

`vercel.json` includes one `nifty-engine` daemon in `iad1` with 1 GiB memory. It builds the existing Docker image and runs `server/cloud/worker.ts`. Because Vercel Daemons cannot receive inbound HTTP, the authenticated gateway exchanges encrypted, expiring RPC requests with the worker through PostgreSQL. Dashboard state is published by the worker every two seconds; `/api/events` returns 204 and the existing four-second polling is used. The worker's broker WebSocket and strategy loop continue independently of browser requests.

Set these **production server-side secrets** in Vercel before deployment:

- `N009_ENGINE_TRANSPORT=cloud`
- `DATABASE_URL`: a PostgreSQL connection string from a free Neon project. Connections enforce TLS certificate verification.
- `N009_STATE_KEY`: 32 random bytes as 64 hex characters. Keep it stable and private; changing it makes existing encrypted records unreadable.
- `N009_GATEWAY_SECRET`: at least 32 random characters.
- `N009_DASHBOARD_PASSWORD`: at least 24 characters, separate from broker credentials.

This transport does not need `N009_ENGINE_ORIGIN`. Login with the private dashboard password, then connect mStock yourself. Local credentials/history are not migrated automatically. Each deployment is one private workspace; do not share its dashboard password among unrelated traders.

`CloudStore` uses SQLite only as an ephemeral working cache. Durable records and API payloads are authenticated-encrypted with AES-256-GCM in PostgreSQL. Serialized controller operations await the cloud checkpoint before completion. A database lease elects one active worker across rolling deployments; checkpoint/publish writes are fenced by ownership and lease expiry. Expired/unavailable workers cannot appear online: state older than 15 seconds is rejected. Queued commands expire after 24 seconds; claimed requests are not replayed after a crash, and sensitive request payloads are removed when claimed. Queue rows have short TTL cleanup. A timed-out request must be checked before repeating it. Paper sessions recover from the cloud checkpoint using the same controller's current-day recovery rules.

**Hosted Live execution remains disabled in both the controller and broker adapter.** This deployment has no verified stable broker-approved outbound IP. It can connect an account, read real broker/data endpoints, save settings, download available history, backtest and run Paper execution. Read access and Paper fills do not establish live execution. The original locally/external-hosted Live implementation is unchanged. Do not remove this guard as a substitute for qualifying an actual live execution host and its broker IP configuration.

Vercel Hobby and Neon Free have finite runtime, storage and transfer quotas. Vercel stops Hobby daemons when CPU or provisioned-memory quotas are exhausted; a continually running 1 GiB worker can exceed a monthly allowance. Neon can also suspend compute at its free limit. No paid plan is enabled by this configuration, and this deployment must not be represented as an unlimited or guaranteed-uptime live service. Operator monitoring/scaling and free-tier capacity remain necessary. See [Vercel Daemons limits](https://vercel.com/docs/daemons/limits) and [Neon Free limits](https://neon.com/docs/introduction/plans).

Verify `vercel daemons inspect nifty-engine --scope <your-team>`, authenticated `/api/state`, queued settings reads/writes, broker diagnostics and restart recovery. Never test production deployment by placing a real order. In this implementation a hosted Live start is explicitly rejected before any broker submission.

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

The website shows an empty offline dashboard until configuration exists, then requests the dashboard password before enabling engine requests or loading account data. The access cookie is signed, HttpOnly, Secure and SameSite=Strict. Use **Lock dashboard** to clear it; rotating the gateway secret revokes existing access cookies. Account tokens and live order state remain encrypted in the persistent engine's SQLite directory.

When the engine connection is unconfigured, the website opens the actual dashboard with empty data and an **Execution engine not connected** notice. Users can inspect the layout and rules; broker login, data fetching, backtests and orders stay unavailable. No engine polling or event stream is started in that state. **Check connection** retries the access check. A configured private deployment still requires the dashboard password before its account data is loaded. A malformed, failed or timed-out access response never enables engine requests. The offline dashboard is a UI fallback, not a working hosted engine.

## Production broker and IP setup

The end-user flow is **open dashboard → Broker & execution IP setup → register execution IP in mStock → connect with their own Type A API key and OTP/TOTP → run read-only checks → review Paper before choosing Live**. Users do not install Node or run a terminal on their device to use an already configured hosted deployment.

The new `GET /api/setup/network` observes outbound IPv4 **inside the persistent execution process**, using the free [ipify IPv4 endpoint](https://www.ipify.org/). The browser and Vercel gateway do not perform the lookup. Requests include no broker credentials, follow no redirects, time out after five seconds, and accept only a bounded public IPv4 response. Concurrent reads share a 30-second cache; failures retain the last observation with an unverified status and retry after 15 seconds. IP history records changes across restarts. Successful observation does not establish a static allocation, broker registration, or broker-side routing; only a confirmed broker response can establish execution acceptance.

Set `N009_EXECUTION_LOCATION=hosted` on the hosted engine. Optionally set `N009_EXECUTION_IPV4` to the actual stable outbound IPv4 provided by the engine host; the UI flags disagreement with observations. Do not enter the Vercel, reverse-proxy, tunnel ingress, LAN or end-user-device IP. Moving execution hosts requires checking the new engine's outbound address and reconnecting the broker after updating the API-key settings. A rotating outbound IP is unsuitable for a fixed allowlist; this application does not turn it into a static IP.

Connected users can enter primary/secondary IP values copied from their mStock API-key screen. `POST /api/setup/network` saves this reference with CSRF protection, scoped to broker account **and API key**. It never changes mStock settings. A match is labelled as a comparison against user-entered values, never as broker verification. Connection checks cannot place, modify or cancel an order. The existing funds, NFO/MIS/MARKET, REST, stream and real-fill checks remain separate.

This deployment still owns **one private broker workspace**. Do not share one dashboard password or one engine data volume among unrelated users who need independent accounts; one engine per private deployment keeps their connections, settings and histories separate. No new platform signup/account system is introduced here. A centrally shared multi-account service would require a separate tenant-isolation implementation.

## Container deployment on a persistent host

`Dockerfile` and `compose.yaml` package the execution engine for a host outside a user's laptop. The image runs as an unprivileged user; Compose retains encrypted broker state, SQLite and encryption keys in `engine-data`, restarts the process, and checks authenticated health. These are free/open-source deployment components; no paid API, subscription or hosting service is required by the code. Availability of a suitable no-cost persistent host and stable egress must be verified by the deployment owner; the repository does not provision or guarantee one.

On that host, supply `N009_GATEWAY_SECRET` through its environment (at least 32 random characters), optionally `N009_EXECUTION_IPV4`, then run:

```sh
docker compose up --build -d
docker compose ps
```

Compose loads a host-side `.env` if used; the Node process itself still does not load `.env`. The service binds to host loopback by default. Configure the host's HTTPS reverse proxy to forward to port 4310 and supply that **HTTPS origin** as `N009_ENGINE_ORIGIN` in Vercel, with the matching secret and dashboard password. Use the host's existing free HTTPS ingress, or a free/open-source reverse proxy; do not expose an unencrypted broker dashboard. The reverse proxy must preserve the gateway authentication header. Verify `/api/access` and the end-to-end setup flow through Vercel; a successful frontend deploy alone is insufficient.

Run only one engine against a volume. The container entrypoint holds an exclusive OS file lock for the entire engine lifetime and only then clears the legacy PID marker; container PID reuse after a crash must not make a stale PID marker appear to be another active engine. Do not mix a directly launched engine and a container against the same directory. Keep data-volume backups private. Deploy/restart only after sessions are stopped and flat; do not assume a process manager can guarantee broker exits before a forced shutdown. Never use `docker compose down -v` on a live data volume.

For a future broker-hosted sign-in button, mStock documents a [partner onboarding flow](https://tradingapi.mstock.com/docs/v1/Partners-Onboarding/login-flow/) requiring a platform key and dedicated private key/IV obtained from its integration team. Those credentials are not available in this repository; the current working connection remains Type A API key + OTP/TOTP. No fake or unverified partner-login button is shown.

## 3. Verify

Unlock the dashboard, connect mStock, run read-only broker diagnostics, and test paper mode/backtesting. Confirm displayed timestamps and segment permissions. Building/deploying this repository does not verify a live order or actual broker fill.

The API gateway streams events for bounded requests and reconnects; dashboard polling also refreshes state. The broker WebSocket, strategy loop and historical/backtest jobs continue on the persistent engine independently of the browser and Vercel request lifetime. If the engine is unavailable, the dashboard reports a connection issue and does not synthesize prices or fills.

`npm test` covers engine authorization, dashboard login, cross-site rejection, cookie tampering, header filtering, CSRF preservation, sanitized connection errors, IP caching/failures, and account/API-key scoping of IP references. `npm run build:vercel` builds the deployable dashboard and type-checks the gateway. Container runtime and real hosted connectivity must be verified on the chosen host.
