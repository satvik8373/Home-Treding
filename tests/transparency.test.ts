import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { DEFAULT_SETTINGS, settingsFor, validateSettings } from '../shared/settings.ts'
import { sessionMoney } from '../shared/transparency.ts'
import { applyFill, candleSignal, levels, orderQuantity, targetSignal } from '../server/strategy.ts'
import { Controller } from '../server/controller.ts'
import { AccountAudit } from '../server/audit.ts'
import { createApp } from '../server/http.ts'
import { MemoryRepository, Backtests } from '../server/backtest/service.ts'
import { replay } from '../server/backtest/replay.ts'
import { dataset } from '../server/backtest/validation.ts'
import { istTime } from '../server/time.ts'
import { DAY, bar, fixture } from './helpers.ts'
import type { OrderIntent, TradingSession } from '../shared/model.ts'

async function signal(f: Awaited<ReturnType<typeof fixture>>, time: string) {
  f.setTime(istTime(DAY, time) + 303_000)
  f.broker.candles.set('101', [bar('09:15'), bar(time, 101)])
  f.broker.candles.set('102', [bar('09:15'), bar(time, 99)])
  f.mark('CE', 101); f.mark('PE', 99)
  await f.controller.pump()
  for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve))
}

test('settings reject invalid quantities, percentages, leg sets and cutoff boundaries', () => {
  for (const changed of [{ entryLots: 0 }, { entryLots: 2.5 }, { target1Lots: 4 }, { target2Points: 10 }, { breakoutPercent: NaN }, { enabledSides: [] }, { enabledSides: ['CE', 'CE'] }, { cutoff: '15:11' }, { cutoff: '15:65' }, { cutoff: '09:25' }, { feePerOrderEstimate: -1 }]) {
    assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, ...changed }))
  }
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS)
})

test('new defaults buy 4 lots and sell 2 at each target; manual splits execute the saved quantities', async () => {
  assert.equal(DEFAULT_SETTINGS.entryLots, 4)
  assert.equal(DEFAULT_SETTINGS.target1Lots, 2)
  for (const [entryLots, firstLots] of [[4, 2], [5, 3]]) {
    const f = await fixture()
    f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, entryLots, target1Lots: firstLots, enabledSides: ['CE'] })
    await f.start('paper'); await signal(f, '09:20')
    const leg = f.controller.session!.legs.CE!, lot = leg.contract.lotSize
    assert.equal(leg.position!.quantity, entryLots * lot)
    f.mark('CE', 121); await f.controller.pump()
    assert.equal(leg.position!.quantity, (entryLots - firstLots) * lot)
    f.mark('CE', 141); await f.controller.pump()
    assert.equal(leg.position, null)
    assert.deepEqual(f.controller.session!.trades.map(trade => trade.quantity), [entryLots * lot, firstLots * lot, (entryLots - firstLots) * lot])
  }
  assert.equal(settingsFor({}).entryLots, 3, 'legacy sessions without a rule snapshot retain their original size')
})

test('adjusted rules control levels, entry size, disabled legs and a skipped first target', async () => {
  const f = await fixture(); await f.start('paper')
  const leg = f.controller.session!.legs.CE!, settings = validateSettings({ ...DEFAULT_SETTINGS, breakoutPercent: 1, exitPercent: 2, entryLots: 2, target1Lots: 0, target1Points: 5, target2Points: 10 })
  Object.assign(leg, levels(100, settings))
  assert.deepEqual({ upper: leg.upper, lower: leg.lower }, { upper: 101, lower: 98 })
  assert.equal(orderQuantity(leg, 'BREAKOUT', settings), 130)
  assert.equal(candleSignal(leg, bar('09:20', 100.5), istTime(DAY, '09:25'), DAY, settings), null)
  assert.equal(candleSignal(leg, bar('09:20', 101), istTime(DAY, '09:25'), DAY, settings), 'BREAKOUT')
  assert.equal(candleSignal(leg, bar('09:20', 101), istTime(DAY, '09:25'), DAY, { ...settings, enabledSides: ['PE'] }), null)
  f.controller.session!.settings = settings
  const intent: OrderIntent = { id: 'paper', tag: 'paper', side: 'CE', symbol: leg.contract.symbol, transaction: 'BUY', quantity: 130, reason: 'BREAKOUT', submittedAt: f.now() }
  applyFill(f.controller.session!, intent, { orderId: 'paper', quantity: 130, average: 100, status: 'COMPLETE' }, f.now())
  assert.equal(leg.position!.target1Remaining, 0)
  assert.equal(targetSignal(leg, 106, settings), null)
  assert.equal(targetSignal(leg, 110, settings), 'TARGET_2')
})

test('saving preferences cannot mutate a running session; changed preferences create a fresh archived session', async () => {
  const f = await fixture(); await f.start('paper')
  const oldId = f.controller.session!.id
  const saved = f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, entryLots: 4, target1Lots: 2 })
  assert.equal(saved.entryLots, 4)
  assert.equal(settingsFor(f.controller.session).entryLots, 3)
  await signal(f, '09:20')
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195)
  assert.equal(f.broker.submitted.length, 0)
  await f.controller.stop(); await f.controller.pump(); await f.controller.pump()
  assert.equal(f.controller.session!.status, 'stopped')
  await f.start('paper')
  assert.notEqual(f.controller.session!.id, oldId)
  assert.equal(f.controller.session!.settings!.entryLots, 4)
  assert.equal(f.store.get<TradingSession>(`session:history:${oldId}`)!.trades.length, 2)
  await signal(f, '09:25')
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 260)
  assert.equal(f.controller.session!.orderAudit!.at(-1)!.status, 'simulated')
  assert.match(f.controller.session!.orderAudit!.at(-1)!.orderId!, /^PAPER-/)
  assert.ok(f.controller.session!.decisionAudit!.length)
  assert.equal(f.broker.submitted.length, 0)
})

test('paper session recovery preserves positions and locked settings without creating broker orders', async () => {
  const f = await fixture(); await f.start('paper'); await signal(f, '09:20')
  const trades = f.controller.session!.trades.length
  const restored = new Controller(f.broker, f.store, f.feed, f.now)
  await restored.restore()
  assert.equal(restored.session!.status, 'running')
  assert.equal(restored.session!.legs.CE!.position!.quantity, 195)
  assert.equal(restored.session!.trades.length, trades)
  assert.equal(f.broker.submitted.length, 0)
  assert.equal(f.broker.cancellations.length, 0)
})

test('order audit preserves unknown submission and recovered rejection without inventing a fill or resending', async () => {
  const f = await fixture(); await f.start(); f.broker.timeoutSubmission = true
  await signal(f, '09:20')
  const order = f.controller.session!.orderAudit![0]
  assert.deepEqual(order.events!.map(event => event.status), ['submitting', 'unknown'])
  assert.equal(order.filled, null)
  f.broker.findOrder = async () => 'recovered'
  f.broker.order = async () => ({ orderId: 'recovered', quantity: 0, average: 0, status: 'Rejected', rejectionReason: 'Insufficient funds.' })
  await f.controller.reconcile()
  assert.deepEqual(order.events!.map(event => event.status), ['submitting', 'unknown', 'acknowledged', 'rejected'])
  assert.equal(order.orderId, 'recovered'); assert.equal(order.filled, 0)
  assert.equal(order.detail, 'Insufficient funds.')
  assert.equal(f.controller.session!.trades.length, 0)
  assert.equal(f.broker.submitted.length, 1); assert.equal(f.broker.cancellations.length, 0)
})

test('order audit distinguishes cancellation request from a confirmed terminal partial fill', async () => {
  const f = await fixture(); await f.start(); f.broker.plans.push({ pending: true })
  await signal(f, '09:20')
  const order = f.controller.session!.orderAudit![0]
  assert.equal(order.status, 'acknowledged'); assert.equal(order.filled, null)
  f.setTime(f.now() + 13_000); await f.controller.pump()
  assert.equal(order.status, 'cancel-requested'); assert.equal(order.filled, null)
  const pending = f.controller.session!.pending!
  f.broker.rows.get(pending.orderId!)!.fill = { orderId: pending.orderId!, quantity: 65, average: 102, status: 'CANCELLED' }
  f.setTime(f.now() + 2000); await f.controller.pump()
  assert.equal(order.status, 'partial-terminal'); assert.equal(order.filled, 65); assert.equal(order.average, 102)
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 65)
  assert.deepEqual(order.events!.map(event => event.status), ['submitting', 'acknowledged', 'cancel-requested', 'partial-terminal'])
})

test('paper cash math reconciles premiums, realized/open P&L and explicit estimates without inventing actual charges', async () => {
  const f = await fixture(); await f.start('paper')
  const session = f.controller.session!, symbol = session.legs.CE!.contract.symbol
  session.settings = { ...DEFAULT_SETTINGS, feePerOrderEstimate: 2 }
  session.trades = [
    { id: 'buy', orderId: 'PAPER-buy', at: f.now(), side: 'CE', symbol, transaction: 'BUY', quantity: 10, price: 20, reason: 'BREAKOUT', mode: 'paper', pnl: null },
    { id: 'sell', orderId: 'PAPER-sell', at: f.now(), side: 'CE', symbol, transaction: 'SELL', quantity: 5, price: 25, reason: 'TARGET_1', mode: 'paper', pnl: 25 },
  ]
  session.legs.CE!.position = { quantity: 5, average: 20, target1Remaining: 0, entryQuantity: 10 }
  const marks = { '101': { token: '101', price: 24, source: 'websocket' as const, receivedAt: f.now() } }
  const money = sessionMoney(session, marks, f.now())!
  assert.equal(money.buyPremiums, 200); assert.equal(money.sellProceeds, 125); assert.equal(money.premiumCashflow, -75)
  assert.equal(money.grossRealized, 25); assert.equal(money.openPnl, 20); assert.equal(money.grossMarked, 45)
  assert.equal(money.estimatedCosts, 4); assert.equal(money.estimatedNet, 41)
  assert.equal(money.paperRealDebit, 0); assert.equal(money.actualBrokerCharges, null); assert.equal(money.actualNetAfterCharges, null)
  assert.equal(sessionMoney(session, marks, f.now() + 100_000)!.grossMarked, null)
  session.pnlVerified = false
  assert.equal(sessionMoney(session, marks, f.now())!.grossRealized, null)
})

function sample() {
  const start = istTime(DAY, '09:15')
  const ce = Array.from({ length: 75 }, (_, i) => ({ start: start + i * 300_000, end: start + (i + 1) * 300_000, open: 100, high: i === 2 ? 115 : 105, low: 95, close: i === 0 ? 100 : 101 }))
  return { ce, pe: ce.map(bar => ({ ...bar, open: 100, high: 100, low: 100, close: 100 })) }
}

test('backtest uses the same custom quantity, target split, enabled legs, entry cap and cutoff', async () => {
  const f = await fixture(), bars = sample(), settings = validateSettings({ ...DEFAULT_SETTINGS, entryLots: 2, target1Lots: 0, target1Points: 5, target2Points: 10, enabledSides: ['CE'], maxEntriesPerLeg: 1, cutoff: '14:30' })
  const input = dataset({ version: 1, date: DAY, spotReferenceClose: 25000, contracts: { CE: { token: '101', symbol: 'NIFTY-TEST-CE', side: 'CE', expiry: '2026-10-27', strike: 25000, lotSize: 65 }, PE: { token: '102', symbol: 'NIFTY-TEST-PE', side: 'PE', expiry: '2026-10-27', strike: 25000, lotSize: 65 } }, candles: { CE: bars.ce, PE: bars.pe } }, istTime(DAY, '16:00'), 'import')
  const day = replay(input, { slippagePoints: 0, feePerOrder: 0, strategySettings: settings })
  assert.deepEqual(day.fills.map(fill => [fill.reason, fill.quantity]), [['BREAKOUT', 130], ['TARGET_2', 130]])
  assert.equal(day.grossPnl, 1300); assert.equal(day.asOf, istTime(DAY, '14:30'))
  const repo = new MemoryRepository(); repo.put('strategy:settings', settings)
  const service = new Backtests(f.broker, () => ({ connected: false, account: null, session: null }), repo, () => istTime('2026-10-27', '10:00'))
  service.import(input); const job = service.start({ startDate: DAY, endDate: DAY, options: { slippagePoints: 0, feePerOrder: 0 } })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(service.job(job.id).result!.options.strategySettings, settings)
})

test('audit exports retain local paper cash math when broker reads fail and never expose CSRF or credentials', async () => {
  const f = await fixture(); await f.start('paper')
  const audit = new AccountAudit({ read: async () => { throw new Error('private-token') } }, () => f.controller.snapshot('private-csrf'))
  const report = await audit.read(), json = JSON.stringify(report)
  assert.ok(report.brokerError)
  assert.equal(report.money!.paperRealDebit, 0)
  for (const privateValue of ['private-token', 'private-csrf', 'test-key', 'test-token']) assert.equal(json.includes(privateValue), false)
})

test('settings HTTP requires CSRF, preserves the running rule snapshot, shares backtest settings and exports read-only audits', async t => {
  const f = await fixture(); await f.start('paper')
  const repo = new MemoryRepository(), server = createApp(f.controller, process.cwd(), 4310, repo).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const state = await (await fetch(`${root}/api/state`)).json() as { csrf: string }
  const settings = { ...DEFAULT_SETTINGS, entryLots: 4, target1Lots: 2 }
  const post = (body: unknown, csrf = '') => fetch(`${root}/api/strategy/settings`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-009-csrf': csrf }, body: JSON.stringify(body) })
  assert.equal((await post(settings)).status, 403)
  assert.equal((await post(settings, state.csrf)).status, 200)
  assert.equal(f.controller.strategySettings().entryLots, 4)
  assert.equal(f.controller.session!.settings!.entryLots, 3)
  assert.equal(repo.get<typeof settings>('strategy:settings')!.entryLots, 4)
  assert.equal((await post({ ...settings, target1Lots: 4 }, state.csrf)).status, 400)
  const exported = await fetch(`${root}/api/audit/export`)
  assert.equal(exported.status, 200)
  assert.match(exported.headers.get('content-disposition')!, /009-account-audit.json/)
  const json = await exported.text()
  assert.equal(json.includes(state.csrf), false)
  assert.equal(json.includes('test-key'), false)
  assert.equal(f.broker.submitted.length, 0)
})
