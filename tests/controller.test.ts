import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS } from '../shared/settings.ts'
import { Controller } from '../server/controller.ts'
import { BrokerError } from '../server/broker.ts'
import { istTime } from '../server/time.ts'
import { bar, contract, DAY, fixture } from './helpers.ts'
import { Store } from '../server/store.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function candle(f: Awaited<ReturnType<typeof fixture>>, time: string, ce = 101, pe = 99) {
  f.setTime(istTime(DAY, time) + 300_000 + 3000)
  f.broker.candles.set('101', [bar('09:15'), bar(time, ce)])
  f.broker.candles.set('102', [bar('09:15'), bar(time, pe)])
  f.mark('CE', ce); f.mark('PE', pe)
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
}

test('Type A display-symbol NSE positions retain long/short quantities across restart and execute IST clock exits', async () => {
  for (const direction of ['buy', 'sell'] as const) for (const product of ['MIS', 'NRML'] as const) {
    const f = await fixture()
    f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, product, direction, enabledSides: ['CE'], target1Rule: { kind: 'clock', time: '09:30' }, target2Rule: { kind: 'clock', time: '09:35' } })
    f.broker.credentials!.permissions = { exchanges: ['NFO'], products: [product], orderTypes: ['MARKET'] }
    f.broker.contracts = async () => [
      { ...contract('CE'), symbol: 'NIFTY26O2725000CE' }, { ...contract('PE'), symbol: 'NIFTY26O2725000PE' },
    ]
    f.broker.positions = async () => [...f.broker.holdings].map(([symbol, quantity]) => ({
      symbol: `NIFTY-27Oct2026-25000-${symbol.endsWith('CE') ? 'CE' : 'PE'}`, exchange: 'NSE', product, quantity,
    }))
    await f.controller.start('live', direction)
    for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve))
    await candle(f, '09:20', direction === 'buy' ? 101 : 99, 100)
    assert.equal(f.controller.session!.legs.CE!.position?.quantity, 260)
    f.setTime(f.now() + 16_000); f.mark('CE', 100); await f.controller.pump()
    assert.equal(f.controller.session!.pnlVerified, true)
    assert.equal(f.controller.session!.legs.CE!.position?.quantity, 260)
    const restarted = new Controller(f.broker, f.store, f.feed, f.now)
    await restarted.restore()
    assert.equal(restarted.session!.pnlVerified, true)
    assert.equal(restarted.session!.status, 'running')
    assert.equal(restarted.session!.legs.CE!.position?.quantity, 260)
    assert.equal(f.broker.submitted.length, 1)
    for (const [time, remaining] of [['09:30', 130], ['09:35', 0]] as const) {
      f.setTime(istTime(DAY, time))
      restarted.marks['101'] = { token: '101', price: 100, source: 'rest', receivedAt: f.now() }
      await restarted.pump()
      assert.equal(restarted.session!.legs.CE!.position?.quantity ?? 0, remaining)
    }
    assert.deepEqual(f.broker.submitted.map(order => [order.transaction, order.quantity]), [
      [direction === 'buy' ? 'BUY' : 'SELL', 260], [direction === 'buy' ? 'SELL' : 'BUY', 130], [direction === 'buy' ? 'SELL' : 'BUY', 130],
    ])
    assert.equal(restarted.session!.pnlVerified, true)
    assert.equal(f.broker.submitted.every(order => order.product === product), true)
    restarted.saveStrategySettings({ ...restarted.strategySettings(direction), product: product === 'MIS' ? 'NRML' : 'MIS' })
    await restarted.stop(); await restarted.pump()
    await restarted.start('live', direction)
    assert.equal(restarted.session!.settings!.product, product, 'same-day Resume keeps its original broker product and permissions')
  }
})

test('new Live sessions detect pre-existing NSE-labelled NIFTY option exposure before any entry', async () => {
  const f = await fixture()
  f.broker.positions = async () => [{ symbol: 'NIFTY-27Oct2026-25000-CE', exchange: 'NSE', product: 'MIS', quantity: 65 }]
  await f.controller.start('live')
  for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve))
  assert.match(f.controller.session!.message, /Existing NIFTY broker exposure/)
  assert.equal(f.broker.submitted.length, 0)
})

test('Live Start rejects an NRML configuration when login advertises only MIS', async () => {
  const f = await fixture()
  f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, product: 'NRML' })
  f.broker.credentials!.permissions = { exchanges: ['NFO'], products: ['MIS'], orderTypes: ['MARKET'] }
  await assert.rejects(f.controller.start('live'), /NRML/)
  assert.equal(f.broker.submitted.length, 0)
})

test('a flat reconciliation cannot silently re-arm a live session with unverified historical quantities', async () => {
  const f = await fixture(); await f.start('live')
  await f.controller.stop(); await f.controller.pump()
  f.controller.session!.pnlVerified = false
  await f.controller.reconcile()
  assert.match(f.controller.session!.message, /accounting remains unverified/)
  assert.equal(f.controller.session!.pnlVerified, false)
  await assert.rejects(f.controller.start('live'), /Automatic entries remain blocked/)
  assert.equal(f.controller.session!.status, 'stopped')
  assert.equal(f.broker.submitted.length, 0)
})

test('closing and reopening the SQLite store restores the exact running paper day-session', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-resume-'))
  const f = await fixture()
  let disk = new Store(directory)
  t.after(async () => { disk.close(); await rm(directory, { recursive: true, force: true }) })
  disk.saveBroker(f.broker.credentials)
  const controller = new Controller(f.broker, disk, f.feed, f.now)
  await controller.restore(); await controller.start('paper')
  for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve))
  await candle({ ...f, controller }, '09:20')
  const original = structuredClone(controller.session!)
  await controller.checkpointForRestart(); disk.close()
  disk = new Store(directory)
  const restored = new Controller(f.broker, disk, f.feed, f.now)
  await restored.restore()
  assert.equal(restored.session!.id, original.id)
  assert.deepEqual(restored.session!.legs, original.legs)
  assert.deepEqual(restored.session!.trades, original.trades)
  assert.deepEqual(restored.session!.settings, original.settings)
  assert.equal(restored.session!.status, 'running')
  assert.equal(f.broker.submitted.length, 0)
  assert.equal(f.broker.cancellations.length, 0)
})

test('engine checkpoint and restart retain the running live position and original day state without forced orders', async () => {
  const f = await fixture(); await f.start('live'); await candle(f, '09:20')
  const before = structuredClone(f.controller.session!)
  f.setTime(istTime(DAY, '09:36'))
  const submitted = f.broker.submitted.length
  await f.controller.checkpointForRestart()
  await f.controller.pump()
  assert.equal(f.store.saved!.status, 'running')
  assert.equal(f.store.saved!.legs.CE!.position!.quantity, 195)
  assert.equal(f.broker.submitted.length, submitted)
  assert.equal(f.broker.cancellations.length, 0)
  const restarted = new Controller(f.broker, f.store, f.feed, f.now)
  await restarted.restore()
  assert.equal(restarted.session!.id, before.id)
  assert.equal(restarted.session!.status, 'running')
  assert.deepEqual(restarted.session!.legs.CE, before.legs.CE)
  assert.deepEqual(restarted.session!.trades, before.trades)
  assert.deepEqual(restarted.session!.settings, before.settings)
  assert.equal(f.broker.submitted.length, submitted)
})

test('a late first start consumes historical breakouts and requires a new below-then-above crossing', async () => {
  const f = await fixture(); f.setTime(istTime(DAY, '10:40'))
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 101), bar('10:35', 200)])
  await f.start('paper')
  const id = f.controller.session!.id, reference = structuredClone(f.controller.session!.legs.CE!.reference)
  assert.equal(f.controller.session!.legs.CE!.firstSignalConsumed, true)
  await candle(f, '10:40', 200)
  assert.equal(f.controller.session!.trades.length, 0)
  await candle(f, '10:45', 99)
  await candle(f, '10:50', 101)
  assert.equal(f.controller.session!.trades.filter(trade => trade.side === 'CE' && trade.transaction === 'BUY').length, 1)
  assert.deepEqual(f.controller.session!.legs.CE!.reference, reference)
  assert.equal(f.controller.session!.id, id)
})

test('missing fresh price at a breakout cannot turn the next above-level candle into a new first entry', async () => {
  const f = await fixture(); await f.start('paper')
  f.setTime(istTime(DAY, '09:25') + 3000)
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 150)])
  f.broker.candles.set('102', [bar('09:15'), bar('09:20', 99)])
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.trades.length, 0)
  assert.equal(f.controller.session!.legs.CE!.firstSignalConsumed, true)
  await candle(f, '09:25', 160)
  assert.equal(f.controller.session!.trades.length, 0)
  await candle(f, '09:30', 99)
  await candle(f, '09:35', 101)
  assert.equal(f.controller.session!.trades.filter(trade => trade.transaction === 'BUY').length, 1)
})

test('saved preference changes first apply when explicitly starting the next trading day', async () => {
  const f = await fixture(); await f.start('paper')
  const id = f.controller.session!.id
  f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, entryLots: 4, target1Lots: 2 })
  await f.controller.stop(); await f.controller.pump()
  f.setTime(istTime(DAY, '09:20') + 86400000 + 1000)
  f.broker.credentials!.expiresAt = f.now() + 86400000
  f.broker.history = async () => [{ ...bar('09:15'), start: bar('09:15').start + 86400000, end: bar('09:15').end + 86400000 }]
  await f.start('paper')
  assert.notEqual(f.controller.session!.id, id)
  assert.equal(f.controller.session!.settings!.entryLots, 4)
  assert.equal(f.controller.session!.legs.CE!.entries, 0)
})

test('25-point stop exits Paper and Live positions on a fresh price without another candle close', async () => {
  for (const mode of ['paper', 'live'] as const) {
    const f = await fixture()
    f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, enabledSides: ['CE'] })
    await f.start(mode); await candle(f, '09:20')
    const leg = f.controller.session!.legs.CE!, stop = leg.reference.close - 25
    f.setTime(f.now() + 1000); f.mark('CE', stop + 0.05); await f.controller.pump()
    assert.equal(leg.position!.quantity, 260)
    f.mark('CE', stop); await f.controller.pump()
    assert.equal(leg.position, null)
    assert.equal(f.controller.session!.trades.at(-1)!.reason, 'STOP_LOSS')
    assert.equal(f.controller.session!.trades.at(-1)!.quantity, 260)
    assert.equal(leg.lastCandleEnd, istTime(DAY, '09:25'))
    assert.equal(leg.reentryReady, false)
    await f.controller.pump()
    assert.equal(f.controller.session!.trades.filter(trade => trade.reason === 'STOP_LOSS').length, 1)
  }
})

test('stale prices cannot trigger the immediate stop and a fresh touch remains latched after recovery', async () => {
  const f = await fixture()
  f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, enabledSides: ['CE'] })
  await f.start('paper'); await candle(f, '09:20')
  const leg = f.controller.session!.legs.CE!, stop = leg.reference.close - 25
  f.controller.marks['101'] = { token: '101', price: stop, source: 'websocket', receivedAt: f.now() - 6000 }
  await f.controller.pump(); assert.notEqual(leg.position, null)
  f.controller.busy = true
  f.feed.onMark({ token: '101', price: stop, source: 'websocket', receivedAt: f.now() })
  f.feed.onMark({ token: '101', price: stop + 30, source: 'websocket', receivedAt: f.now() })
  assert.equal(leg.exitReason, 'STOP_LOSS')
  f.controller.busy = false; await f.controller.pump()
  assert.equal(leg.position, null)
  assert.equal(f.controller.session!.trades.at(-1)!.reason, 'STOP_LOSS')
})

test('a stop during a pending target waits for confirmation and then sells only the remaining units', async () => {
  const f = await fixture()
  f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, enabledSides: ['CE'] })
  await f.start('live'); await candle(f, '09:20')
  const leg = f.controller.session!.legs.CE!, average = leg.position!.average
  f.broker.plans.push({ pending: true })
  f.mark('CE', average + 20); await f.controller.pump()
  const pending = f.controller.session!.pending!
  assert.equal(pending.reason, 'TARGET_1')
  f.feed.onMark({ token: '101', price: leg.reference.close - 25, source: 'websocket', receivedAt: f.now() })
  assert.equal(leg.exitReason, 'STOP_LOSS')
  assert.equal(f.broker.submitted.length, 2, 'no overlapping stop order while target acknowledgement is unresolved')
  f.broker.rows.get(pending.orderId!)!.fill = { orderId: pending.orderId!, quantity: 130, average: average + 20, status: 'COMPLETE' }
  f.setTime(f.now() + 1600); await f.controller.pump()
  assert.equal(leg.position!.quantity, 130)
  f.mark('CE', average); await f.controller.pump()
  assert.equal(leg.position, null)
  assert.deepEqual(f.broker.submitted.map(order => [order.reason, order.quantity]), [['BREAKOUT', 260], ['TARGET_1', 130], ['STOP_LOSS', 130]])
})

test('partial stop fills retry only remaining exposure; lower-close exit and disabled-stop snapshots retain their behavior', async () => {
  const f = await fixture()
  f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, enabledSides: ['CE'] })
  await f.start('live'); await candle(f, '09:20')
  f.broker.plans.push({ quantity: 100, average: 75, status: 'CANCELLED' })
  f.mark('CE', 75); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 160)
  await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position, null)
  assert.deepEqual(f.broker.submitted.filter(order => order.reason === 'STOP_LOSS').map(order => order.quantity), [260, 160])
  const lower = await fixture()
  lower.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, enabledSides: ['CE'] })
  await lower.start('paper'); await candle(lower, '09:20'); await candle(lower, '09:25', 99)
  assert.equal(lower.controller.session!.trades.at(-1)!.reason, 'LOWER_CLOSE')
  const disabled = await fixture()
  await disabled.start('paper'); await candle(disabled, '09:20')
  disabled.mark('CE', 50); await disabled.controller.pump()
  assert.notEqual(disabled.controller.session!.legs.CE!.position, null)
})
test('CE and PE independently buy confirmed 3-lot fills from the same completed candle', async () => {
  const f = await fixture(); await f.start()
  await candle(f, '09:20', 101, 102)
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195)
  assert.equal(f.controller.session!.legs.PE!.position!.quantity, 195)
  assert.equal(f.broker.submitted.length, 2)
  assert.equal(f.store.writes.some(s => s.pending && !s.pending.orderId), true)
  await f.controller.pump()
  assert.equal(f.broker.submitted.length, 2)
})
test('live targets sell one lot then the remaining two, using actual fill prices', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  f.broker.plans.push({ average: 120 }, { average: 140 })
  f.mark('CE', 120); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
  f.mark('CE', 140); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position, null)
  assert.equal(f.controller.session!.legs.CE!.realized, 6500)
  assert.deepEqual(f.broker.submitted.map(o => o.quantity), [195, 65, 130])
})
test('a partial target stays latched even when the next price falls', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  f.broker.plans.push({ quantity: 32, average: 120, status: 'CANCELLED' }, { average: 119 })
  f.mark('CE', 120); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.target1Remaining, 33)
  f.mark('CE', 119); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
  assert.equal(f.controller.session!.legs.CE!.position!.target1Remaining, 0)
})
test('after lower-close exit a separate below-level close must reset re-entry before a later breakout', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  await candle(f, '09:25', 99)
  assert.equal(f.controller.session!.legs.CE!.position, null)
  await candle(f, '09:30', 101)
  assert.equal(f.controller.session!.legs.CE!.entries, 1)
  await candle(f, '09:35', 99)
  assert.equal(f.controller.session!.legs.CE!.position, null)
  await candle(f, '09:40', 101)
  assert.equal(f.controller.session!.legs.CE!.entries, 2)
  assert.deepEqual(f.broker.submitted.map(o => o.transaction), ['BUY', 'SELL', 'BUY'])
})
test('Stop arriving during the first BUY prevents a second leg entry', async () => {
  const f = await fixture(); await f.start()
  f.broker.beforePlace = () => { f.broker.beforePlace = null; void f.controller.stop() }
  await candle(f, '09:20', 101, 102)
  for (let i = 0; i < 5; i++) { await new Promise(resolve => setImmediate(resolve)); await f.controller.pump() }
  assert.equal(f.broker.submitted.filter(o => o.transaction === 'BUY').length, 1)
  assert.equal(f.controller.session!.legs.CE!.position, null)
})
test('15:10 exits both legs, preserves partial quantities and blocks new entries', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20', 101, 101)
  f.broker.plans.push({ quantity: 65, status: 'CANCELLED' }, {}, {})
  f.setTime(istTime(DAY, '15:10'))
  await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
  assert.equal(f.controller.session!.legs.PE!.position, null)
  await f.controller.pump()
  assert.equal(f.controller.session!.status, 'stopped')
  assert.equal(f.controller.session!.legs.CE!.position, null)
  await assert.rejects(() => f.controller.start('live'), /15:10/)
})
test('unknown submission persists and is never automatically retried', async () => {
  const f = await fixture(); await f.start()
  f.broker.timeoutSubmission = true
  await candle(f, '09:20')
  assert.equal(f.controller.session!.status, 'blocked')
  assert.ok(f.store.saved!.pending)
  for (let i = 0; i < 4; i++) { f.setTime(f.now() + 2000); await f.controller.pump() }
  assert.equal(f.broker.submitted.length, 1)
  assert.equal(f.controller.session!.legs.CE!.position, null)
})

test('verified rejected zero-fill pending order reconciles to stopped without a resend or cancellation', async () => {
  const f = await fixture(); await f.start()
  f.broker.timeoutSubmission = true
  await candle(f, '09:20')
  assert.ok(f.controller.session!.pending)
  // Old saved intents may lack the new metadata; recover it from the locked contract.
  delete f.controller.session!.pending!.instrumentToken
  delete f.controller.session!.pending!.expiry
  f.broker.findOrder = async intent => {
    assert.equal(intent.instrumentToken, '101')
    assert.equal(intent.expiry, '2026-10-27')
    return 'verified-rejected'
  }
  f.broker.order = async () => ({ orderId: 'verified-rejected', quantity: 0, average: 0, status: 'Rejected', rejectionReason: 'Insufficient funds.' })
  await f.controller.reconcile()
  assert.equal(f.controller.session!.status, 'stopped')
  assert.equal(f.controller.session!.pending, null)
  assert.equal(f.controller.session!.trades.length, 0)
  assert.equal(f.broker.submitted.length, 1)
  assert.equal(f.broker.cancellations.length, 0)
  assert.ok(f.controller.session!.activity.some(item => item.message.includes('Insufficient funds.')))
})
test('pending cancellation must be confirmed before a partial fill becomes a position', async () => {
  const f = await fixture(); await f.start()
  f.broker.plans.push({ pending: true })
  await candle(f, '09:20')
  assert.equal(f.controller.session!.legs.CE!.position, null)
  f.setTime(f.now() + 13_000); await f.controller.pump()
  assert.equal(f.broker.cancellations.length, 1)
  const intent = f.controller.session!.pending!
  f.broker.rows.get(intent.orderId!)!.fill = { orderId: intent.orderId!, quantity: 65, average: 102, status: 'CANCELLED' }
  f.setTime(f.now() + 2000); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 65)
  assert.equal(f.controller.session!.pending, null)
})
test('paper trades never reach the live broker order API', async () => {
  const f = await fixture(); await f.start('paper'); await candle(f, '09:20', 101, 102)
  f.mark('CE', 121); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
  assert.equal(f.broker.submitted.length, 0)
  assert.equal(f.controller.session!.trades.every(t => t.mode === 'paper'), true)
})
test('fresh official REST snapshots can execute candle entries and protect positions during a WebSocket outage', async () => {
  const f = await fixture(); await f.start()
  f.setTime(istTime(DAY, '09:25') + 3000)
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 101)])
  f.mark('CE', 101, 'rest'); f.mark('PE', 99, 'rest')
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.broker.submitted.length, 1)
  f.mark('CE', 120, 'rest'); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
})
test('external closure pauses entries and never opens a short with an extra SELL', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  f.broker.holdings.set(contract('CE').symbol, 0)
  f.setTime(f.now() + 16_000); await f.controller.pump()
  assert.equal(f.controller.session!.pnlVerified, false)
  assert.equal(f.controller.session!.legs.CE!.position, null)
  assert.equal(f.broker.submitted.length, 1)
})
test('restart reconciles a durable pending fill and resumes the same position without another BUY or forced SELL', async () => {
  const f = await fixture(); await f.start()
  f.broker.plans.push({ pending: true }); await candle(f, '09:20')
  const pending = f.store.saved!.pending!
  f.broker.rows.get(pending.orderId!)!.fill = { orderId: pending.orderId!, quantity: 195, average: 101, status: 'COMPLETE' }
  const restarted = new Controller(f.broker, f.store, f.feed, f.now)
  await restarted.restore()
  for (let i = 0; i < 5; i++) { await new Promise(resolve => setImmediate(resolve)); await restarted.pump() }
  assert.equal(f.broker.submitted.filter(o => o.transaction === 'BUY').length, 1)
  assert.equal(restarted.session!.legs.CE!.position!.quantity, 195)
  assert.equal(restarted.session!.pending, null)
  assert.equal(restarted.session!.id, f.store.saved!.id)
  assert.equal(f.broker.submitted.filter(o => o.transaction === 'SELL').length, 0)
})

test('a slow chart endpoint cannot hold the order queue or prevent Stop', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  let release!: (bars: import('../shared/model.ts').Candle[]) => void
  const slow = new Promise<import('../shared/model.ts').Candle[]>(resolve => { release = resolve })
  f.broker.history = async () => slow
  f.setTime(istTime(DAY, '09:30') + 3000); f.mark('CE', 101)
  await f.controller.pump()
  assert.equal(f.controller.busy, false)
  await f.controller.stop(); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position, null)
  release([bar('09:15'), bar('09:25', 110)])
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.broker.submitted.filter(o => o.transaction === 'BUY').length, 1)
})
test('a target touch is retained when a lower tick arrives during another broker request', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  const positions = f.broker.positions.bind(f.broker)
  let release!: () => void
  const slow = new Promise<void>(resolve => { release = resolve })
  f.broker.positions = async () => { await slow; return positions() }
  f.setTime(f.now() + 16_000)
  const pump = f.controller.pump()
  await new Promise(resolve => setImmediate(resolve))
  f.feed.onMark({ token: '101', price: 120, receivedAt: f.now(), source: 'websocket' })
  f.feed.onMark({ token: '101', price: 110, receivedAt: f.now(), source: 'websocket' })
  release(); await pump
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
})
test('a price that becomes stale during position verification cannot submit a new BUY', async () => {
  const f = await fixture(); await f.start()
  f.broker.positions = async () => { f.setTime(f.now() + 6000); return [] }
  await candle(f, '09:20')
  assert.equal(f.broker.submitted.length, 0)
})
test('a definitive CE rejection leaves PE eligible for its own candle signal', async () => {
  const f = await fixture(); await f.start()
  const place = f.broker.place.bind(f.broker)
  f.broker.place = async intent => {
    if (intent.side === 'CE') { f.broker.submitted.push(intent); throw new BrokerError('Rejected by exchange.', true) }
    return place(intent)
  }
  await candle(f, '09:20', 101, 102)
  assert.equal(f.controller.session!.legs.CE!.position, null)
  assert.equal(f.controller.session!.legs.PE!.position!.quantity, 195)
})
test('flat paper and live sessions can switch without losing either history', async () => {
  const f = await fixture(); await f.start('paper'); await candle(f, '09:20')
  await f.controller.stop()
  for (let i = 0; i < 10; i++) { await new Promise(resolve => setImmediate(resolve)); await f.controller.pump() }
  const paperEntries = f.controller.session!.legs.CE!.entries
  await f.controller.start('live')
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.mode, 'live')
  assert.equal(f.controller.session!.trades.length, 0)
  await f.controller.stop()
  for (let i = 0; i < 10; i++) { await new Promise(resolve => setImmediate(resolve)); await f.controller.pump() }
  await f.controller.start('paper')
  assert.equal(f.controller.session!.legs.CE!.entries, paperEntries)
  assert.equal(f.controller.session!.trades.length, 2)
})

test('temporary position-read failure recovers a flat session without restarting', async () => {
  const f = await fixture(); await f.start()
  f.broker.positionFailure = true
  await candle(f, '09:20', 101, 102)
  assert.equal(f.controller.session!.status, 'running')
  assert.equal(f.broker.submitted.length, 0)
  f.broker.positionFailure = false
  await candle(f, '09:25', 101, 102)
  assert.equal(f.broker.submitted.filter(o => o.transaction === 'BUY').length, 2)
})

test('target latched during a position outage exits after recovery and keeps monitoring', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  f.broker.positionFailure = true
  f.feed.onMark({ token: '101', price: 120, receivedAt: f.now(), source: 'websocket' })
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.legs.CE!.exitReason, 'TARGET_1')
  assert.equal(f.controller.session!.status, 'running')
  assert.equal(f.broker.submitted.length, 1)
  f.broker.positionFailure = false; f.setTime(f.now() + 6000)
  f.mark('CE', 110); await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
  assert.equal(f.controller.session!.status, 'running')
})

test('cutoff square-off retries a temporary position outage without new entries', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20', 101, 101)
  f.setTime(istTime(DAY, '15:10')); f.broker.positionFailure = true
  await f.controller.pump()
  assert.equal(f.controller.session!.status, 'stopping')
  f.broker.positionFailure = false; f.setTime(f.now() + 6000)
  await f.controller.pump()
  assert.equal(f.controller.session!.status, 'stopped')
  assert.deepEqual(f.broker.submitted.map(o => o.transaction), ['BUY', 'BUY', 'SELL', 'SELL'])
})

test('old exchange ticks, invalid prices and future receipts cannot latch a target', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  for (const change of [
    { exchangeAt: f.now() - 6000 }, { exchangeAt: f.now() + 2000 },
    { price: Infinity }, { price: NaN }, { price: -1 }, { receivedAt: f.now() + 2000 },
  ]) f.feed.onMark({ token: '101', price: 140, receivedAt: f.now(), source: 'websocket', ...change })
  await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.exitReason, null)
  assert.equal(f.broker.submitted.length, 1)
  assert.equal(f.controller.marks['101'].price, 101)
})

test('an out-of-order tick cannot replace a newer mark or latch its old target', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  f.feed.onMark({ token: '101', price: 110, receivedAt: f.now(), exchangeAt: f.now(), source: 'websocket' })
  f.feed.onMark({ token: '101', price: 140, receivedAt: f.now(), exchangeAt: f.now() - 1000, source: 'websocket' })
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.marks['101'].price, 110)
  assert.equal(f.broker.submitted.length, 1)
})

test('concurrent ticks schedule only one monitoring pump', async () => {
  const f = await fixture(); await f.start()
  f.setTime(f.now() + 16_000)
  let reads = 0
  f.broker.positions = async () => { reads++; return [] }
  await Promise.all(Array.from({ length: 20 }, () => f.controller.pump()))
  assert.equal(reads, 1)
})

test('verified excess broker quantity remains blocked rather than automatically resuming entries', async () => {
  const f = await fixture(); await f.start()
  f.broker.holdings.set(contract('CE').symbol, 65)
  await candle(f, '09:20', 101, 102)
  f.setTime(f.now() + 6000); await f.controller.pump()
  assert.equal(f.controller.session!.status, 'blocked')
  assert.equal(f.broker.submitted.length, 0)
})

test('history recovery preserves a missed lower-close exit despite a later price recovery', async () => {
  const f = await fixture(); await f.start(); await candle(f, '09:20')
  f.setTime(istTime(DAY, '09:40') + 3000)
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 101), bar('09:25', 99), bar('09:30', 102), bar('09:35', 105)])
  f.mark('CE', 105); await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.legs.CE!.position, null)
  assert.equal(f.broker.submitted.at(-1)!.reason, 'LOWER_CLOSE')
  assert.equal(f.broker.submitted.filter(o => o.transaction === 'BUY').length, 1)
})

test('ordinary market ticks do not repeatedly commit unchanged session state', async () => {
  const f = await fixture(); await f.start(); await f.controller.pump()
  const before = f.store.writes.length
  for (let i = 0; i < 20; i++) {
    f.feed.onMark({ token: '101', price: 100 + i / 100, receivedAt: f.now(), source: 'websocket' })
    await f.controller.pump()
  }
  assert.equal(f.store.writes.length, before)
  await f.controller.stop(); await f.controller.pump()
  assert.equal(f.store.saved!.status, 'stopped')
  assert.ok(f.store.writes.length > before)
})

test('advertised missing derivative permissions block Live mode but allow Paper mode', async () => {
  const f = await fixture();
  f.broker.credentials = { ...f.broker.credentials!, permissions: { exchanges: ['NSE'], products: ['CNC'], orderTypes: ['LIMIT'] } };
  await assert.rejects(() => f.start('live'), /NFO, MIS and MARKET/);
  assert.equal(f.broker.submitted.length, 0);
  await f.start('paper');
  assert.equal(f.controller.session!.mode, 'paper');
});
