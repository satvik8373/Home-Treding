import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse } from 'csv-parse/sync'
import type { AddressInfo } from 'node:net'
import { tradesReport, ordersReport, csvRows, istFields, backtestDaysReport, backtestTradesReport } from '../server/reports.ts'
import { createApp } from '../server/http.ts'
import { DEFAULT_SETTINGS } from '../shared/settings.ts'
import type { BacktestReport } from '../shared/backtest.ts'
import { fixture } from './helpers.ts'
const rows = (body: string): Record<string, string>[] => parse(body, { columns: true, bom: true })

test('CSV retains numeric losses, escapes text formulas and round-trips quotes and newlines', () => {
  const data = rows(csvRows(['loss', 'text', 'detail'], [{ loss: -123.5, text: ' \t=HYPERLINK("bad")', detail: 'first,"quoted"\nsecond' }]))
  assert.equal(data[0].loss, '-123.5')
  assert.equal(data[0].text[0], "'")
  assert.equal(data[0].detail, 'first,"quoted"\nsecond')
  assert.equal(istFields(Date.parse('2026-11-05T18:31:02.123Z')).fill_datetime_ist, '2026-11-06 00:01:02.123')
})

test('trade report links partial exits, uses opening reference stop and never invents charges', async () => {
  const f = await fixture(); await f.start('paper')
  const s = f.controller.session!, at = Date.parse('2026-10-26T04:00:00.123Z')
  s.settings = { ...DEFAULT_SETTINGS, feePerOrderEstimate: 2 }
  const base = { at, side: 'CE' as const, symbol: s.legs.CE!.contract.symbol, orderId: 'PAPER-1', mode: 'paper' as const }
  s.trades = [
    { ...base, id: 'buy', transaction: 'BUY', quantity: 260, price: 110, reason: 'BREAKOUT', pnl: null },
    { ...base, at: at + 1000, id: 'sell1', transaction: 'SELL', quantity: 130, price: 130, reason: 'TARGET_1', pnl: 2600 },
    { ...base, at: at + 2000, id: 'sell2', transaction: 'SELL', quantity: 130, price: 90, reason: 'LOWER_CLOSE', pnl: -2600 },
  ]
  const data = rows(tradesReport(s, at).body)
  assert.equal(data[0].fill_datetime_ist, '2026-10-26 09:30:00.123')
  assert.equal(data[0].fill_time_utc, '2026-10-26T04:00:00.123Z')
  assert.equal(data[1].remaining_cycle_units, '130'); assert.equal(data[2].remaining_cycle_units, '0')
  assert.equal(data[2].cycle_id, 'buy'); assert.equal(data[2].entry_price_inr, '110')
  assert.equal(data[0].reference_stop_inr, '75'); assert.equal(data[0].target1_price_inr, '130')
  assert.equal(data[2].realized_gross_pnl_inr, '-2600')
  assert.equal(data[2].cumulative_pnl_after_estimated_fees_inr, '-6')
  assert.equal(data[2].actual_broker_charges_inr, '')
  assert.match(data[0].timestamp_basis, /simulation/)
  assert.doesNotMatch(tradesReport(s).body, /test-key|test-token/)
  s.trades = [{ ...s.trades[2], mode: 'live' }]
  const orphan = rows(tradesReport(s).body)[0]
  assert.equal(orphan.entry_price_inr, ''); assert.match(orphan.cycle_match, /UNMATCHED/)
  assert.match(orphan.timestamp_basis, /exchange fill time not captured/)
})

test('pending intent appears only in order report and exports are read-only', async t => {
  const f = await fixture(); await f.start('paper')
  const s = f.controller.session!
  s.pending = { id: 'pending', tag: 'tag', symbol: s.legs.CE!.contract.symbol, side: 'CE', transaction: 'BUY', quantity: 260, reason: 'BREAKOUT', submittedAt: f.now() }
  assert.equal(rows(tradesReport(s).body).length, 0)
  const audit = rows(ordersReport(s).body)[0]
  assert.equal(audit.status, 'unknown'); assert.equal(audit.confirmed_filled_units, '')
  assert.match(audit.submitted_datetime_ist, /^2026-10-26 /)
  const before = JSON.stringify(s)
  const server = createApp(f.controller, process.cwd()).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  for (const kind of ['trades', 'orders']) {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/${kind}.csv`)
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /text\/csv/)
    assert.match(response.headers.get('content-disposition')!, new RegExp(`009-buy-paper-${kind}-2026-10-26.csv`))
  }
  assert.equal(JSON.stringify(s), before); assert.equal(f.broker.submitted.length, 0); assert.equal(f.broker.cancellations.length, 0)
})

test('backtest CSV marks proxy timestamps and excluded dates have blank performance', () => {
  const at = Date.parse('2026-11-05T04:00:00Z')
  const report = { engine: 'test', startDate: '2026-11-05', endDate: '2026-11-06', options: { strategySettings: DEFAULT_SETTINGS, slippagePoints: 0.05, feePerOrder: 0 }, skipped: [{ date: '2026-11-06', reason: 'Missing original option candles' }], days: [{ date: '2026-11-05', source: 'import', status: 'partial', asOf: at, lotSize: 65, reference: { CE: { close: 100, upper: 100.09, lower: 99.91 } }, fills: [{ id: 'f', cycleId: 'c', at, side: 'CE', symbol: 'CE', transaction: 'BUY', quantity: 260, price: 100, reason: 'BREAKOUT', fee: 0, grossPnl: null, timing: 'intrabar-unknown' }], cycles: [{ id: 'c', entryAt: at, entryPrice: 100, remaining: 260 }] }] } as unknown as BacktestReport
  const fill = rows(backtestTradesReport(report, 'job').body)[0]
  assert.match(fill.timestamp_basis, /proxy/); assert.equal(fill.reference_stop_inr, '75')
  const daily = rows(backtestDaysReport(report).body)
  assert.equal(daily.length, 2); assert.equal(daily[1].status, 'EXCLUDED')
  assert.equal(daily[1].gross_realized_pnl_inr, ''); assert.match(daily[1].reason, /Missing/)
})
