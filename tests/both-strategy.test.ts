import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOTH_DEFAULT_SETTINGS } from '../shared/settings.ts'
import { targetPrice } from '../shared/targets.ts'
import { directionOf, strategyName } from '../shared/strategy.ts'
import { levels, candleSignal, observeReentry, targetSignal, stopLossSignal, applyFill } from '../server/strategy.ts'
import { fixture, DAY, bar, contract } from './helpers.ts'
import { istTime } from '../server/time.ts'
import type { Leg, OrderIntent, TradingSession } from '../shared/model.ts'
import type { StrategySettings } from '../shared/settings.ts'

const bothSettings: StrategySettings = { ...BOTH_DEFAULT_SETTINGS, enabledSides: ['CE', 'PE'] }
const leg = (): Leg => ({ contract: contract('CE'), reference: bar('09:15'), ...levels(100, bothSettings), position: null, realized: 0, entries: 0, lastCandleEnd: istTime(DAY, '09:20'), exitReason: null })
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

test('Both strategy direction and name resolution', () => {
  assert.equal(directionOf(bothSettings), 'both')
  assert.equal(strategyName(bothSettings), '009 Breakout – Both (Buy & Sell)')
  assert.equal(strategyName('both'), '009 Breakout – Both (Buy & Sell)')
})

test('Bi-directional levels and breakout signals', () => {
  const l = leg(), now = istTime(DAY, '09:25')
  assert.deepEqual(levels(100, bothSettings), { upper: 100.09, lower: 99.91 })

  // Breakout above -> triggers BUY breakout
  assert.equal(candleSignal(l, bar('09:20', 100.10), now, DAY, bothSettings), 'BREAKOUT')
  assert.equal(l.pendingDirection, 'buy')

  // Breakdown below -> triggers SELL breakdown
  l.pendingDirection = null
  assert.equal(candleSignal(l, bar('09:20', 99.90), now, DAY, bothSettings), 'BREAKOUT')
  assert.equal(l.pendingDirection, 'sell')

  // Inside channel -> null
  l.pendingDirection = null
  assert.equal(candleSignal(l, bar('09:20', 100.00), now, DAY, bothSettings), null)
  assert.equal(l.pendingDirection, null)
})

test('Both strategy: Buy position lifecycle and exits', () => {
  const l = leg()
  // Enter Long (BUY)
  l.position = { average: 100, quantity: 260, entryQuantity: 260, target1Remaining: 130, direction: 'buy' }
  const now = istTime(DAY, '09:25')

  // Target 1 for BUY is above entry (+20 points)
  assert.equal(targetPrice(bothSettings, 1, 100, 'buy'), 120)
  assert.equal(targetSignal(l, 120, bothSettings), 'TARGET_1')
  assert.equal(targetSignal(l, 119, bothSettings), null)

  // Reference stop for BUY is below reference close (100 - 25 = 75)
  assert.equal(stopLossSignal(l, 75, bothSettings), 'STOP_LOSS')
  assert.equal(stopLossSignal(l, 76, bothSettings), null)

  // Lower candle exit for BUY
  assert.equal(candleSignal(l, bar('09:20', 99.90), now, DAY, bothSettings), 'LOWER_CLOSE')
  assert.equal(candleSignal(l, bar('09:20', 100.10), now, DAY, bothSettings), null)
})

test('Both strategy: Sell position lifecycle and exits', () => {
  const l = leg()
  // Enter Short (SELL)
  l.position = { average: 100, quantity: 260, entryQuantity: 260, target1Remaining: 130, direction: 'sell' }
  const now = istTime(DAY, '09:25')

  // Target 1 for SELL is below entry (-20 points)
  assert.equal(targetPrice(bothSettings, 1, 100, 'sell'), 80)
  assert.equal(targetSignal(l, 80, bothSettings), 'TARGET_1')
  assert.equal(targetSignal(l, 81, bothSettings), null)

  // Reference stop for SELL is above reference close (100 + 25 = 125)
  assert.equal(stopLossSignal(l, 125, bothSettings), 'STOP_LOSS')
  assert.equal(stopLossSignal(l, 124, bothSettings), null)

  // Upper candle exit for SELL
  assert.equal(candleSignal(l, bar('09:20', 100.10), now, DAY, bothSettings), 'UPPER_CLOSE')
  assert.equal(candleSignal(l, bar('09:20', 99.90), now, DAY, bothSettings), null)
})

test('Both strategy: Re-entry reset inside the channel', () => {
  const l = leg()
  l.entries = 1
  l.lastExitAt = istTime(DAY, '09:30')
  l.firstSignalConsumed = true

  // Outside the channel -> not ready
  observeReentry(l, bar('09:30', 100.15), istTime(DAY, '09:35'), bothSettings)
  assert.notEqual(l.reentryReady, true)

  // Inside the channel (100 is between 99.91 and 100.09) -> resets ready
  observeReentry(l, bar('09:35', 100.00), istTime(DAY, '09:40'), bothSettings)
  assert.equal(l.reentryReady, true)

  // Now a fresh breakdown triggers
  assert.equal(candleSignal(l, bar('09:40', 99.85), istTime(DAY, '09:45'), DAY, bothSettings), 'BREAKOUT')
  assert.equal(l.pendingDirection, 'sell')
})

test('Both strategy: One active position per leg at a time (overlapping prevented in applyFill)', () => {
  const session: TradingSession = {
    id: 'test-both', date: DAY, mode: 'paper', account: 'test', status: 'running', message: '',
    atm: 25000, expiry: '2026-10-27', legs: { CE: leg() }, pending: null, pnlVerified: true, trades: [], activity: [],
    settings: structuredClone(bothSettings)
  }
  const entryIntent: OrderIntent = { id: 'i1', tag: 't1', side: 'CE', symbol: 'NIFTY-CE', transaction: 'BUY', quantity: 260, reason: 'BREAKOUT', submittedAt: 0 }
  applyFill(session, entryIntent, { orderId: 'f1', quantity: 260, average: 100.10, status: 'COMPLETE' }, 1000)

  assert.equal(session.legs.CE!.position?.quantity, 260)
  assert.equal(session.legs.CE!.position?.direction, 'buy')

  // Trying to enter again while position is active throws
  const overlapIntent: OrderIntent = { id: 'i2', tag: 't2', side: 'CE', symbol: 'NIFTY-CE', transaction: 'SELL', quantity: 260, reason: 'BREAKOUT', submittedAt: 0 }
  assert.throws(() => applyFill(session, overlapIntent, { orderId: 'f2', quantity: 260, average: 99.80, status: 'COMPLETE' }, 2000), /overlap/)
})

test('Controller starts Both strategy and persists preferences', async () => {
  const f = await fixture()
  f.controller.saveStrategySettings(bothSettings)
  await f.controller.start('paper', 'both')
  for (let i = 0; i < 25; i++) await tick()
  assert.equal(f.controller.session!.settings!.direction, 'both')
  assert.equal(strategyName(f.controller.session!.settings), '009 Breakout – Both (Buy & Sell)')
})
