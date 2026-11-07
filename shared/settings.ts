import type { StrategyDirection } from './strategy.ts'
import { targetRule } from './targets.ts'
import type { TargetRule } from './targets.ts'
import type { Side } from './model.ts'

export interface StrategySettings {
  direction?: StrategyDirection;
  breakoutPercent: number; exitPercent: number; entryLots: number; target1Lots: number;
  target1Points: number; target2Points: number; cutoff: string; maxEntriesPerLeg: number;
  target1Rule?: TargetRule; target2Rule?: TargetRule;
  stopLossPoints?: number;
  enabledSides: Side[]; feePerOrderEstimate: number;
}
export const DEFAULT_SETTINGS: StrategySettings = { breakoutPercent: 0.09, exitPercent: 0.09, entryLots: 4, target1Lots: 2,
  target1Points: 20, target2Points: 40, stopLossPoints: 25, cutoff: '15:10', maxEntriesPerLeg: 0, enabledSides: ['CE', 'PE'], feePerOrderEstimate: 0 }
export const SELL_DEFAULT_SETTINGS: StrategySettings = { ...DEFAULT_SETTINGS, direction: 'sell' }
// Sessions saved before rule snapshots existed used 3 lots and a 1+2 split.
export const LEGACY_SETTINGS: StrategySettings = { ...DEFAULT_SETTINGS, entryLots: 3, target1Lots: 1, stopLossPoints: 0 }
export function validateSettings(input: unknown): StrategySettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Strategy settings must be an object.')
  const body = input as Record<string, unknown>
  if (body.direction !== undefined && !['buy', 'sell'].includes(String(body.direction))) throw new Error('Choose the Buy or Sell strategy.')
  const number = (key: keyof StrategySettings, min: number, max: number, integer = false) => {
    const value = body[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) throw new Error(`${key} must be ${integer ? 'an integer ' : ''}from ${min} to ${max}.`)
    return value
  }
  const entryLots = number('entryLots', 1, 20, true), target1Lots = number('target1Lots', 0, 19, true)
  if (target1Lots >= entryLots) throw new Error('First-target lots must be smaller than entry lots. Use 0 to skip the first target.')
  const target1Points = number('target1Points', 0.05, 1000), target2Points = number('target2Points', 0.1, 2000)
  if (!body.target1Rule && !body.target2Rule && target2Points <= target1Points) throw new Error('Target 2 points must exceed target 1 points.')
  if (typeof body.cutoff !== 'string' || !/^\d{2}:\d{2}$/.test(body.cutoff)) throw new Error('Choose a valid cutoff time.')
  const [h, m] = body.cutoff.split(':').map(Number), minutes = h * 60 + m
  if (m >= 60 || minutes < 570 || minutes > 925 || m % 5 !== 0) throw new Error('Cutoff must be on a five-minute boundary from 09:30 to 15:25 IST.')
  if (!Array.isArray(body.enabledSides) || !body.enabledSides.length || body.enabledSides.length > 2 || new Set(body.enabledSides).size !== body.enabledSides.length || body.enabledSides.some(side => !['CE', 'PE'].includes(String(side)))) throw new Error('Enable CALL, PUT, or both without duplicate legs.')
  const rule = (key: 'target1Rule' | 'target2Rule'): TargetRule | undefined => {
    if (body[key] === undefined) return undefined
    const r = body[key] as Record<string, unknown>
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error(`${key}: select a valid target type.`)
    if (r.kind === 'clock') {
      if (typeof r.time !== 'string' || !/^\d{2}:\d{2}$/.test(r.time) || r.time < '09:20' || r.time >= String(body.cutoff) || Number(r.time.slice(3)) >= 60) throw new Error(`${key}: IST time must be from 09:20 and before square-off.`)
      return { kind: 'clock', time: r.time }
    }
    if (!['points', 'percent', 'price', 'minutes'].includes(String(r.kind))) throw new Error(`${key}: unsupported target type.`)
    const value = r.value, max = r.kind === 'minutes' ? 360 : r.kind === 'percent' ? 1000 : 100000
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max || r.kind === 'minutes' && !Number.isInteger(value)) throw new Error(`${key}: enter a positive ${r.kind === 'minutes' ? 'whole minute' : 'price/percentage'} value up to ${max}.`)
    return { kind: r.kind as 'points' | 'percent' | 'price' | 'minutes', value }
  }
  const target1Rule = rule('target1Rule'), target2Rule = rule('target2Rule')
  const one = target1Rule ?? { kind: 'points', value: target1Points }, two = target2Rule ?? { kind: 'points', value: target2Points }
  if (target1Lots > 0 && one.kind === two.kind && ('time' in one && 'time' in two ? two.time <= one.time : 'value' in one && 'value' in two && two.value <= one.value)) throw new Error('For the same target type, target 2 must be above/later than target 1.')
  return { ...(body.direction === 'sell' ? { direction: 'sell' as const } : {}), ...(target1Rule ? { target1Rule } : {}), ...(target2Rule ? { target2Rule } : {}), breakoutPercent: number('breakoutPercent', 0.01, 10), exitPercent: number('exitPercent', 0.01, 10), entryLots, target1Lots, target1Points, target2Points, stopLossPoints: body.stopLossPoints === undefined ? 0 : number('stopLossPoints', 0, 2000),
    cutoff: body.cutoff, maxEntriesPerLeg: number('maxEntriesPerLeg', 0, 100, true), enabledSides: [...body.enabledSides].sort() as Side[], feePerOrderEstimate: number('feePerOrderEstimate', 0, 1000) }
}
export function settingsFor(session?: { settings?: StrategySettings } | null): StrategySettings { return session ? session.settings ?? LEGACY_SETTINGS : DEFAULT_SETTINGS }
export function sameSettings(a: StrategySettings, b: StrategySettings) {
  const canonical = (s: StrategySettings) => {
    const v = validateSettings(s)
    return { target1Rule: targetRule(v, 1), target2Rule: targetRule(v, 2), ...v, target1Points: 0, target2Points: 0 }
  }
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}
