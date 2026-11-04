import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candle } from "../shared/model.ts";
import type { BacktestDataset } from "../shared/backtest.ts";
import { replay, report } from "../server/backtest/replay.ts";
import { dataset, dateRange, options } from "../server/backtest/validation.ts";
import { Backtests } from "../server/backtest/service.ts";
import type { BacktestRepository } from "../server/backtest/service.ts";
import { DAY, contract, fixture } from "./helpers.ts";
import { istTime } from "../server/time.ts";

const ZERO = { slippagePoints: 0, feePerOrder: 0 };
const NOW = istTime(DAY, "16:00");
function input(ce: number[][], pe?: number[][]): BacktestDataset {
  const bars = (values: number[][]): Candle[] =>
    values.map((v, i) => ({
      start: istTime(DAY, "09:15") + i * 300_000,
      end: istTime(DAY, "09:20") + i * 300_000,
      open: v[0],
      high: v[1],
      low: v[2],
      close: v[3],
    }));
  return dataset(
    {
      version: 1,
      date: DAY,
      spotReferenceClose: 25000,
      contracts: { CE: contract("CE"), PE: contract("PE") },
      candles: {
        CE: bars(ce),
        PE: bars(pe ?? ce.map(() => [100, 100, 100, 100])),
      },
    },
    NOW,
    "import",
  );
}
const reference = [100, 110, 90, 100],
  signal = [100, 110, 99, 101];
const next = [100, 110, 99, 105];
const complete = () => [
  reference,
  signal,
  ...Array.from({ length: 70 }, () => [101, 110, 100, 104]),
];
class Repository implements BacktestRepository {
  values = new Map<string, unknown>();
  get<T>(key: string) {
    return this.values.has(key)
      ? (structuredClone(this.values.get(key)) as T)
      : null;
  }
  put(key: string, value: unknown) {
    this.values.set(key, structuredClone(value));
  }
  keys(prefix: string) {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }
}
async function done(service: Backtests, id: string) {
  for (let i = 0; i < 50; i++) {
    const job = service.job(id);
    if (job.status !== "running") return job;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("Test backtest did not settle.");
}

test("entry uses next open and cannot profit from the signal candle’s earlier high", () => {
  const data = input([reference, [100, 200, 99, 101], [105, 110, 104, 106]]);
  const before = JSON.stringify(data),
    result = replay(data, ZERO);
  assert.equal(result.fills.length, 1);
  assert.equal(result.fills[0].at, istTime(DAY, "09:25"));
  assert.equal(result.fills[0].price, 105);
  assert.equal(result.cycles[0].remaining, 195);
  assert.equal(result.openPnl, 195);
  assert.equal(JSON.stringify(data), before);
});
test("independent CALL and PUT use historical lot sizes, not a hard-coded quantity", () => {
  const data = input([reference, signal, next], [reference, signal, next]);
  data.contracts.CE.lotSize = data.contracts.PE.lotSize = 75;
  const result = replay(data, ZERO);
  assert.deepEqual(
    result.fills.map((fill) => [fill.side, fill.quantity]),
    [
      ["CE", 225],
      ["PE", 225],
    ],
  );
});
test("same-bar targets close one lot then two lots, with fees allocated to the full cycle", () => {
  const result = replay(input([reference, signal, [100, 150, 95, 101]]), {
    slippagePoints: 0,
    feePerOrder: 20,
  });
  assert.deepEqual(
    result.fills.map((fill) => [fill.reason, fill.quantity, fill.price]),
    [
      ["BREAKOUT", 195, 100],
      ["TARGET_1", 65, 120],
      ["TARGET_2", 130, 140],
    ],
  );
  assert.equal(result.grossPnl, 6500);
  assert.equal(result.fees, 60);
  assert.equal(result.netRealizedPnl, 6440);
  assert.equal(result.cycles[0].remaining, 0);
  assert.equal(result.cycles[0].netPnl, 6440);
});
test("slippage worsens both entry and exit fills and targets follow the slipped entry", () => {
  const result = replay(input([reference, signal, [100, 150, 95, 101]]), {
    slippagePoints: 0.05,
    feePerOrder: 20,
  });
  assert.equal(result.fills[0].price, 100.05);
  assert.equal(result.fills[1].price, 120);
  assert.equal(result.fills[2].price, 140);
  assert.equal(result.grossPnl, 6490.25);
  assert.equal(result.netRealizedPnl, 6430.25);
});
test("a lower-close exit fills at next open before using that next candle’s high", () => {
  const result = replay(
    input([reference, signal, [110, 115, 97, 99], [95, 200, 94, 100]]),
    ZERO,
  );
  assert.deepEqual(
    result.fills.map((fill) => fill.reason),
    ["BREAKOUT", "LOWER_CLOSE"],
  );
  assert.equal(result.fills[1].price, 95);
  assert.equal(result.fills[1].at, istTime(DAY, "09:30"));
  assert.equal(result.grossPnl, -2925);
});
test("a gap beyond targets fills at the observed open and never at an invented price", () => {
  const result = replay(
    input([reference, signal, [100, 110, 99, 105], [150, 155, 145, 151]]),
    ZERO,
  );
  assert.deepEqual(
    result.fills.map((fill) => fill.price),
    [100, 150, 150],
  );
  assert.equal(result.grossPnl, 9750);
});
test("targets precede a same-bar lower close, and a later close can queue re-entry", () => {
  const result = replay(
    input([reference, signal, [100, 150, 95, 99], signal, next]),
    ZERO,
  );
  assert.equal(
    result.fills.some((fill) => fill.reason === "LOWER_CLOSE"),
    false,
  );
  assert.equal(result.cycles.length, 2);
  assert.equal(result.cycles[1].entryAt, istTime(DAY, "09:35"));
});
test("15:10 closes at the observed cutoff open and blocks new buys", () => {
  const candles = complete();
  candles[candles.length - 1] = [104, 110, 97, 98];
  const result = replay(input(candles), ZERO);
  assert.equal(result.status, "complete");
  assert.equal(result.asOf, istTime(DAY, "15:10"));
  assert.equal(result.fills.at(-1)!.reason, "SESSION_END");
  assert.equal(result.fills.at(-1)!.price, 104);
  assert.equal(result.fills.at(-1)!.timing, 'cutoff-open');
  assert.equal(result.cycles[0].remaining, 0);
  assert.equal(
    result.fills.filter((fill) => fill.transaction === "BUY").length,
    1,
  );
});
test("incomplete today data keeps open trades instead of pretending an end-of-day exit", () => {
  const result = replay(input([reference, signal, next]), ZERO);
  assert.equal(result.status, "partial");
  assert.equal(result.asOf, istTime(DAY, "09:30"));
  assert.equal(result.cycles[0].exitAt, null);
  assert.equal(
    result.fills.some((fill) => fill.reason === "SESSION_END"),
    false,
  );
});
test("no signal produces no fills and no synthetic performance statistics", () => {
  const result = replay(
    input([reference, [100, 110, 90, 100], [100, 110, 90, 100]]),
    ZERO,
  );
  const summary = report([result], [], ZERO, DAY, DAY, NOW).summary;
  assert.equal(summary.orderCount, 0);
  assert.equal(summary.markedNetPnl, 0);
  assert.equal(summary.winRate, null);
  assert.equal(summary.profitFactor, null);
});
test("combined P&L and drawdown preserve fee debits and closed-trade statistics", () => {
  const result = replay(input([reference, signal, [100, 150, 95, 101]]), {
    slippagePoints: 0,
    feePerOrder: 20,
  });
  const summary = report(
    [result],
    [],
    { slippagePoints: 0, feePerOrder: 20 },
    DAY,
    DAY,
    NOW,
  ).summary;
  assert.equal(summary.closedTrades, 1);
  assert.equal(summary.openTrades, 0);
  assert.equal(summary.winRate, 100);
  assert.equal(summary.markedNetPnl, 6440);
  assert.equal(summary.fees, 60);
  assert.ok(summary.maxDrawdown >= 0);
});
test("imports reject missing references, candle gaps, duplicate bars and invalid contracts", () => {
  const valid = input([reference, signal, next]);
  assert.throws(
    () =>
      dataset(
        {
          ...valid,
          candles: { ...valid.candles, CE: valid.candles.CE.slice(1) },
        },
        NOW,
        "import",
      ),
    /reference/,
  );
  assert.throws(
    () =>
      dataset(
        {
          ...valid,
          candles: {
            ...valid.candles,
            CE: [valid.candles.CE[0], valid.candles.CE[2]],
          },
        },
        NOW,
        "import",
      ),
    /missing/,
  );
  assert.throws(
    () =>
      dataset(
        {
          ...valid,
          candles: {
            ...valid.candles,
            CE: [valid.candles.CE[0], valid.candles.CE[0]],
          },
        },
        NOW,
        "import",
      ),
    /duplicate/,
  );
  assert.throws(
    () =>
      dataset(
        {
          ...valid,
          contracts: {
            ...valid.contracts,
            CE: { ...valid.contracts.CE, lotSize: 0 },
          },
        },
        NOW,
        "import",
      ),
    /metadata/,
  );
  assert.throws(
    () =>
      dataset(
        {
          ...valid,
          contracts: {
            ...valid.contracts,
            PE: { ...valid.contracts.PE, strike: 24950 },
          },
        },
        NOW,
        "import",
      ),
    /same historical/,
  );
});
test("invalid date ranges, non-finite costs and incomplete future candles are rejected", () => {
  assert.throws(() => dateRange("2026-02-30", DAY, NOW), /valid/);
  assert.throws(() => dateRange("2026-06-01", DAY, NOW), /93/);
  assert.throws(() => dateRange(DAY, "2026-10-27", NOW), /today/);
  assert.throws(() => options({ feePerOrder: Infinity }), /fee/);
  assert.throws(() => options({ slippagePoints: true }), /slippage/);
  assert.throws(
    () =>
      dataset(
        input([reference, signal, next]),
        istTime(DAY, "09:28"),
        "import",
      ),
    /incomplete/,
  );
});
test("historical dates without archived contracts are explicitly skipped without requesting today’s chain", async () => {
  const f = await fixture(),
    repo = new Repository();
  const service = new Backtests(
    f.broker,
    () => ({ connected: true, account: "test-account", session: null }),
    repo,
    () => istTime("2026-10-27", "10:00"),
  );
  const job = await done(
    service,
    service.start({ startDate: DAY, endDate: DAY }).id,
  );
  assert.equal(job.result!.summary.sessions, 0);
  assert.match(job.result!.skipped[0].reason, /historical ATM option data/);
  assert.equal(f.broker.submitted.length, 0);
});
test("a complete imported past session runs offline; partial past sessions are excluded", async () => {
  const f = await fixture(),
    repo = new Repository(),
    context = () => ({ connected: false, account: null, session: null });
  const service = new Backtests(f.broker, context, repo, () =>
    istTime("2026-10-27", "10:00"),
  );
  service.import(input([reference, signal, next]));
  const incomplete = await done(
    service,
    service.start({ startDate: DAY, endDate: DAY }).id,
  );
  assert.equal(incomplete.result!.summary.sessions, 0);
  assert.match(incomplete.result!.skipped[0].reason, /incomplete/);
  service.import(input(complete()));
  const completeJob = await done(
    service,
    service.start({ startDate: DAY, endDate: DAY }).id,
  );
  assert.equal(completeJob.result!.summary.completeSessions, 1);
  assert.equal(completeJob.result!.days[0].source, "import");
});
test("broker-backed backtesting archives real supplied candles and never changes strategy or orders", async () => {
  const f = await fixture();
  await f.start("paper");
  f.setTime(istTime(DAY, "10:00"));
  const bars = input([reference, signal, next]).candles;
  f.broker.candles.set("101", bars.CE);
  f.broker.candles.set("102", bars.PE);
  const before = JSON.stringify(f.controller.session),
    repo = new Repository();
  const service = new Backtests(
    f.broker,
    () => ({
      connected: true,
      account: "test-account",
      session: f.controller.session,
    }),
    repo,
    f.now,
  );
  const job = await done(
    service,
    service.start({ startDate: DAY, endDate: DAY, options: ZERO }).id,
  );
  assert.equal(job.result!.summary.sessions, 1);
  assert.equal(job.result!.days[0].source, "broker");
  assert.ok(service.archive(DAY));
  assert.equal(JSON.stringify(f.controller.session), before);
  assert.equal(f.broker.submitted.length, 0);
});

test('backtest report and pinned datasets survive a service restart', async () => {
  const f = await fixture(), repo = new Repository();
  const context = () => ({ connected: false, account: null, session: null });
  const now = () => istTime('2026-10-27', '10:00');
  const first = new Backtests(f.broker, context, repo, now);
  first.import(input(complete()));
  const finished = await done(first, first.start({ startDate: DAY, endDate: DAY }).id);
  const second = new Backtests(f.broker, context, repo, now);
  assert.deepEqual(second.latest(), finished);
  assert.deepEqual(second.job(finished.id).result, finished.result);
  assert.deepEqual(second.jobDataset(finished.id, DAY), first.jobDataset(finished.id, DAY));
  assert.equal(f.broker.submitted.length, 0);
});

test('an interrupted stored backtest is reported as interrupted, never complete', async () => {
  const f = await fixture(), repo = new Repository();
  repo.put('backtest:v2:job-index', ['interrupted']);
  repo.put('backtest:v2:job:interrupted', { job: { id: 'interrupted', status: 'running', completed: 0, total: 1, message: 'Checking', result: null }, datasets: [] });
  const restarted = new Backtests(f.broker, () => ({ connected: false, account: null, session: null }), repo);
  assert.equal(restarted.latest()!.status, 'failed');
  assert.match(restarted.latest()!.message, /restarted/);
  assert.equal(restarted.latest()!.result, null);
});

test('a 15:10 boundary close cannot stand in for the missing cutoff open', () => {
  const result = replay(input(complete().slice(0, -1)), ZERO)
  assert.equal(result.asOf, istTime(DAY, '15:10'))
  assert.equal(result.status, 'partial')
  assert.equal(result.fills.some(fill => fill.reason === 'SESSION_END'), false)
  assert.equal(result.cycles[0].remaining, 195)
})

test('cutoff gaps use the observed open, never the previous close or cutoff candle future high', () => {
  const candles = complete()
  candles[candles.length - 1] = [80, 200, 70, 190]
  const result = replay(input(candles), ZERO)
  assert.equal(result.fills.at(-1)!.price, 80)
  assert.equal(result.fills.at(-1)!.timing, 'cutoff-open')
  assert.equal(result.grossPnl, -4095)
  assert.equal(result.fills.filter(fill => fill.reason.startsWith('TARGET')).length, 0)
})

test('gap target fills and uncertain intrabar touches have distinct honest timestamps', () => {
  const gap = replay(input([reference, signal, next, [150, 155, 145, 151]]), ZERO)
  assert.ok(gap.fills.filter(fill => fill.reason.startsWith('TARGET')).every(fill => fill.timing === 'gap-open' && fill.at === istTime(DAY, '09:30')))
  const touch = replay(input([reference, signal, [100, 150, 95, 101]]), ZERO)
  assert.ok(touch.fills.filter(fill => fill.reason.startsWith('TARGET')).every(fill => fill.timing === 'intrabar-unknown'))
})

test('a shorter PUT series caps both legs at the last common completed candle', () => {
  const values = complete(), result = replay(input(values, values.slice(0, 3)), ZERO)
  assert.equal(result.status, 'partial')
  assert.equal(result.asOf, istTime(DAY, '09:30'))
  assert.equal(result.fills.some(fill => fill.at > result.asOf), false)
  assert.equal(result.fills.some(fill => fill.reason === 'SESSION_END'), false)
})

test('hand-calculated stop and re-entry ledger reconciles quantities, fees and marked P&L', () => {
  const data = input([reference, signal, [105, 110, 98, 99], [95, 110, 90, 101], [103, 110, 100, 104]])
  const before = JSON.stringify(data), result = replay(data, { slippagePoints: 0, feePerOrder: 2 })
  assert.deepEqual(result.fills.map(fill => [fill.reason, fill.price, fill.quantity]), [['BREAKOUT', 105, 195], ['LOWER_CLOSE', 95, 195], ['BREAKOUT', 103, 195]])
  assert.equal(result.grossPnl, -1950)
  assert.equal(result.fees, 6)
  assert.equal(result.openPnl, 195)
  assert.equal(result.markedNetPnl, -1761)
  assert.equal(JSON.stringify(data), before)
  assert.deepEqual(replay(data, { slippagePoints: 0, feePerOrder: 2 }), result)
})

test('old engine reports are not restored into rebuilt backtesting', async () => {
  const f = await fixture(), repo = new Repository()
  repo.put('backtest:job-index', ['old'])
  repo.put('backtest:job:old', { job: { id: 'old', status: 'complete', result: { engine: 'old' } }, datasets: [] })
  const rebuilt = new Backtests(f.broker, () => ({ connected: false, account: null, session: null }), repo)
  assert.equal(rebuilt.latest(), null)
})
