import { directionOf, signFor, isBeyondEntry, entryTransaction, exitTransaction, referenceStop } from '../shared/strategy.ts'
import { targetPrice, targetDeadline } from '../shared/targets.ts'
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
  return { upper: money(referenceClose * (1 + (directionOf(settings) === 'sell' ? settings.exitPercent : settings.breakoutPercent) / 100)), lower: money(referenceClose * (1 - (directionOf(settings) === 'sell' ? settings.breakoutPercent : settings.exitPercent) / 100)) }
}
/** Only a completed close after the full exit may reset the fixed-level re-entry gate. */
export function observeReentry(leg: Leg, candle: Candle, now: number, settings: StrategySettings = DEFAULT_SETTINGS): void {
  const afterExit = leg.entries > 0 && leg.lastExitAt != null && candle.end > leg.lastExitAt
  const afterMissedFirst = leg.entries === 0 && leg.firstSignalConsumed === true && candle.end > leg.lastCandleEnd
  if (!leg.position && (afterExit || afterMissedFirst) && validCandle(candle)
    && candle.end <= now && signFor(settings) * (candle.close - (directionOf(settings) === 'sell' ? leg.lower : leg.upper)) < 0) leg.reentryReady = true
}
export function candleSignal(leg: Leg, candle: Candle, now: number, day: string, settings: StrategySettings = DEFAULT_SETTINGS): 'BREAKOUT' | 'LOWER_CLOSE' | 'UPPER_CLOSE' | null {
  if (!validCandle(candle) || candle.end <= leg.lastCandleEnd || candle.end > now
    || candle.start < istTime(day, RULES.referenceEnd) || candle.end >= istTime(day, settings.cutoff)) return null
  if (leg.position && (directionOf(settings) === 'sell' ? candle.close > leg.upper : candle.close < leg.lower)) return directionOf(settings) === 'sell' ? 'UPPER_CLOSE' : 'LOWER_CLOSE'
  // Old candles can explain history but may never place a late BUY.
  if (!leg.position && settings.enabledSides.includes(leg.contract.side) && (!settings.maxEntriesPerLeg || leg.entries < settings.maxEntriesPerLeg)
    && now - candle.end <= 90_000 && (leg.entries === 0 && !leg.firstSignalConsumed ? isBeyondEntry(candle.close, leg, settings, true) : leg.reentryReady === true && isBeyondEntry(candle.close, leg, settings))) return 'BREAKOUT'
  return null
}
export function targetSignal(leg: Leg, price: number, settings: StrategySettings = DEFAULT_SETTINGS, now = Date.now()): 'TARGET_1' | 'TARGET_2' | null {
  if (!leg.position || !Number.isFinite(price) || price <= 0) return null
  const target = leg.position.target1Remaining > 0 ? 1 : 2
  const level = targetPrice(settings, target, leg.position.average)
  const deadline = targetDeadline(settings, target, leg.position.entryAt, istDate(now))
  if (level != null ? signFor(settings) * (price - level) >= 0 : deadline != null && now >= deadline) return target === 1 ? 'TARGET_1' : 'TARGET_2'
  return null
}
export function stopLossSignal(leg: Leg, price: number, settings: StrategySettings = DEFAULT_SETTINGS): 'STOP_LOSS' | null {
  return leg.position && Number.isFinite(price) && price > 0 && (settings.stopLossPoints ?? 0) > 0
    && signFor(settings) * (price - referenceStop(leg.reference.close, settings)) <= 0 ? 'STOP_LOSS' : null
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
  if (fill.quantity > 0 && intent.transaction !== (entering ? entryTransaction(settings) : exitTransaction(settings))) throw new Error('Fill transaction does not match the saved strategy direction.')
  if (fill.quantity > 0 && entering) {
    if (leg.position) throw new Error('A confirmed entry would overlap an existing strategy position.')
    leg.position = { entryAt: now, quantity: fill.quantity, average: fill.average, entryQuantity: fill.quantity,
      target1Remaining: Math.min(settingsFor(session).target1Lots * leg.contract.lotSize, fill.quantity) }
    leg.entries++
    leg.reentryReady = false
  } else if (fill.quantity > 0) {
    if (!leg.position || fill.quantity > leg.position.quantity) throw new Error('Exit fill exceeds the tracked position quantity.')
    pnl = money(signFor(settings) * (fill.average - leg.position.average) * fill.quantity)
    leg.realized = money(leg.realized + pnl)
    leg.position.quantity -= fill.quantity
    if (intent.reason === 'TARGET_1') leg.position.target1Remaining = Math.max(0, leg.position.target1Remaining - fill.quantity)
    if (leg.position.quantity === 0) { leg.position = null; leg.exitReason = null; leg.lastExitAt = now; leg.reentryReady = false }
  }
  if (fill.quantity > 0) session.trades.push({ id: intent.id, at: now, side: intent.side, symbol: intent.symbol,
    transaction: intent.transaction, quantity: fill.quantity, price: fill.average,
    reason: intent.reason, orderId: fill.orderId, mode: session.mode, pnl })
  // Only the fill commit clears the durable order intent.
  session.pending = null
}
