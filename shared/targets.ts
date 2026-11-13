import { signFor } from './strategy.ts'
import type { StrategySettings } from './settings.ts'

export type TargetRule = { kind: 'points' | 'percent' | 'price' | 'minutes'; value: number } | { kind: 'clock'; time: string }
export type TargetNumber = 1 | 2
export function targetRule(settings: StrategySettings, target: TargetNumber): TargetRule {
  return settings[target === 1 ? 'target1Rule' : 'target2Rule'] ?? { kind: 'points', value: target === 1 ? settings.target1Points : settings.target2Points }
}
export function targetPrice(settings: StrategySettings, target: TargetNumber, entry: number): number | null {
  const rule = targetRule(settings, target)
  if (rule.kind === 'minutes' || rule.kind === 'clock') return null
  const value = rule.kind === 'price' ? rule.value : rule.kind === 'percent' ? entry * (1 + signFor(settings) * rule.value / 100) : entry + signFor(settings) * rule.value
  return Math.round((value + Number.EPSILON) * 100) / 100
}
export function targetDeadline(settings: StrategySettings, target: TargetNumber, entryAt: number | undefined, day: string): number | null {
  const rule = targetRule(settings, target)
  if (rule.kind === 'clock') return Date.parse(`${day}T${rule.time}:00+05:30`)
  if (rule.kind === 'minutes' && entryAt != null && Number.isFinite(entryAt)) return entryAt + rule.value * 60_000
  return null
}
export function targetLabel(settings: StrategySettings, target: TargetNumber): string {
  const rule = targetRule(settings, target)
  return rule.kind === 'clock' ? rule.time ? `${rule.time} IST` : 'Select IST time' : rule.kind === 'minutes' ? `${rule.value} min after entry` : rule.kind === 'price' ? `₹${rule.value} premium` : rule.kind === 'percent' ? `Entry ${signFor(settings) > 0 ? '+' : '−'}${rule.value}%` : `Entry ${signFor(settings) > 0 ? '+' : '−'}₹${rule.value}`
}
