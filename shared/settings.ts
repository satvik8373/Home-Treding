import type { Side } from './model.ts'

export interface StrategySettings {
  breakoutPercent: number; exitPercent: number; entryLots: number; target1Lots: number;
  target1Points: number; target2Points: number; cutoff: string; maxEntriesPerLeg: number;
  enabledSides: Side[]; feePerOrderEstimate: number;
}
export const DEFAULT_SETTINGS: StrategySettings = { breakoutPercent: 0.09, exitPercent: 0.09, entryLots: 4, target1Lots: 2,
  target1Points: 20, target2Points: 40, cutoff: '15:10', maxEntriesPerLeg: 0, enabledSides: ['CE', 'PE'], feePerOrderEstimate: 0 }
// Sessions saved before rule snapshots existed used 3 lots and a 1+2 split.
export const LEGACY_SETTINGS: StrategySettings = { ...DEFAULT_SETTINGS, entryLots: 3, target1Lots: 1 }
export function validateSettings(input: unknown): StrategySettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Strategy settings must be an object.')
  const body = input as Record<string, unknown>
  const number = (key: keyof StrategySettings, min: number, max: number, integer = false) => {
    const value = body[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) throw new Error(`${key} must be ${integer ? 'an integer ' : ''}from ${min} to ${max}.`)
    return value
  }
  const entryLots = number('entryLots', 1, 20, true), target1Lots = number('target1Lots', 0, 19, true)
  if (target1Lots >= entryLots) throw new Error('First-target lots must be smaller than entry lots. Use 0 to skip the first target.')
  const target1Points = number('target1Points', 0.05, 1000), target2Points = number('target2Points', 0.1, 2000)
  if (target2Points <= target1Points) throw new Error('Target 2 points must exceed target 1 points.')
  if (typeof body.cutoff !== 'string' || !/^\d{2}:\d{2}$/.test(body.cutoff)) throw new Error('Choose a valid cutoff time.')
  const [h, m] = body.cutoff.split(':').map(Number), minutes = h * 60 + m
  if (m >= 60 || minutes < 570 || minutes > 925 || m % 5 !== 0) throw new Error('Cutoff must be on a five-minute boundary from 09:30 to 15:25 IST.')
  if (!Array.isArray(body.enabledSides) || !body.enabledSides.length || body.enabledSides.length > 2 || new Set(body.enabledSides).size !== body.enabledSides.length || body.enabledSides.some(side => !['CE', 'PE'].includes(String(side)))) throw new Error('Enable CALL, PUT, or both without duplicate legs.')
  return { breakoutPercent: number('breakoutPercent', 0.01, 10), exitPercent: number('exitPercent', 0.01, 10), entryLots, target1Lots, target1Points, target2Points,
    cutoff: body.cutoff, maxEntriesPerLeg: number('maxEntriesPerLeg', 0, 100, true), enabledSides: [...body.enabledSides].sort() as Side[], feePerOrderEstimate: number('feePerOrderEstimate', 0, 1000) }
}
export function settingsFor(session?: { settings?: StrategySettings } | null): StrategySettings { return session ? session.settings ?? LEGACY_SETTINGS : DEFAULT_SETTINGS }
export function sameSettings(a: StrategySettings, b: StrategySettings) { return JSON.stringify(validateSettings(a)) === JSON.stringify(validateSettings(b)) }
