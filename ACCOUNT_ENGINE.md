# One account, one execution engine

`npm run dev` now starts a loopback UI preview that uses the same hosted account API as `https://home-treding.vercel.app`. It does not start a second trading engine. Google sign-in selects the same verified Firebase project/UID workspace, so Start, Stop & square off, same-day Resume, settings, fills, audit reports and exports operate on the same AWS controller from the local preview and the PWA.

The preview listener is restricted to `127.0.0.1:5173`/`localhost:5173`. It forwards only the two signed dashboard cookies, translates their names for loopback HTTP, and preserves HttpOnly and SameSite=Strict. It never holds the server signing key or broker tokens. Cross-site origins and unrelated localhost cookies are rejected or stripped. Google identity is still verified by the hosted gateway; the preview cannot choose a tenant or bypass authentication. This loopback-only cookie adaptation must not be exposed on a public/LAN listener. Production cookies retain Secure and the `__Host-` prefix.

`npm run dev:isolated` is an explicit, separate Paper-development environment. It is not shared account execution and cannot place Live orders. A data directory handed off to the account engine is fenced with `execution-owner.json` so it cannot accidentally run a duplicate local executor. Keep normal account use on `npm run dev` or the production website.

## Firestore persistence

The AWS controller commits durable state to its per-account SQLite store first, including every Start/Stop/Resume state change, reference prices, locked rules, pending order, fill, trade ledger, broker token update and preferences. Durable mutations request an encrypted Firestore checkpoint automatically. Nearby changes are coalesced, normally after three seconds and at most once every ten seconds per workspace; transient failures retry after thirty seconds. Quote ticks do not trigger writes. The existing fifteen-minute worker remains an independent backup path.

Profile shows the actual Firestore synchronization status: Saved, Saving latest changes, Retrying, or Not configured. Firestore outages do not turn a successful broker operation into a failed request or stop position monitoring. A successful engine response means the durable engine state changed; the Firestore status reports when its off-host copy caught up. No browser can directly edit an execution-state document to place orders. Cloud credentials and the encryption key are supplied only to the AWS service through systemd LoadCredential.

The encrypted account checkpoints use the existing `n009EngineBackups/<opaque-workspace>` namespace and backup key. They retain all stored records, including command/activity history, without copying secrets into client-readable Firestore documents. The AWS controller remains the single execution authority. Firestore is durable replicated storage, not a second independent execution loop. An interrupted server restores its local checkpoint; disaster recovery from Firestore remains staged and reconciled to avoid replaying stale orders.

## Legacy Paper handoff

The operator tool `scripts/paper-handoff.ts` transfers a stopped source process's checkpoint, including its original session ID, reference candles, rules, entries, re-entry gates, fills, positions and account history. It never transfers broker credentials, calls a broker order endpoint or converts Paper into Live. The destination must already be linked to the same broker account and must not have its own active session, exposure or executed trade history. Existing history conflicts fail closed. Writes are atomic and repeat imports are idempotent.

Close the old dev terminal with Ctrl+C before export. The source PID lock must be inactive; export fences that old data directory. Import is allowed only while the hosted service is stopped, after taking a private backup. The source's Stopped/Running state is preserved; an active handoff must still be inside its original trading day and cutoff. Never copy a running SQLite file or square off solely to perform a handoff. The original source database and keys remain intact for recovery.

The 9 November 2026 handoff imported the user's final stopped Paper checkpoint with nine trade records and zero open legs into its already-linked Google workspace. It preserved the stopped state and did not start a strategy or place a broker order.
