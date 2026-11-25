import { directionOf, signFor, isBeyondEntry, entryTransaction, exitTransaction, referenceStop } from '../shared/strategy.ts'
import { targetPrice, targetDeadline, targetEnabled } from '../shared/targets.ts'
import { istDate } from './time.ts'
import type { Candle, Fill, Leg, OrderIntent, Reason, TradingSession } from '../shared/model.ts'
import { RULES } from '../shared/model.ts'
import { FIVE_MINUTES, istTime } from './time.ts'
import { DEFAULT_SETTINGS, settingsFor } from '../shared/settings.ts'
import type { StrategySettings } from '../shared/settings.ts'

export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export function validCandle(c: Candle): boolean {
  return [c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0)
    && c.high >= Math.max(c.open, c.close, c.low) && c.low <= Math.min(c.open, c.close)
    && c.end - c.start === FIVE_MINUTES
}
export function levels(referenceClose: number, settings: StrategySettings = DEFAULT_SETTINGS): { upper: number; lower: number } {
  if (!Number.isFinite(referenceClose) || referenceClose <= 0) throw new Error('A valid reference close is required.')
  const dir = directionOf(settings)
  const upPct = dir === 'sell' ? settings.exitPercent : settings.breakoutPercent
  const downPct = dir === 'buy' ? settings.exitPercent : settings.breakoutPercent
  return {
    upper: money(referenceClose * (1 + upPct / 100)),
    lower: money(referenceClose * (1 - downPct / 100))
  }
}
/** Only a completed close after the full exit may reset the fixed-level re-entry gate. */
export function observeReentry(leg: Leg, candle: Candle, now: number, settings: StrategySettings = DEFAULT_SETTINGS): void {
  const afterExit = leg.entries > 0 && leg.lastExitAt != null && candle.end > leg.lastExitAt
  const afterMissedFirst = leg.entries === 0 && leg.firstSignalConsumed === true && candle.end > leg.lastCandleEnd
  if (!leg.position && (afterExit || afterMissedFirst) && validCandle(candle) && candle.end <= now) {
    const dir = directionOf(settings)
    if (dir === 'both') {
      if (candle.close < leg.upper && candle.close > leg.lower) leg.reentryReady = true
    } else {
      if (signFor(settings) * (candle.close - (dir === 'sell' ? leg.lower : leg.upper)) < 0) leg.reentryReady = true
    }
  }
}
export function candleSignal(leg: Leg, candle: Candle, now: number, day: string, settings: StrategySettings = DEFAULT_SETTINGS): 'BREAKOUT' | 'LOWER_CLOSE' | 'UPPER_CLOSE' | null {
  if (!validCandle(candle) || candle.end <= leg.lastCandleEnd || candle.end > now
    || candle.start < istTime(day, RULES.referenceEnd) || candle.end >= istTime(day, settings.cutoff)) return null
  const dir = directionOf(settings)
  if (leg.position) {
    const posDir = leg.position.direction ?? (dir === 'sell' ? 'sell' : 'buy')
    if (posDir === 'sell' ? candle.close > leg.upper : candle.close < leg.lower) {
      return posDir === 'sell' ? 'UPPER_CLOSE' : 'LOWER_CLOSE'
    }
  }
  // Old candles can explain history but may never place a late BUY or SELL.
  if (!leg.position && settings.enabledSides.includes(leg.contract.side) && (!settings.maxEntriesPerLeg || leg.entries < settings.maxEntriesPerLeg)
    && now - candle.end <= 90_000) {
    if (dir === 'both') {
      const isFirst = leg.entries === 0 && !leg.firstSignalConsumed
      const ready = isFirst || leg.reentryReady === true
      if (ready) {
        if (candle.close >= leg.upper) {
          leg.pendingDirection = 'buy'
          return 'BREAKOUT'
        }
        if (candle.close <= leg.lower) {
          leg.pendingDirection = 'sell'
          return 'BREAKOUT'
        }
      }
    } else {
      if (leg.entries === 0 && !leg.firstSignalConsumed ? isBeyondEntry(candle.close, leg, settings, true) : leg.reentryReady === true && isBeyondEntry(candle.close, leg, settings)) {
        leg.pendingDirection = dir === 'sell' ? 'sell' : 'buy'
        return 'BREAKOUT'
      }
    }
  }
  return null
}
export function targetSignal(leg: Leg, price: number, settings: StrategySettings = DEFAULT_SETTINGS, now = Date.now()): 'TARGET_1' | 'TARGET_2' | null {
  if (!leg.position || !Number.isFinite(price) || price <= 0) return null
  const posDir = leg.position.direction ?? (directionOf(settings) === 'sell' ? 'sell' : 'buy')
  const sign = posDir === 'sell' ? -1 : 1
  const target = targetEnabled(settings, 1) && leg.position.target1Remaining > 0 ? 1 : 2
  const level = targetPrice(settings, target, leg.position.average, posDir)
  const deadline = targetDeadline(settings, target, leg.position.entryAt, istDate(now))
  if (level != null ? sign * (price - level) >= 0 : deadline != null && now >= deadline) return target === 1 ? 'TARGET_1' : 'TARGET_2'
  return null
}
export function stopLossSignal(leg: Leg, price: number, settings: StrategySettings = DEFAULT_SETTINGS): 'STOP_LOSS' | null {
  const posDir = leg.position?.direction ?? (directionOf(settings) === 'sell' ? 'sell' : 'buy')
  const sign = posDir === 'sell' ? -1 : 1
  return leg.position && Number.isFinite(price) && price > 0 && (settings.stopLossPoints ?? 0) > 0
    && sign * (price - referenceStop(leg.reference.close, settings, posDir)) <= 0 ? 'STOP_LOSS' : null
}
export function priceExitSignal(leg: Leg, price: number, settings: StrategySettings = DEFAULT_SETTINGS, now = Date.now()): 'STOP_LOSS' | 'TARGET_1' | 'TARGET_2' | null {
  return stopLossSignal(leg, price, settings) ?? targetSignal(leg, price, settings, now)
}
export function orderQuantity(leg: Leg, reason: Reason, settings: StrategySettings = DEFAULT_SETTINGS): number {
  if (reason === 'BREAKOUT') return settings.entryLots * leg.contract.lotSize
  if (!leg.position) return 0
  return reason === 'TARGET_1' ? Math.min(leg.position.quantity, leg.position.target1Remaining) : leg.position.quantity
}
export function applyFill(session: TradingSession, intent: OrderIntent, fill: Fill, now: number): void {
  const leg = session.legs[intent.side]
  if (!leg) throw new Error('Pending order has no corresponding strategy leg.')
  if (!Number.isInteger(fill.quantity) || fill.quantity < 0 || fill.quantity > intent.quantity
    || fill.quantity > 0 && (!Number.isFinite(fill.average) || fill.average <= 0)) throw new Error('Invalid confirmed fill.')
  let pnl: number | null = null
  const settings = settingsFor(session), entering = intent.reason === 'BREAKOUT'
  const dir = directionOf(settings)
  const expectedTx = entering
    ? (dir === 'both' ? intent.transaction : entryTransaction(settings))
    : (dir === 'both' ? (leg.position?.direction === 'sell' ? 'BUY' : 'SELL') : exitTransaction(settings))
  if (fill.quantity > 0 && intent.transaction !== expectedTx) throw new Error('Fill transaction does not match the saved strategy direction.')
  if (fill.quantity > 0 && entering) {
    if (leg.position) throw new Error('A confirmed entry would overlap an existing strategy position.')
    const posDir: 'buy' | 'sell' = intent.transaction === 'BUY' ? 'buy' : 'sell'
    leg.position = { entryAt: now, quantity: fill.quantity, average: fill.average, entryQuantity: fill.quantity,
      target1Remaining: targetEnabled(settings, 1) ? Math.min(settingsFor(session).target1Lots * leg.contract.lotSize, fill.quantity) : 0,
      direction: posDir }
    leg.entries++
    leg.reentryReady = false
    leg.pendingDirection = null
  } else if (fill.quantity > 0) {
    if (!leg.position || fill.quantity > leg.position.quantity) throw new Error('Exit fill exceeds the tracked position quantity.')
    const posDir = leg.position.direction ?? (dir === 'sell' ? 'sell' : 'buy')
    const sign = posDir === 'sell' ? -1 : 1
    pnl = money(sign * (fill.average - leg.position.average) * fill.quantity)
    leg.realized = money(leg.realized + pnl)
    leg.position.quantity -= fill.quantity
    if (intent.reason === 'TARGET_1') leg.position.target1Remaining = Math.max(0, leg.position.target1Remaining - fill.quantity)
    if (leg.position.quantity === 0) { leg.position = null; leg.exitReason = null; leg.lastExitAt = now; leg.reentryReady = false; leg.pendingDirection = null }
  }
  if (fill.quantity > 0) session.trades.push({ id: intent.id, at: now, side: intent.side, symbol: intent.symbol,
    transaction: intent.transaction, quantity: fill.quantity, price: fill.average,
    reason: intent.reason, orderId: fill.orderId, mode: session.mode, pnl })
  // Only the fill commit clears the durable order intent.
  session.pending = null
}
