import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { Store } from "./store.ts";
import { MStock } from "./broker.ts";
import { MarketFeed } from "./feed.ts";
import { Controller } from "./controller.ts";
import { createApp } from "./http.ts";
import { Workspaces } from './workspaces.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = process.env.N009_DATA_DIR
  ? resolve(process.env.N009_DATA_DIR)
  : join(root, "data");
mkdirSync(data, { recursive: true });
const lock = join(data, "engine.pid");
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, "utf8"));
  let alive = false;
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      /* stale lock */
    }
  }
  if (alive)
    throw new Error("Another 009 engine already owns this data directory.");
  unlinkSync(lock);
}
writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
process.on("exit", () => {
  try {
    if (readFileSync(lock, "utf8") === String(process.pid)) unlinkSync(lock);
  } catch {
    /* already released */
  }
});
const port = Number(process.env.PORT || 4310);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT must be between 1024 and 65535.");
const host = process.env.N009_HOST || '127.0.0.1';
if (process.env.N009_GATEWAY_SECRET && process.env.N009_GATEWAY_SECRET.length < 32) throw new Error('N009_GATEWAY_SECRET requires at least 32 characters.');
if (host !== '127.0.0.1' && (!process.env.N009_GATEWAY_SECRET || process.env.N009_GATEWAY_SECRET.length < 32)) throw new Error('A remote engine requires N009_GATEWAY_SECRET with at least 32 characters.');
const multiuser = process.env.N009_MULTIUSER === 'true';
const localStandalone = process.env.N009_EXECUTION_LOCATION === 'local' && process.env.N009_ISOLATED_ENGINE !== 'true';
if (!multiuser && !localStandalone && process.env.N009_ISOLATED_ENGINE !== 'true') throw new Error('Use npm run dev for the shared account dashboard. A separate Paper development engine requires npm run dev:isolated.');
if (!multiuser && existsSync(join(data, 'execution-owner.json'))) throw new Error('This data was handed off to the hosted account engine. Use the account dashboard; do not restart a second executor on the same state.');
const workspaces = multiuser ? new Workspaces(data, process.env.N009_GATEWAY_SECRET ?? '', Number(process.env.N009_MAX_WORKSPACES || 4)) : null;
const store = workspaces ? null : new Store(data);
const feed = workspaces ? null : new MarketFeed();
const controller = store && feed ? new Controller(new MStock(), store, feed) : null;
if (controller && process.env.N009_ISOLATED_ENGINE === 'true') controller.execution = { kind: 'hosted-paper', liveExecution: false, reason: 'This is an isolated development engine. Use the Google account workspace for shared production execution.' };
const app = workspaces?.app ?? createApp(controller!, root, port, store!);
const server = app.listen(port, host, () =>
  console.log(`NIFTY 009: http://127.0.0.1:${port}`),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
if (workspaces) await workspaces.restore(); else await controller!.restore();
let timer = setInterval(() => void (workspaces ? workspaces.pump() : controller!.pump()), 1000);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  try {
    if (workspaces) await workspaces.close();
    else await controller!.checkpointForRestart();
  } catch {
    console.error('Restart checkpoint failed. Engine remains running; resolve storage before restarting.');
    timer = setInterval(() => void (workspaces ? workspaces.pump() : controller!.pump()), 1000);
    shuttingDown = false;
    return;
  }
  feed?.close();
  store?.close();
  server.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
