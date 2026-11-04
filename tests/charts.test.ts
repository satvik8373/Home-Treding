import { test } from "node:test";
import assert from "node:assert/strict";
import { MarketCharts } from "../server/charts.ts";
import { MStock } from "../server/broker.ts";
import { chartCandles, chartTime, tradeMarkers } from "../src/lib/chartData.ts";
import { bar, contract, DAY, fixture } from "./helpers.ts";
import { istTime } from "../server/time.ts";
import type { Trade, TradingSession } from "../shared/model.ts";

function chartFixture() {
  let time = istTime(DAY, "10:00"),
    account = "account-a",
    fail = false;
  const requests: string[] = [],
    calls = { history: 0, quote: 0 };
  const broker = {
    async history() {
      calls.history++;
      if (fail) throw new Error("Upstream unavailable");
      return [bar("09:15"), bar("09:20", 101)];
    },
    async request(path: string) {
      requests.push(path);
      calls.quote++;
      if (fail) throw new Error("Quote outage");
      return {
        "NSE:NIFTY 50": {
          last_price: 25050,
          ohlc: { open: 25000, high: 25100, low: 24900, close: 24950 },
        },
      };
    },
  };
  const context = {
    connected: true,
    account: "account-a",
    session: null as TradingSession | null,
  };
  const service = new MarketCharts(
    broker,
    () => ({ ...context, account }),
    () => time,
  );
  return {
    service,
    calls,
    requests,
    context,
    now: () => time,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
    account: (next: string) => {
      account = next;
    },
    fail: () => {
      fail = true;
    },
  };
}

test("concurrent chart requests share upstream reads and preserve rate-limited history cache", async () => {
  const f = chartFixture();
  const [first, second] = await Promise.all([
    f.service.read("NIFTY"),
    f.service.read("NIFTY"),
  ]);
  assert.equal(f.calls.history, 1);
  assert.equal(f.calls.quote, 1);
  assert.deepEqual(first, second);
  assert.equal(first.quote!.previousClose, 24950);
  f.advance(3000);
  await f.service.read("NIFTY");
  assert.equal(f.calls.history, 1);
  assert.equal(f.calls.quote, 2);
  assert.equal(
    f.requests.every((path) => path.startsWith("/instruments/quote/ohlc?")),
    true,
  );
});
test("chart outages retain received timestamps and display stale history explicitly", async () => {
  const f = chartFixture(),
    first = await f.service.read("NIFTY");
  f.advance(20_000);
  f.fail();
  const stale = await f.service.read("NIFTY");
  assert.deepEqual(stale.candles, first.candles);
  assert.equal(stale.quote!.receivedAt, first.quote!.receivedAt);
  assert.equal(stale.historyUpdatedAt, first.historyUpdatedAt);
  assert.equal(stale.serverTime - stale.quote!.receivedAt, 20_000);
  assert.match(stale.warning!, /history is delayed/);
  assert.match(stale.warning!, /Live quote is unavailable/);
});
test("new accounts cannot reuse cached chart responses or another account’s option contracts", async () => {
  const f = chartFixture();
  await f.service.read("NIFTY");
  f.account("account-b");
  await f.service.read("NIFTY");
  assert.equal(f.calls.history, 2);
  assert.equal(f.calls.quote, 2);
  const session = {
    date: DAY,
    account: "account-a",
    legs: { CE: { contract: contract("CE") } },
  } as TradingSession;
  f.context.session = session;
  await assert.rejects(() => f.service.read("CE"), /lock/);
});
test("index chart works before a strategy starts; option chart cannot select or start a strategy", async () => {
  const f = chartFixture();
  const chart = await f.service.read("NIFTY");
  assert.equal(chart.token, "26000");
  await assert.rejects(() => f.service.read("CE"), /Start the strategy/);
  assert.equal(f.context.session, null);
  f.context.connected = false;
  await assert.rejects(() => f.service.read("NIFTY"), /Connect mStock/);
});
test("display can include the broker’s forming candle; signal history stays completed-only", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        status: "success",
        data: {
          candles: [
            [`${DAY}T09:15:00+05`, 100, 110, 90, 100],
            [`${DAY}T09:20:00+05`, 100, 110, 90, 101],
          ],
        },
      }),
    );
  const first = new MStock(fakeFetch),
    second = new MStock(fakeFetch);
  const credentials = {
    apiKey: "test",
    accessToken: "test",
    account: "test",
    name: "Test",
    expiresAt: Date.now() + 60_000,
  };
  first.credentials = credentials;
  second.credentials = credentials;
  assert.equal(
    (await first.history("1", "NFO", DAY, istTime(DAY, "09:23"))).length,
    1,
  );
  assert.equal(
    (await second.history("1", "NFO", DAY, istTime(DAY, "09:23"), true)).length,
    2,
  );
});
test("chart time is IST presentation only; candle ordering, duplicates and invalid rows are handled", () => {
  const opening = bar("09:15");
  assert.equal(
    new Date(chartTime(opening.start) * 1000).toISOString().slice(11, 16),
    "09:15",
  );
  assert.equal(opening.start, istTime(DAY, "09:15"));
  const candles = chartCandles([
    bar("09:20"),
    opening,
    { ...opening, close: 101 },
    { ...bar("09:25"), high: -1 },
  ]);
  assert.equal(candles.length, 2);
  assert.equal(candles[0].close, 101);
  assert.ok(candles[0].time < candles[1].time);
});
test("fill markers group real fills by matching contract and candle without inventing trades", () => {
  const start = istTime(DAY, "09:25");
  const trade = {
    at: start + 1000,
    symbol: "NIFTY-TEST-CE",
    transaction: "BUY",
    quantity: 65,
  } as Trade;
  const markers = tradeMarkers(
    [
      trade,
      { ...trade, quantity: 130 },
      { ...trade, symbol: "NIFTY-TEST-PE" },
      { ...trade, at: start + 600_000 },
    ],
    [bar("09:25")],
    trade.symbol,
  );
  assert.equal(markers.length, 1);
  assert.equal(markers[0].text, "BUY 195");
  assert.equal(markers[0].time, chartTime(start));
});
test("chart reads do not alter an active strategy or submit orders", async () => {
  const f = await fixture();
  await f.start("paper");
  const before = JSON.stringify(f.controller.session);
  const broker = {
    history: f.broker.history.bind(f.broker),
    request: async () => ({
      "NFO:NIFTY-TEST-CE": { last_price: 101, ohlc: {} },
    }),
  };
  const service = new MarketCharts(
    broker,
    () => ({
      connected: true,
      account: "test-account",
      session: f.controller.session,
    }),
    f.now,
  );
  const chart = await service.read("CE");
  assert.equal(chart.symbol, "CE");
  assert.equal(JSON.stringify(f.controller.session), before);
  assert.equal(f.broker.submitted.length, 0);
});

test('a stalled history download cannot delay a fresh chart quote', async () => {
  let release!: (bars: ReturnType<typeof bar>[]) => void;
  const pending = new Promise<ReturnType<typeof bar>[]>(resolve => { release = resolve });
  const service = new MarketCharts({ history: async () => pending, request: async () => ({ 'NSE:NIFTY 50': { last_price: 25000, ohlc: {} } }) },
    () => ({ connected: true, account: 'test', session: null }), () => istTime(DAY, '10:00'), 5);
  const first = await service.read('NIFTY');
  assert.equal(first.quote!.price, 25000);
  assert.equal(first.historyLoading, true);
  assert.deepEqual(first.candles, []);
  release([bar('09:15')]);
  await new Promise(resolve => setImmediate(resolve));
  const second = await service.read('NIFTY');
  assert.equal(second.historyLoading, false);
  assert.equal(second.candles.length, 1);
});

test('CALL/PUT previews use the official opening close without starting the strategy', async () => {
  let masters = 0;
  const service = new MarketCharts({
    history: async () => [bar('09:15')],
    contracts: async (_date, spot) => { masters++; assert.equal(spot, 100); return [contract('CE'), contract('PE')] },
    request: async () => ({ 'NFO:NIFTY-TEST-CE': { last_price: 100, ohlc: {} }, 'NFO:NIFTY-TEST-PE': { last_price: 101, ohlc: {} } }),
  }, () => ({ connected: true, account: 'test', session: null }), () => istTime(DAY, '10:00'));
  const [ce, pe] = await Promise.all([service.read('CE'), service.read('PE')]);
  assert.equal(masters, 1);
  assert.equal(ce.preview, true); assert.equal(pe.preview, true);
  assert.equal(ce.contract!.lotSize, 65); assert.equal(pe.quote!.price, 101);
  assert.equal(ce.token, contract('CE').token);
});

test('option previews before the opening reference completes do not guess an ATM', async () => {
  const service = new MarketCharts({ history: async () => [], request: async () => ({}), contracts: async () => { throw new Error('Must not resolve before 09:20') } },
    () => ({ connected: true, account: 'test', session: null }), () => istTime(DAY, '09:19'));
  await assert.rejects(() => service.read('CE'), /09:20/);
});
