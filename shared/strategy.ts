import type { Position } from './model.ts'
import type { StrategySettings } from './settings.ts'
export type StrategyDirection = 'buy' | 'sell' | 'both'
export const directionOf = (settings?: Pick<StrategySettings, 'direction'> | null): StrategyDirection =>
  settings?.direction === 'sell' ? 'sell' : settings?.direction === 'both' ? 'both' : 'buy'

export const signFor = (settings?: Pick<StrategySettings, 'direction'> | null, positionDirection?: 'buy' | 'sell' | null) => {
  if (positionDirection) return positionDirection === 'sell' ? -1 : 1
  return directionOf(settings) === 'sell' ? -1 : 1
}

export function positionPnl(position: Position, premium: number, settings?: Pick<StrategySettings, 'direction'>): number {
  return signFor(settings, position.direction) * (premium - position.average) * position.quantity
}

export const strategyName = (settings?: Pick<StrategySettings, 'direction'> | StrategyDirection | null) => {
  const dir = typeof settings === 'string' ? settings : directionOf(settings)
  return dir === 'sell' ? '009 Breakout – Sell' : dir === 'both' ? '009 Breakout – Both (Buy & Sell)' : '009 Breakout – Buy'
}

export const entryTransaction = (settings?: Pick<StrategySettings, 'direction'>, directionOverride?: 'buy' | 'sell') => {
  if (directionOverride) return directionOverride === 'sell' ? 'SELL' as const : 'BUY' as const
  return directionOf(settings) === 'sell' ? 'SELL' as const : 'BUY' as const
}

export const exitTransaction = (settings?: Pick<StrategySettings, 'direction'>, positionDirection?: 'buy' | 'sell' | null) => {
  if (positionDirection) return positionDirection === 'sell' ? 'BUY' as const : 'SELL' as const
  return directionOf(settings) === 'sell' ? 'BUY' as const : 'SELL' as const
}

export const referenceStop = (reference: number, settings: StrategySettings, positionDirection?: 'buy' | 'sell' | null) =>
  Math.round((reference - signFor(settings, positionDirection) * (settings.stopLossPoints ?? 0) + Number.EPSILON) * 100) / 100

export const entryLevel = (leg: { upper: number; lower: number }, settings?: Pick<StrategySettings, 'direction'>) =>
  directionOf(settings) === 'sell' ? leg.lower : leg.upper

export const isBeyondEntry = (price: number, leg: { upper: number; lower: number }, settings?: Pick<StrategySettings, 'direction'>, inclusive = false) => {
  const dir = directionOf(settings)
  if (dir === 'both') {
    return inclusive ? (price >= leg.upper || price <= leg.lower) : (price > leg.upper || price < leg.lower)
  }
  const movement = signFor(settings) * (price - entryLevel(leg, settings))
  return inclusive ? movement >= 0 : movement > 0
}
