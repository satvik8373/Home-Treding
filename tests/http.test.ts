import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/http.ts";
import { contract, fixture } from "./helpers.ts";
import { istTime } from "../server/time.ts";
import type { BacktestJob } from "../shared/backtest.ts";
import type { HistoricalFetchJob } from '../shared/backtest.ts';

test("HTTP requires same-origin CSRF and explicit live acknowledgement; state never exposes broker credentials", async (t) => {
  const f = await fixture();
  const app = createApp(f.controller, process.cwd());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { Host: "127.0.0.1:4310" };
  const response = await fetch(`${root}/api/state`, { headers });
  assert.equal(response.status, 200);
  const state = (await response.json()) as { csrf: string };
  assert.equal(JSON.stringify(state).includes("test-key"), false);
  assert.equal(JSON.stringify(state).includes("test-token"), false);
  const send = (extra: Record<string, string>, body: object) =>
    fetch(`${root}/api/strategy/start`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", ...extra },
      body: JSON.stringify(body),
    });
  assert.equal((await send({}, { mode: "paper" })).status, 403);
  assert.equal(
    (
      await send(
        { "X-009-CSRF": state.csrf, Origin: "https://evil.example" },
        { mode: "paper" },
      )
    ).status,
    403,
  );
  const live = await send({ "X-009-CSRF": state.csrf }, { mode: "live" });
  assert.equal(live.status, 400);
  assert.match(
    ((await live.json()) as { error: string }).error,
    /Confirm live orders/,
  );
  assert.equal(
    (await fetch(`${root}/api/market/chart?symbol=OTHER`, { headers })).status,
    400,
  );
  f.broker.credentials = null;
  assert.equal(
    (await fetch(`${root}/api/market/chart?symbol=NIFTY`, { headers })).status,
    409,
  );
});

test('historical fetch endpoints require CSRF, export spot data and never alter trading state', async t => {
  const f = await fixture(), before = JSON.stringify(f.controller.session);
  const history = f.broker.history.bind(f.broker);
  Object.assign(f.broker, { history: async (token: string, _exchange: string, date: string) => {
    const bars = await history(token), offset = Date.parse(date) - Date.parse('2026-10-26');
    return bars.map(bar => ({ ...bar, start: bar.start + offset, end: bar.end + offset }));
  } });
  const server = createApp(f.controller, process.cwd()).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close() });
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const state = await (await fetch(`${root}/api/state`)).json() as { csrf: string };
  const post = (path: string, body: unknown, csrf = state.csrf) => fetch(`${root}/api/history/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-009-CSRF': csrf }, body: JSON.stringify(body) });
  assert.equal((await post('fetch', { startDate: '2026-10-23', endDate: '2026-10-23' }, '')).status, 403);
  assert.equal((await post('contracts', { version: 1, days: [] }, '')).status, 403);
  assert.equal((await fetch(`${root}/api/history/contracts/schema`)).status, 200);
  assert.equal((await fetch(`${root}/api/history/spot/2026-10-23`)).status, 404);
  const started = await post('fetch', { startDate: '2026-10-23', endDate: '2026-10-23' });
  assert.equal(started.status, 202);
  let job = await started.json() as HistoricalFetchJob;
  for (let i = 0; i < 20 && job.status === 'running'; i++) { await new Promise(resolve => setImmediate(resolve)); job = await (await fetch(`${root}/api/history/jobs/${job.id}`)).json() as HistoricalFetchJob }
  assert.equal(job.status, 'complete');
  const spot = await fetch(`${root}/api/history/spot/2026-10-23`);
  assert.equal(spot.status, 200);
  assert.match(spot.headers.get('content-disposition')!, /009-nifty-2026-10-23.json/);
  assert.equal((await spot.json() as { candles: unknown[] }).candles.length, 1);
  assert.equal((await (await fetch(`${root}/api/history/latest`)).json() as { job: HistoricalFetchJob }).job.id, job.id);
  const exported = await fetch(`${root}/api/history/jobs/${job.id}/data`);
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get('content-disposition')!, /009-history-2026-10-23-2026-10-23.json/);
  const bundle = await exported.json() as { kind: string; days: { spot: { candles: unknown[] }; options: unknown }[] };
  assert.equal(bundle.kind, 'nifty-009-history');
  assert.equal(bundle.days[0].spot.candles.length, 1);
  assert.equal(bundle.days[0].options, null);
  assert.equal((await fetch(`${root}/api/history/jobs/missing/data`)).status, 400);
  assert.equal(JSON.stringify(f.controller.session), before);
  assert.equal(f.broker.submitted.length, 0);
});

test("backtest HTTP imports full sessions, exports pinned data and fills, and leaves live state untouched", async (t) => {
  const f = await fixture();
  f.broker.credentials = null;
  const before = JSON.stringify(f.controller.session);
  const server = createApp(f.controller, process.cwd()).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const state = (await (await fetch(`${root}/api/state`)).json()) as {
    csrf: string;
  };
  const post = (path: string, body: unknown, csrf = state.csrf) =>
    fetch(`${root}/api/backtest/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-009-CSRF": csrf },
      body: JSON.stringify(body),
    });
  const date = "2026-10-23",
    start = istTime(date, "09:15");
  const candles = Array.from({ length: 72 }, (_, i) => ({
    start: start + i * 300_000,
    end: start + (i + 1) * 300_000,
    open: 100,
    high: 110,
    low: 90,
    close: i === 0 ? 100 : 101,
  }));
  const data = {
    version: 1,
    date,
    spotReferenceClose: 25000,
    contracts: { CE: contract("CE"), PE: contract("PE") },
    candles: { CE: candles, PE: candles },
  };
  assert.ok(JSON.stringify(data).length > 8192);
  assert.equal((await post("import", data, "")).status, 403);
  assert.equal((await post("import", data)).status, 200);
  const schema = await fetch(`${root}/api/backtest/schema`);
  assert.equal(schema.status, 200);
  assert.match(schema.headers.get("content-disposition")!, /schema.json/);
  const response = await post("run", {
    startDate: date,
    endDate: date,
    options: { slippagePoints: 0.05, feePerOrder: 20 },
  });
  assert.equal(response.status, 202);
  let job = (await response.json()) as BacktestJob;
  for (let i = 0; job.status === "running" && i < 20; i++)
    job = (await (
      await fetch(`${root}/api/backtest/jobs/${job.id}`)
    ).json()) as BacktestJob;
  assert.equal(job.status, "complete");
  assert.equal(job.result?.summary.completeSessions, 1);
  assert.equal(job.result?.days[0].source, "import");
  assert.equal(job.result?.summary.orderCount, 4);
  const csv = await fetch(`${root}/api/backtest/jobs/${job.id}/trades.csv`);
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /BREAKOUT/);
  const daily = await fetch(`${root}/api/backtest/jobs/${job.id}/daily.csv`);
  assert.equal(daily.status, 200);
  assert.match(await daily.text(), /gross_realized_pnl_inr/);
  assert.equal(
    (await post("import", { ...data, spotReferenceClose: 26000 })).status,
    200,
  );
  const pinned = (await (
    await fetch(`${root}/api/backtest/jobs/${job.id}/data/${date}`)
  ).json()) as { spotReferenceClose: number };
  assert.equal(pinned.spotReferenceClose, 25000);
  const archive = (await (
    await fetch(`${root}/api/backtest/archive/${date}`)
  ).json()) as { spotReferenceClose: number };
  assert.equal(archive.spotReferenceClose, 26000);
  assert.equal(
    (await fetch(`${root}/api/backtest/jobs/${job.id}/data/2026-10-22`)).status,
    404,
  );
  assert.equal(
    (
      await post("run", {
        startDate: date,
        endDate: date,
        options: { feePerOrder: -1 },
      })
    ).status,
    400,
  );
  assert.equal(JSON.stringify(f.controller.session), before);
  assert.equal(f.broker.submitted.length, 0);
  assert.equal(f.store.writes.length, 0);
});
