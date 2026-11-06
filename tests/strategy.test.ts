import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyFill, candleSignal, levels, observeReentry, orderQuantity, targetSignal } from '../server/strategy.ts'
import { bar, contract, DAY } from './helpers.ts'
import type { Leg, OrderIntent, TradingSession } from '../shared/model.ts'
import { istTime } from '../server/time.ts'

const leg = (): Leg => ({ contract: contract('CE'), reference: bar('09:15'), ...levels(100), position: null,
  realized: 0, entries: 0, lastCandleEnd: istTime(DAY, '09:20'), exitReason: null })
const session = (): TradingSession => ({ id: 'test', date: DAY, mode: 'live', account: 'test', status: 'running', message: '',
  atm: 25000, expiry: '2026-10-27', legs: { CE: leg() }, pending: null, pnlVerified: true, trades: [], activity: [] })
const intent = (transaction: 'BUY' | 'SELL', quantity = 195, reason: OrderIntent['reason'] = 'BREAKOUT'): OrderIntent => ({ id: crypto.randomUUID(), tag: 'test', side: 'CE', symbol: 'NIFTY-TEST-CE', transaction, quantity, reason, submittedAt: 0 })

test('09:50 regression: staying above the original 163.70 level cannot buy again after full target exit', () => {
  const l = leg()
  l.reference = { ...bar('09:15', 163.55), high: 163.55 }
  Object.assign(l, levels(163.55), { entries: 1, lastExitAt: istTime(DAY, '09:46') + 58_000, reentryReady: false })
  const original = structuredClone({ reference: l.reference, upper: l.upper, lower: l.lower })
  const above = bar('09:45', 233.15)
  observeReentry(l, above, above.end + 5000)
  assert.equal(candleSignal(l, above, above.end + 5000, DAY), null)
  const equal = bar('09:50', 163.70)
  observeReentry(l, equal, equal.end + 5000)
  assert.equal(l.reentryReady, false)
  const below = bar('09:55', 163.60)
  observeReentry(l, below, below.end - 1)
  assert.equal(l.reentryReady, false)
  observeReentry(l, below, below.end + 5000)
  assert.equal(l.reentryReady, true)
  assert.equal(candleSignal(l, below, below.end + 5000, DAY), null)
  // Persisted gate survives a snapshot/restart without moving either fixed level.
  const restored: Leg = JSON.parse(JSON.stringify(l))
  const next = bar('10:00', 164)
  assert.equal(candleSignal(restored, next, next.end + 5000, DAY), 'BREAKOUT')
  const touch = bar('10:05', 163.70)
  assert.equal(candleSignal(restored, touch, touch.end + 5000, DAY), null)
  assert.deepEqual({ reference: restored.reference, upper: restored.upper, lower: restored.lower }, original)
})

test('partial target fills do not reset re-entry; the final confirmed SELL requires a new post-exit reset', () => {
  const s = session(), l = s.legs.CE!, buyAt = istTime(DAY, '09:25')
  applyFill(s, intent('BUY'), { orderId: 'entry', quantity: 195, average: 100, status: 'COMPLETE' }, buyAt)
  applyFill(s, intent('SELL', 65, 'TARGET_1'), { orderId: 'partial', quantity: 65, average: 120, status: 'COMPLETE' }, buyAt + 1000)
  const beforeExit = bar('09:30', 99)
  observeReentry(l, beforeExit, beforeExit.end + 5000)
  assert.equal(l.reentryReady, false)
  assert.equal(l.lastExitAt, undefined)
  const exitAt = istTime(DAY, '09:36')
  applyFill(s, intent('SELL', 130, 'TARGET_2'), { orderId: 'exit', quantity: 130, average: 140, status: 'COMPLETE' }, exitAt)
  assert.equal(l.lastExitAt, exitAt)
  observeReentry(l, beforeExit, exitAt + 5000)
  assert.equal(l.reentryReady, false)
  const reset = bar('09:40', 99)
  observeReentry(l, reset, reset.end + 5000)
  assert.equal(l.reentryReady, true)
  applyFill(s, intent('BUY'), { orderId: 'reentry', quantity: 195, average: 102, status: 'COMPLETE' }, istTime(DAY, '09:50'))
  assert.equal(l.reentryReady, false)
  assert.equal(l.entries, 2)
})

test('PDF multipliers use the close and exactly 0.09%, not 0.9%', () => {
  assert.deepEqual(levels(158.79), { upper: 158.93, lower: 158.65 })
  assert.deepEqual(levels(82.03), { upper: 82.1, lower: 81.96 })
  assert.deepEqual(levels(100), { upper: 100.09, lower: 99.91 })
})
test('intrabar high cannot enter; only a completed qualifying five-minute close can', () => {
  const l = leg(), candle = bar('09:20', 100)
  assert.equal(candleSignal(l, candle, candle.end + 2000, DAY), null)
  candle.close = l.upper
  assert.equal(candleSignal(l, candle, candle.end - 1, DAY), null)
  assert.equal(candleSignal(l, candle, candle.end + 2000, DAY), 'BREAKOUT')
})
test('duplicate, reference, stale and cutoff candles cannot open a new position', () => {
  const l = leg(), c = bar('09:20', 101)
  assert.equal(candleSignal(l, c, c.end + 90_001, DAY), null)
  l.lastCandleEnd = c.end
  assert.equal(candleSignal(l, c, c.end + 2000, DAY), null)
  assert.equal(candleSignal(leg(), bar('09:15', 110), istTime(DAY, '09:20'), DAY), null)
  assert.equal(candleSignal(leg(), bar('15:05', 110), istTime(DAY, '15:10'), DAY), null)
})
test('lower exit is strictly below the level; a low wick or equality does not exit', () => {
  const l = leg(); l.position = { quantity: 195, average: 100, target1Remaining: 65, entryQuantity: 195 }
  const c = bar('09:20', l.lower)
  assert.equal(candleSignal(l, c, c.end + 2000, DAY), null)
  c.close = 99.9
  assert.equal(candleSignal(l, c, c.end + 2000, DAY), 'LOWER_CLOSE')
})
test('confirmed actual fills drive target prices, partial quantities and gross P&L', () => {
  const s = session(), l = s.legs.CE!
  applyFill(s, intent('BUY'), { orderId: '1', quantity: 195, average: 102.5, status: 'COMPLETE' }, 1)
  assert.equal(targetSignal(l, 122.49), null)
  assert.equal(targetSignal(l, 122.5), 'TARGET_1')
  assert.equal(orderQuantity(l, 'TARGET_1'), 65)
  applyFill(s, intent('SELL', 65, 'TARGET_1'), { orderId: '2', quantity: 32, average: 122.5, status: 'CANCELLED' }, 2)
  assert.equal(l.position!.quantity, 163)
  assert.equal(l.position!.target1Remaining, 33)
  assert.equal(targetSignal(l, 150), 'TARGET_1')
  applyFill(s, intent('SELL', 33, 'TARGET_1'), { orderId: '3', quantity: 33, average: 122.5, status: 'COMPLETE' }, 3)
  assert.equal(targetSignal(l, 142.5), 'TARGET_2')
  applyFill(s, intent('SELL', 130, 'TARGET_2'), { orderId: '4', quantity: 130, average: 142.5, status: 'COMPLETE' }, 4)
  assert.equal(l.position, null); assert.equal(l.realized, 6500)
})
test('zero fill cannot create a position; invalid or excessive sells cannot clear exposure', () => {
  const s = session()
  applyFill(s, intent('BUY'), { orderId: '1', quantity: 0, average: 0, status: 'REJECTED' }, 1)
  assert.equal(s.legs.CE!.position, null)
  assert.throws(() => applyFill(s, intent('SELL', 65, 'TARGET_1'), { orderId: '2', quantity: 65, average: 120, status: 'COMPLETE' }, 2))
  assert.throws(() => applyFill(s, intent('BUY'), { orderId: '3', quantity: 195, average: NaN, status: 'COMPLETE' }, 3))
})
