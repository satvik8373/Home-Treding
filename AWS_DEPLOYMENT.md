# Persistent AWS engine with Vercel dashboard

The dashboard and authenticated gateway run on Vercel. A dedicated Ubuntu systemd service runs the original execution engine continuously, with SQLite and its encryption key under `/var/lib/nifty009`. The browser can close without stopping the engine. The external engine supports the existing Paper and Live paths; choosing Live and starting a strategy remains an explicit user action.

## Build and install

Use Node 22 on the build machine and Ubuntu host. Run `npm ci`, then `node scripts/package-engine.mjs`. The output under `.vercel/aws-engine` contains a bundled `server/index.mjs` and the locked npm manifests. Archive that directory and verify the archive checksum after transfer. Secrets and trading data are excluded.

Extract into a new versioned `/opt/nifty009/releases/<release>` directory. Run `npm ci --omit=dev --no-audit --no-fund` there. Point `/opt/nifty009/current` at the release. Use the dedicated `nifty009` system account and a private writable `/var/lib/nifty009` directory. Never upload the SSH private key.

Install the [systemd unit](deploy/aws/nifty009.service) and [Caddy template](deploy/aws/Caddyfile.example). Replace the Node executable path and engine hostname with the actual installed paths and DNS name. Keep the engine bound to loopback; expose only HTTPS through Caddy. Automatic certificate issuance needs inbound ports 80 and 443. Preserve unrelated services and security group rules.

Create `/etc/nifty009/engine.env` as root with mode 0600:

```dotenv
NODE_ENV=production
PORT=4310
N009_HOST=127.0.0.1
N009_DATA_DIR=/var/lib/nifty009
N009_EXECUTION_LOCATION=hosted
```

Also set `N009_GATEWAY_SECRET` to a private random value of at least 32 characters. Optionally set `N009_EXECUTION_IPV4` to the verified host outbound IPv4; this is an expected-value comparison, not proof of a static allocation or broker approval.

## Connect Vercel

Set production server-side variables, then redeploy:

- `N009_ENGINE_TRANSPORT=external`
- `N009_ENGINE_ORIGIN`: the engine's valid HTTPS origin.
- `N009_GATEWAY_SECRET`: identical to the engine value.
- `N009_DASHBOARD_PASSWORD`: a separate private password of at least 24 characters.

Keep these values out of Git and browser environment variables. Production `vercel.json` deliberately has no Paper daemon. When migrating an existing cloud worker, first confirm it is stopped and flat, scale it to zero, and preserve its final encrypted records. Do not run two engines against one state directory or migrate unresolved orders. Backup SQLite together with `session.key`; losing the key loses saved broker access. Use SQLite's backup API for a running database rather than copying only the main file while WAL writes are active.

## Verify before user-controlled Live

1. `/api/health` returns 401 without the gateway header and 200 with it over certificate-verified HTTPS.
2. Sign into the Vercel dashboard and check broker status, fresh ticks, settings and the observed engine IP.
3. Register that outbound IP in the mStock API-key settings. A saved app reference does not update the broker. Reconnect when the API key or session changes.
4. Run the read-only account checks. Order-book access and a fresh tick do not prove order execution. Only a broker-confirmed actual fill establishes execution.

The current EC2 address is auto-assigned, without an Elastic IP. Stop/start or replacement can change it. If it changes, update engine DNS, the HTTPS origin, expected IP and broker allowlist before Live use. Do not describe it as a guaranteed static address. No additional instance, subscription or Elastic IP is required by these templates; existing AWS resources remain subject to the account's actual free-tier eligibility and usage.

Before any engine upgrade/restart, stop entries and resolve broker exposure in the dashboard. Never force a deployment through unresolved orders. Inspect `systemctl status nifty009`, restart counts, memory and disk; the starter memory limit is not a performance guarantee. Keep the old release and a verified state backup for rollback.
