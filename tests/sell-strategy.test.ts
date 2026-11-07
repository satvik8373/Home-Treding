import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse } from 'csv-parse/sync'
import { SELL_DEFAULT_SETTINGS, DEFAULT_SETTINGS, settingsFor } from '../shared/settings.ts'
import { targetPrice } from '../shared/targets.ts'
import { signFor } from '../shared/strategy.ts'
import { levels, candleSignal, observeReentry, targetSignal, stopLossSignal, applyFill } from '../server/strategy.ts'
import { replay } from '../server/backtest/replay.ts'
import { dataset } from '../server/backtest/validation.ts'
import { Controller } from '../server/controller.ts'
import { tradesReport } from '../server/reports.ts'
import { sessionMoney } from '../shared/transparency.ts'
import { fixture, DAY, bar, contract } from './helpers.ts'
import { istTime } from '../server/time.ts'
import type { Leg, OrderIntent } from '../shared/model.ts'
import type { StrategySettings } from '../shared/settings.ts'
import { createApp } from '../server/http.ts'
import type { AddressInfo } from 'node:net'
import { Store } from '../server/store.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sell = { ...SELL_DEFAULT_SETTINGS, enabledSides: ['CE'] as ('CE' | 'PE')[] }
const leg = (): Leg => ({ contract: contract('CE'), reference: bar('09:15'), ...levels(100, sell), position: null, realized: 0, entries: 0, lastCandleEnd: istTime(DAY, '09:20'), exitReason: null })
const tick = () => new Promise<void>(resolve => setImmediate(resolve))
async function start(f: Awaited<ReturnType<typeof fixture>>, mode: 'paper' | 'live' = 'paper') {
  f.controller.saveStrategySettings(sell)
  await f.controller.start(mode, 'sell')
  for (let i = 0; i < 25; i++) await tick()
  assert.equal(f.controller.session!.settings!.direction, 'sell')
}
async function signal(f: Awaited<ReturnType<typeof fixture>>, time = '09:20', close = 99) {
  f.setTime(istTime(DAY, time) + 303_000)
  f.broker.candles.set('101', [bar('09:15'), bar(time, close)])
  f.broker.candles.set('102', [bar('09:15'), bar(time, 100)])
  f.mark('CE', close); f.mark('PE', 100)
  await f.controller.pump(); for (let i = 0; i < 20; i++) await tick()
}

test('Sell mirrors entry, protective close, reference stop and fresh-cross re-entry', () => {
  const l = leg(), now = istTime(DAY, '09:25')
  assert.deepEqual(levels(100, sell), { upper: 100.09, lower: 99.91 })
  assert.equal(candleSignal(l, bar('09:20', 99.91), now, DAY, sell), 'BREAKOUT')
  assert.equal(candleSignal(l, bar('09:20', 100), now, DAY, sell), null)
  l.position = { average: 90, quantity: 260, entryQuantity: 260, target1Remaining: 130 }
  assert.equal(candleSignal(l, bar('09:20', 100.10), now, DAY, sell), 'UPPER_CLOSE')
  assert.equal(candleSignal(l, bar('09:20', 100.09), now, DAY, sell), null)
  assert.equal(stopLossSignal(l, 115, sell), null, 'entry +25 is not the opening-reference stop')
  assert.equal(stopLossSignal(l, 125, sell), 'STOP_LOSS')
  assert.equal(targetSignal(l, 70, sell), 'TARGET_1')
  l.position = null; l.entries = 1; l.lastExitAt = istTime(DAY, '09:30')
  observeReentry(l, bar('09:30', 99), istTime(DAY, '09:35'), sell)
  assert.notEqual(l.reentryReady, true)
  observeReentry(l, bar('09:35', 100), istTime(DAY, '09:40'), sell)
  assert.equal(l.reentryReady, true)
  assert.equal(candleSignal(l, bar('09:40', 99.91), istTime(DAY, '09:45'), DAY, sell), null)
  assert.equal(candleSignal(l, bar('09:40', 99), istTime(DAY, '09:45'), DAY, sell), 'BREAKOUT')
})

test('Sell fills open with SELL and cover 2+2 lots with BUY; wrong transaction cannot mutate exposure', async () => {
  const f = await fixture(); await start(f)
  const s = f.controller.session!, at = f.now()
  const intent = (id: string, transaction: 'BUY' | 'SELL', reason: OrderIntent['reason'], quantity: number): OrderIntent => ({ id, tag: id, side: 'CE', symbol: contract('CE').symbol, submittedAt: at, transaction, reason, quantity })
  assert.throws(() => applyFill(s, intent('wrong', 'BUY', 'BREAKOUT', 260), { orderId: 'wrong', quantity: 260, average: 90, status: 'COMPLETE' }, at), /direction/)
  for (const [id, transaction, reason, quantity, price] of [['entry', 'SELL', 'BREAKOUT', 260, 90], ['t1', 'BUY', 'TARGET_1', 130, 70], ['t2', 'BUY', 'TARGET_2', 130, 50]] as const) applyFill(s, intent(id, transaction, reason, quantity), { orderId: id, quantity, average: price, status: 'COMPLETE' }, at)
  assert.equal(s.legs.CE!.position, null); assert.equal(s.legs.CE!.realized, 7800)
  const rows = parse(tradesReport(s).body, { bom: true, columns: true }) as Record<string, string>[]
  assert.deepEqual(rows.map((r: Record<string, string>) => r.remaining_cycle_units), ['260', '130', '0'])
  assert.equal(rows[0].strategy_direction, 'sell'); assert.equal(rows[0].reference_stop_inr, '125')
  assert.equal(rows[0].breakout_level_inr, '99.91'); assert.equal(rows[1].cycle_id, 'entry')
  assert.equal(rows[0].premium_cash_flow_inr, '23400')
  assert.equal(sessionMoney(s, {}, at)!.grossRealized, 7800)
})

test('fake live execution reconciles negative broker quantities, restart preserves short and Stop covers it', async () => {
  const f = await fixture(); await start(f, 'live')
  f.broker.plans.push({ average: 99 })
  await signal(f); await f.controller.pump()
  assert.equal(f.broker.submitted[0].transaction, 'SELL')
  assert.equal(f.broker.holdings.get(contract('CE').symbol), -260)
  const original = structuredClone(f.controller.session!)
  await f.controller.checkpointForRestart()
  const restored = new Controller(f.broker, f.store, f.feed, f.now)
  await restored.restore()
  assert.equal(restored.session!.id, original.id)
  assert.equal(restored.session!.status, 'running')
  assert.equal(restored.session!.legs.CE!.position!.quantity, 260)
  assert.equal(f.broker.submitted.length, 1)
  f.broker.plans.push({ average: 79 })
  restored.marks['101'] = { token: '101', price: 79, receivedAt: f.now(), source: 'websocket' }; await restored.pump(); await restored.pump()
  assert.equal(restored.session!.legs.CE!.position!.quantity, 130)
  assert.equal(f.broker.holdings.get(contract('CE').symbol), -130)
  assert.equal(restored.session!.legs.CE!.realized, 2600)
  f.broker.plans.push({ average: 85 })
  await restored.stop(); await restored.pump(); await restored.pump()
  assert.equal(f.broker.submitted.at(-1)!.transaction, 'BUY')
  assert.equal(f.broker.holdings.get(contract('CE').symbol), 0)
  assert.equal(restored.session!.legs.CE!.position, null)
})

test('paper upper-close exit covers a short and signed open P&L improves as premium falls', async () => {
  const f = await fixture(); await start(f); await signal(f)
  const s = f.controller.session!, entry = s.legs.CE!.position!.average
  f.mark('CE', entry - 5)
  assert.equal(sessionMoney(s, f.controller.marks, f.now())!.openPnl, 1300)
  await signal(f, '09:25', 101); await f.controller.pump()
  assert.equal(s.trades.at(-1)!.reason, 'UPPER_CLOSE')
  assert.equal(s.trades.at(-1)!.transaction, 'BUY'); assert.equal(s.legs.CE!.position, null)
  assert.equal(f.broker.submitted.length, 0)
})

test('Buy and Sell preferences and same-day sessions remain independent; simultaneous strategy starts are blocked', async () => {
  const f = await fixture()
  f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, entryLots: 5 })
  f.controller.saveStrategySettings({ ...sell, target1Points: 10 })
  assert.equal(f.controller.strategySettings('buy').entryLots, 5)
  assert.equal(f.controller.strategySettings('sell').entryLots, 4)
  await f.controller.start('paper', 'buy'); for (let i = 0; i < 20; i++) await tick()
  const buy = f.controller.session!.id
  await assert.rejects(f.controller.start('paper', 'sell'), /already running/)
  await f.controller.stop(); await f.controller.pump()
  await f.controller.start('paper', 'sell'); for (let i = 0; i < 20; i++) await tick()
  const short = f.controller.session!.id
  assert.notEqual(short, buy)
  await f.controller.stop(); await f.controller.pump()
  await f.controller.start('paper', 'buy'); for (let i = 0; i < 20; i++) await tick()
  assert.equal(f.controller.session!.id, buy)
  assert.equal(settingsFor(f.controller.session).entryLots, 5)
})

test('mirrored OHLC backtests preserve quantities, fees and profit with opposite transaction/slippage directions', () => {
  const values = [[100, 110, 90, 100], [100, 110, 99, 101], [100, 150, 95, 101], [101, 105, 98, 100]]
  function run(settings: StrategySettings, mirror: boolean) {
    const bars = values.map(([open, high, low, close], i) => ({ start: istTime(DAY, '09:15') + i * 300_000, end: istTime(DAY, '09:20') + i * 300_000, open: mirror ? 200 - open : open, high: mirror ? 200 - low : high, low: mirror ? 200 - high : low, close: mirror ? 200 - close : close }))
    const data = dataset({ version: 1, date: DAY, spotReferenceClose: 25000, contracts: { CE: contract('CE'), PE: contract('PE') }, candles: { CE: bars, PE: bars } }, istTime(DAY, '16:00'), 'import')
    return replay(data, { slippagePoints: 0.05, feePerOrder: 2, strategySettings: { ...settings, enabledSides: ['CE'], maxEntriesPerLeg: 1 } })
  }
  const buy = run(DEFAULT_SETTINGS, false), short = run(sell, true)
  assert.deepEqual(short.fills.map(f => f.transaction), ['SELL', 'BUY', 'BUY'])
  assert.deepEqual(short.fills.map(f => f.quantity), buy.fills.map(f => f.quantity))
  assert.equal(short.grossPnl, buy.grossPnl); assert.equal(short.fees, buy.fees)
  assert.equal(short.fills[0].price, 99.95)
  assert.equal(targetPrice({ ...sell, target1Rule: { kind: 'percent', value: 10 } }, 1, 200), 180)
  assert.equal(signFor(sell), -1)
})

test('Sell time targets cover at a loss and opposite-sign broker exposure fails closed', async () => {
  const l = leg(), entryAt = istTime(DAY, '09:25')
  l.position = { average: 90, quantity: 260, entryQuantity: 260, target1Remaining: 130, entryAt }
  const timed: StrategySettings = { ...sell, target1Rule: { kind: 'minutes', value: 10 } }
  assert.equal(targetSignal(l, 110, timed, entryAt + 599_999), null)
  assert.equal(targetSignal(l, 110, timed, entryAt + 600_000), 'TARGET_1')
  const f = await fixture(); await start(f, 'live'); await signal(f); await f.controller.pump()
  const count = f.broker.submitted.length
  f.broker.holdings.set(contract('CE').symbol, 260)
  f.setTime(f.now() + 16_000); f.mark('CE', 80)
  await f.controller.pump()
  assert.equal(f.controller.session!.status, 'blocked')
  assert.equal(f.broker.submitted.length, count)
})

test('SQLite archives preserve old Buy keys and independent Sell sessions across reopening', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-dual-strategy-'))
  const f = await fixture(); await start(f)
  const short = structuredClone(f.controller.session!)
  const buy = { ...structuredClone(short), id: 'legacy-buy', settings: { ...DEFAULT_SETTINGS } }
  let disk = new Store(directory)
  t.after(async () => { disk.close(); await rm(directory, { recursive: true, force: true }) })
  disk.saveSession(buy); disk.saveSession(short); disk.close(); disk = new Store(directory)
  assert.equal(disk.loadSession(buy.account, DAY, 'paper')!.id, 'legacy-buy')
  assert.equal(disk.loadSession(short.account, DAY, 'paper', 'sell')!.id, short.id)
})

test('HTTP profile saves and start selection stay explicit and CSRF protected', async t => {
  const f = await fixture(), server = createApp(f.controller, process.cwd()).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const state = await (await fetch(root + '/api/state')).json() as { csrf: string }
  const post = (path: string, body: object, csrf = state.csrf) => fetch(root + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-009-csrf': csrf }, body: JSON.stringify(body) })
  assert.equal((await post('/api/strategy/settings', sell, '')).status, 403)
  assert.equal((await post('/api/strategy/settings', sell)).status, 200)
  const profiles = await (await fetch(root + '/api/strategy/settings?strategy=sell')).json() as { saved: StrategySettings; profiles: { buy: StrategySettings } }
  assert.equal(profiles.saved.direction, 'sell')
  assert.notEqual(profiles.profiles.buy.direction, 'sell')
  assert.equal((await post('/api/strategy/start', { mode: 'paper', strategy: 'invalid' })).status, 400)
  assert.equal((await post('/api/strategy/start', { mode: 'paper', strategy: 'sell' })).status, 202)
  assert.equal(f.controller.session!.settings!.direction, 'sell')
  assert.equal(f.broker.submitted.length, 0)
})
