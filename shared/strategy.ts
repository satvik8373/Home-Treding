import type { StrategySettings } from './settings.ts'
export type StrategyDirection = 'buy' | 'sell'
export const directionOf = (settings?: Pick<StrategySettings, 'direction'> | null): StrategyDirection => settings?.direction === 'sell' ? 'sell' : 'buy'
export const signFor = (settings?: Pick<StrategySettings, 'direction'> | null) => directionOf(settings) === 'sell' ? -1 : 1
export const strategyName = (settings?: Pick<StrategySettings, 'direction'> | StrategyDirection | null) => `009 Breakout – ${settings === 'sell' || typeof settings === 'object' && directionOf(settings) === 'sell' ? 'Sell' : 'Buy'}`
export const entryTransaction = (settings?: Pick<StrategySettings, 'direction'>) => directionOf(settings) === 'sell' ? 'SELL' as const : 'BUY' as const
export const exitTransaction = (settings?: Pick<StrategySettings, 'direction'>) => directionOf(settings) === 'sell' ? 'BUY' as const : 'SELL' as const
export const referenceStop = (reference: number, settings: StrategySettings) => Math.round((reference - signFor(settings) * (settings.stopLossPoints ?? 0) + Number.EPSILON) * 100) / 100
export const entryLevel = (leg: { upper: number; lower: number }, settings?: Pick<StrategySettings, 'direction'>) => directionOf(settings) === 'sell' ? leg.lower : leg.upper
export const isBeyondEntry = (price: number, leg: { upper: number; lower: number }, settings?: Pick<StrategySettings, 'direction'>, inclusive = false) => {
  const movement = signFor(settings) * (price - entryLevel(leg, settings))
  return inclusive ? movement >= 0 : movement > 0
}
