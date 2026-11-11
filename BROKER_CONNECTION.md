# mStock production connection

Use a Type A API key and the broker account that belongs to your dashboard workspace.

1. Sign in with Google. The same verified Google UID always opens its existing server workspace, including its broker link and current day-session, on every device. A valid broker connection opens directly without setup.
2. For a first Type A Authenticator connection, enter the API key and current six-digit Authenticator code. This calls the documented `/session/verifytotp` endpoint with only `api_key` and `totp`. The key is encrypted on the server after broker verification. When that saved TOTP session expires, the returning-user form needs only the current six-digit code; it reuses the private server key and checks that mStock returns the same broker account before saving the new token. It never fetches the key into the browser. SMS OTP and full client-code/password login remain available as a fallback, including for a broker response that requires the full flow. If mStock shows Disable TOTP, Authenticator is enabled and SMS OTP is not sent.
3. Wait for the account check to confirm the session. A temporary read failure retries automatically using the encrypted saved token; do not generate another code just because the market stream reconnects.
4. Use the read-only account checks to verify funds, permissions and data access. Order-book access is not proof of a live fill.

When TOTP is enabled, mStock does not send an SMS OTP for the trading API login. Use the current authenticator code. The app does not remove or disable broker two-factor verification.

Access tokens expire within 12 hours or at midnight IST, whichever comes first. Expired or rejected tokens require a fresh login; passwords and OTPs are not stored for unattended renewal. Temporary verification failures use bounded retries (5–60 seconds); invalid credentials/API keys do not loop indefinitely.

An expired token is distinct from a removed account link. The saved account remains visible in Profile and the broker dialog while verification is due. Authentication renewal preserves the original session ID, reference prices, rules and ledger and does not submit any trading order or implicitly start a new trading day. Requests to renew an already valid saved connection or replace a connected running strategy are rejected. TOTP flows are rate-limited with ordinary login, expire after ten minutes, allow at most five verification attempts, and cannot switch to SMS OTP within the same flow. After a flow expiry or engine restart, use Restart verification; codes are only submitted on an explicit user action.

Google sign-in persistence follows [Firebase's documented local persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence). Broker token validity remains governed by [mStock's published limits](https://tradingapi.mstock.com/docs/v1/Introduction/). A returned `refresh_token` field is not treated as permission to use an undocumented silent-renewal endpoint. The partner redirect flow is a separate partner integration and is not substituted for the retail Type A flow.

Market streaming is separate from broker authentication. A stream reconnect does not log out the broker. Quiet subscribed contracts do not tear down a stream that is delivering other instruments. Outside normal weekday market hours, absent ticks alone do not force reconnects. Missing or stale prices never become executable prices just because the socket is open.

Execution IP setup is under **API key & execution IP setup**. mStock enforces a strict 1:1 Client ID to static IPv4 mapping on retail Type A keys: if two workspaces share the same host outbound IPv4, mStock rejects the second account with *"IP already used"*. When the host detects another connected workspace already using the shared host IPv4 (`sharedIpConflict`), it alerts the user before connection setup so they can either:
1. Configure a dedicated outbound route (`N009_WORKSPACE_PROXIES` / `N009_WORKSPACE_INTERFACES` configured by the host operator, or a dedicated per-workspace HTTP/HTTPS proxy via the workspace setup panel), routing both REST calls (`MStock`) and market WebSocket connections (`MarketFeed`) through that workspace's distinct public IPv4, or
2. Run the app's local engine on their own device or free-tier host (`run.bat` / `npm start`) so their broker traffic originates from their own IPv4.

Every user must register their workspace's displayed outbound execution IPv4 as the **Primary IP** on `trade.mstock.com` (never their browser/device IP or Vercel website domain). The official Type A flow (API key + Authenticator TOTP, with client-code/password/SMS OTP fallback) sends requests through the workspace's active outbound route. Account Diagnostics confirms the accepted IP by verifying fund summary, positions, orders, and market quotes against mStock. A fresh verified broker login can move a connection from a stopped, flat workspace with no pending order; the previous workspace keeps its history and loses its broker credentials, while active sessions cannot be moved.

Official references:
- https://tradingapi.mstock.com/docs/v1/typeA/User/
- https://tradingapi.mstock.com/docs/v1/Introduction/
- https://tradingapi.mstock.com/docs/v1/typeA/error-codes/
