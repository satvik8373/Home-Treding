import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HistoricalData } from '../server/backtest/historical.ts'
import { MemoryRepository, Backtests } from '../server/backtest/service.ts'
import { contract, DAY } from './helpers.ts'
import { istTime } from '../server/time.ts'
import type { Candle } from '../shared/model.ts'
import { pastTwoMonths } from '../shared/history.ts'
import { dateRange } from '../server/backtest/validation.ts'


const TODAY = '2026-10-28', NOW = istTime(TODAY, '16:00')
function setup() {
  const repo = new MemoryRepository(), calls: string[] = []
  const bars: Candle[] = Array.from({ length: 75 }, (_, i) => ({ start: istTime(DAY, '09:15') + i * 300_000, end: istTime(DAY, '09:20') + i * 300_000, open: 100, high: 110, low: 90, close: 100 }))
  const context = { connected: true, account: 'test-account', session: null }
  const broker = {
    async history(token: string, _exchange: string, date: string) { calls.push(`${date}:${token}`); return bars.map(bar => ({ ...bar, start: bar.start + Date.parse(date) - Date.parse(DAY), end: bar.end + Date.parse(date) - Date.parse(DAY) })) },
    async contracts() { calls.push('current-master'); return [contract('CE'), contract('PE')] as [ReturnType<typeof contract>, ReturnType<typeof contract>] },
  }
  const service = new HistoricalData(broker, () => context, repo, () => NOW)
  return { repo, calls, bars, context, broker, service }
}
async function done(service: HistoricalData, id: string) {
  for (let i = 0; i < 100; i++) {
    const job = service.job(id)
    if (job.status !== 'running') return job
    await new Promise(resolve => setImmediate(resolve))
  }
  throw new Error('Historical job did not settle')
}

test('past spot data is fetched and saved without substituting today’s contracts', async () => {
  const f = setup(), job = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  assert.equal(job.rows[0].status, 'spot_only')
  assert.equal(job.rows[0].spotBars, 75)
  assert.equal(f.service.spot(DAY)!.candles.length, 75)
  assert.deepEqual(f.calls, [`${DAY}:26000`])
  assert.equal(f.repo.get(`backtest:archive:${DAY}`), null)
})

test('original contract metadata enables past option API downloads and normal backtesting', async () => {
  const f = setup()
  f.service.importContracts({ version: 1, days: [{ date: DAY, contracts: { CE: contract('CE'), PE: contract('PE') } }] })
  const job = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  assert.equal(job.rows[0].status, 'ready')
  assert.equal(job.rows[0].contractSource, 'import')
  assert.match(job.rows[0].message, /user-supplied/)
  assert.deepEqual(f.calls, [`${DAY}:26000`, `${DAY}:101`, `${DAY}:102`])
  const backtests = new Backtests(f.broker, () => f.context, f.repo, () => NOW)
  const testJob = backtests.start({ startDate: DAY, endDate: DAY })
  for (let i = 0; i < 10 && backtests.job(testJob.id).status === 'running'; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(backtests.job(testJob.id).result!.summary.completeSessions, 1)
})

test('only an exact-day archived master can select historical ATM contracts', async () => {
  const f = setup()
  const catalog = { date: DAY, contracts: [contract('CE'), contract('PE')] }
  f.repo.put('history:master:2026-10-23', catalog)
  const first = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  assert.equal(first.rows[0].status, 'spot_only')
  f.repo.put(`history:master:${DAY}`, catalog)
  const second = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  assert.equal(second.rows[0].status, 'ready')
  assert.equal(second.rows[0].contractSource, 'master-snapshot')
})

test('failed or gapped option downloads retain spot data without creating a backtest archive', async () => {
  const f = setup(), history = f.broker.history.bind(f.broker)
  f.service.importContracts({ version: 1, days: [{ date: DAY, contracts: { CE: contract('CE'), PE: contract('PE') } }] })
  f.broker.history = async (token, exchange, date) => (await history(token, exchange, date)).filter((_bar, index) => token !== '101' || index !== 2)
  const job = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  assert.equal(job.rows[0].status, 'spot_only')
  assert.match(job.rows[0].message, /missing five-minute candle/)
  assert.equal(f.repo.get(`backtest:archive:${DAY}`), null)
  assert.equal(f.service.spot(DAY)!.candles.length, 75)
})

test('weekends are skipped and malformed ranges and metadata are rejected before reads', async () => {
  const f = setup()
  const job = await done(f.service, f.service.start({ startDate: '2026-10-25', endDate: '2026-10-25' }).id)
  assert.equal(job.rows[0].status, 'skipped')
  assert.equal(f.calls.length, 0)
  assert.throws(() => f.service.start({ startDate: '2026-06-01', endDate: TODAY }), /93/)
  assert.throws(() => f.service.importContracts({ version: 1, days: [{ date: DAY, contracts: { CE: contract('CE'), PE: { ...contract('PE'), strike: 99 } } }] }), /same historical/)
})

test('account changes discard in-flight option data and jobs survive restarts', async () => {
  const f = setup(), history = f.broker.history.bind(f.broker)
  f.broker.history = async (token, exchange, date) => { const bars = await history(token, exchange, date); f.context.account = 'different'; return bars }
  const job = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  assert.equal(job.status, 'failed')
  assert.equal(f.service.spot(DAY), null)
  const restored = new HistoricalData(f.broker, () => f.context, f.repo, () => NOW)
  assert.equal(restored.latest()!.id, job.id)
  assert.equal(f.repo.get(`backtest:archive:${DAY}`), null)
})

test('today’s master is archived and can resolve that exact date after it becomes historical', async () => {
  const f = setup(), pair = [contract('CE'), contract('PE')].map(item => ({ ...item, expiry: '2026-10-30' }));
  const broker = { ...f.broker, catalog: async () => ({ date: TODAY, contracts: pair }), contracts: async () => [pair[0], pair[1]] as [typeof pair[number], typeof pair[number]] };
  const first = new HistoricalData(broker, () => f.context, f.repo, () => NOW);
  assert.equal((await done(first, first.start({ startDate: TODAY, endDate: TODAY }).id)).rows[0].status, 'ready');
  assert.ok(f.repo.get(`history:master:${TODAY}`));
  f.repo.put(`backtest:archive:${TODAY}`, null);
  const next = new HistoricalData(f.broker, () => f.context, f.repo, () => istTime('2026-10-29', '10:00'));
  const job = await done(next, next.start({ startDate: TODAY, endDate: TODAY }).id);
  assert.equal(job.rows[0].status, 'ready');
  assert.equal(job.rows[0].contractSource, 'master-snapshot');
});

test('two-month preset respects IST midnight and shorter target months; server accepts the whole range', () => {
  assert.deepEqual(pastTwoMonths(istTime('2026-11-04', '00:01')), { startDate: '2026-09-04', endDate: '2026-11-03' })
  assert.deepEqual(pastTwoMonths(istTime('2026-04-30', '00:01')), { startDate: '2026-02-28', endDate: '2026-04-29' })
  assert.deepEqual(pastTwoMonths(istTime('2026-01-01', '00:01')), { startDate: '2025-11-01', endDate: '2025-12-31' })
  assert.equal(dateRange('2026-09-04', '2026-11-03', istTime('2026-11-04', '12:00')).length, 61)
  assert.equal(dateRange('2026-08-03', '2026-11-03', istTime('2026-11-04', '12:00')).length, 93)
})

test('retry reuses complete spot days and bundle exports real coverage without inventing option candles', async () => {
  const f = setup()
  await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  const job = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id)
  assert.equal(f.calls.length, 1)
  assert.equal(job.startDate, DAY)
  assert.equal(job.endDate, DAY)
  const bundle = f.service.bundle(job.id)
  assert.equal(bundle.days[0].spot!.candles.length, 75)
  assert.equal(bundle.days[0].options, null)
  assert.equal(bundle.days[0].coverage, 'spot_only')
  assert.throws(() => f.service.bundle('other-job'), /no longer/)
})

test('verified NSE holidays are skipped without broker requests or misleading data failures', async () => {
  const f = setup()
  for (const date of ['2026-09-14', '2026-10-02', '2026-10-20']) {
    const job = await done(f.service, f.service.start({ startDate: date, endDate: date }).id)
    assert.equal(job.rows[0].status, 'skipped')
    assert.match(job.rows[0].message, /NSE holiday/)
  }
  assert.equal(f.calls.length, 0)
  const service = new Backtests(f.broker, () => f.context, f.repo, () => NOW)
  const job = service.start({ startDate: '2026-10-20', endDate: '2026-10-20' })
  await new Promise(resolve => setImmediate(resolve))
  assert.match(service.job(job.id).result!.skipped[0].reason, /Dussehra/)
})

test('a partial refresh cannot replace a complete broker option archive', async () => {
  const f = setup(), history = f.broker.history.bind(f.broker);
  f.service.importContracts({ version: 1, days: [{ date: DAY, contracts: { CE: contract('CE'), PE: contract('PE') } }] });
  await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id);
  const original = f.repo.get(`backtest:archive:${DAY}`);
  f.broker.history = async (token, exchange, date) => (await history(token, exchange, date)).slice(0, token === '26000' ? 75 : 1);
  const job = await done(f.service, f.service.start({ startDate: DAY, endDate: DAY }).id);
  assert.equal(job.rows[0].status, 'ready');
  assert.match(job.rows[0].message, /complete broker archive retained/);
  assert.deepEqual(f.repo.get(`backtest:archive:${DAY}`), original);
});

test('rebuilt backtesting uses one fetch-and-replay job and reports spot-only ranges as needs-data', async () => {
  const f = setup(), service = new Backtests(f.broker, () => f.context, f.repo, () => NOW, f.service)
  const started = service.start({ startDate: DAY, endDate: DAY })
  let job = service.job(started.id)
  for (let i = 0; i < 100 && job.status === 'running'; i++) { await new Promise(resolve => setImmediate(resolve)); job = service.job(started.id) }
  assert.equal(job.status, 'blocked')
  assert.equal(job.result!.engine, 'nifty-009-ohlc-v3')
  assert.equal(job.result!.summary.sessions, 0)
  assert.equal(f.service.spot(DAY)!.candles.length, 75)
  assert.deepEqual(f.calls, [`${DAY}:26000`])
})
