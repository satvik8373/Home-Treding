# Private Firestore recovery backups

The AWS execution engine remains authoritative. Settings, broker credentials, references, positions, pending orders, trade history, saved backtests and ownership records are committed to SQLite on the persistent AWS disk. Closing the browser or signing out does not shut down the engine. Normal process recovery resumes the same saved day-session after broker verification; it does not manufacture a new reference or replay orders. A new trading day still requires an explicit Start. Expired broker authentication still requires fresh broker verification.

Firestore adds an encrypted off-host recovery copy. It is not an execution engine and does not keep an expired mStock token alive. The separate backup worker runs every 15 minutes, reads a consistent SQLite snapshot, and encrypts the complete records and the workspace encryption key with AES-256-GCM before uploading. The outer backup key stays outside Firestore. Project, workspace and revision are authenticated as encryption context. No password, OTP or TOTP secret is collected for this feature. Google/Firebase credentials, session cookies and the private backup key are never shipped to the browser.

The account engine also schedules encrypted checkpoints after durable mutations: normally after three seconds, with a ten-second minimum between attempts and a thirty-second retry after failure. Quote ticks and identical stored values do not trigger uploads. Profile reports whether the current replica is saved, pending or retrying. This supplements the independent worker; browser views and Start/Stop/Resume use the single AWS controller directly. See [account engine](ACCOUNT_ENGINE.md).

Two bounded slots per workspace retain the latest and previous ciphertext. Each upload atomically publishes its chunks and manifest. Failed writes cannot publish a partial backup. Unchanged state is verified and skipped. Firestore failures cannot block or roll back the trading loop. A backup can lag local state by at least one interval, or longer during outages; it is not a zero-loss recovery guarantee.

## One-time Firebase setup

1. In Firebase project `mavrix-trading`, create the default Firestore database on the free Spark tier if it does not exist. Do not enable a paid plan for this feature.
2. Use a dedicated Google Cloud service account with the predefined **Cloud Datastore User** role for this project. This permits server Firestore reads/writes; do not grant Owner, Editor, or Firebase Admin. IAM applies to server OAuth requests and bypasses Firebase client rules, so protect the service account as privileged server access. The public `firebaseConfig`/API key does not supply this access.
3. Save the service-account JSON as a private local file and provide its **file path**, never its private key in chat. It must have `type: service_account`, `project_id: mavrix-trading`, `client_email`, and `private_key`. It belongs only on the server at `/etc/nifty009/firestore-service-account.json`, owned by root, mode `0600`.
4. Merge `firestore.rules` into the project's existing rules, checking that no broader matching rule grants access to `n009EngineBackups`. Firebase rules are additive: a permissive overlapping rule overrides a deny. The supplied file preserves the reviewed user/profile, strategy, trade, broker, order and notification rules, adds immutable ownership checks on updates, and explicitly denies all browser access to engine backups. Do not replace unrelated application rules without reviewing them. Add the `encryptedState` indexing exemption from `firestore.indexes.json` without deleting unrelated indexes.
5. Keep a random 32-byte binary backup key privately at `/etc/nifty009/firestore-backup.key`, owned by root, mode `0600`. Keep a separate secure recovery copy of this key: without it the ciphertext cannot be recovered. Do not regenerate it on each deploy.

The root-only environment file `/etc/nifty009/firestore-backup.env` contains the project and data directory. Systemd `LoadCredential` supplies the two secret files to the worker through a private runtime credential directory; the root-only `/etc/nifty009` directory remains inaccessible to the service user. For manual operator-run recovery, set the two credential path variables explicitly in that operator environment:

```dotenv
N009_FIREBASE_PROJECT_ID=mavrix-trading
N009_DATA_DIR=/var/lib/nifty009
GOOGLE_APPLICATION_CREDENTIALS=/etc/nifty009/firestore-service-account.json
N009_BACKUP_KEY_FILE=/etc/nifty009/firestore-backup.key
```

Build the independent worker with `npm run build:backup`. Install the resulting `.vercel/firestore-backup` bundle and its locked production dependencies at `/opt/n009-backup`. The provided systemd service/timer under `deploy/` use the existing engine runtime and separate credentials via `LoadCredential`; the unit sets `GOOGLE_APPLICATION_CREDENTIALS` and `N009_BACKUP_KEY_FILE` to the runtime `%d` directory. Run a one-off backup and verify a successful private status before enabling the timer. The service skips execution while either private credential file is absent. No trading-service restart is needed.

The worker writes private status to `/var/lib/nifty009/firestore-backup-status.json`. Its logs report only counts and success/failure, never account details or credentials. Failed syncs exit nonzero. Keep a single backup worker/timer; overlapping runs are rejected. Service-account JSON files and recovery keys must stay outside Git, static assets, build artifacts and Vercel frontend variables.

## Free-tier bounds

Firestore's documented free quota is 1 GiB stored, 50,000 reads/day, and 20,000 writes/day. This worker is capped at four Google workspaces plus the owner, a 15-minute interval, and 4 MiB encrypted per workspace. Eight 512 KiB chunks plus one manifest means at most 4,320 document writes/day for five continuously changing workspaces at 96 runs/day, excluding manual runs or other applications. Reads for unchanged verification are also bounded. Other Firebase activity consumes the same project quota. Oversized backups fail visibly without truncating engine records or purchasing capacity. Do not add per-tick Firestore writes or reduce the interval without reviewing quotas. See [Firestore limits](https://firebase.google.com/docs/firestore/quotas).

The mutation-triggered checkpoints consume additional quota and are not included in the worker-only bound above. Coalescing limits request frequency, not total daily project usage. On Spark, exhausted quota makes synchronization retry while the AWS store retains newer state; it must not be presented as unlimited free storage or a zero-loss cloud guarantee. No automatic paid-plan upgrade is configured.

## Recovery is staged and explicit

Run the worker with `restore <owner|workspace-id> <new-staging-directory>` using the same project and backup key. Recovery requires a new directory and refuses to overwrite existing data. AES-GCM, scope, revision, chunk count and fingerprint checks must pass before creating it. The current session is marked blocked, including any saved pending order. No broker calls or strategy starts are made by recovery.

Recover the owner ownership index and every relevant Google workspace together. Before replacing any live data, stop the service deliberately, preserve its existing databases and keys, and compare broker order book/positions with the staged ledger. Backups may be stale: reconcile pending orders and quantities before explicitly resuming. Normal browser reopening and ordinary process restarts use the newer local store, not Firestore rollback. This prevents a stale backup from recreating an order that already reached the broker.

Server-side Firebase access and rules are separate controls: see [Firestore security](https://firebase.google.com/docs/firestore/security/overview). Live connectivity is verified only after actual project access is configured; local mock tests do not prove deployed IAM or rules.

## Verified deployment — 9 November 2026

The independent worker is installed at `/opt/n009-backup`. Its first real Firestore sync saved all three existing workspaces. A subsequent read/decrypt check recovered all three in memory, including one encrypted broker connection; it did not replace live data or place orders. Anonymous backup document reads and collection listing returned HTTP 403. Existing per-user rules were preserved, ownership changes on client updates were disallowed, and the server-only backup rule compiled and published successfully. The Firebase Rules test API returned HTTP 403 for the supplied service account, so no claim is made that its remote test suite ran.

The ciphertext field indexing exemption request also returned HTTP 403. Backups work with current default indexing; applying that optional exemption needs an account with Firestore index administration rights. The supplied index file remains ready for that operation. No paid services or plan upgrades were enabled. The separate recovery key copy is in the owner's private `.runtime/n009-cloud` directory outside this repository; keep that copy secure and separate from Firestore.
