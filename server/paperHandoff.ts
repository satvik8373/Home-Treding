import { createHash } from 'node:crypto'
import { Store } from './store.ts'
import type { TradingSession } from '../shared/model.ts'
import { validateSettings, settingsFor } from '../shared/settings.ts'
import type { StrategySettings } from '../shared/settings.ts'
import { directionOf } from '../shared/strategy.ts'
import { hasExposure } from './controller.ts'
import { istDate, istTime } from './time.ts'

export interface PaperHandoff { version: 1; session: TradingSession; preferences: { buy: StrategySettings; sell: StrategySettings }; history: TradingSession[] }
export function exportPaperHandoff(store: Store): PaperHandoff {
  const session = store.session()
  if (!session || session.mode !== 'paper' || session.pending) throw new Error('Only a checkpointed Paper session without a pending order can be transferred.')
  const buy = validateSettings({ ...(store.get('strategy:settings') ?? settingsFor(session)) as object, direction: 'buy' })
  const sell = validateSettings(store.get('strategy:settings:sell') ?? { ...buy, direction: 'sell' })
  return { version: 1, session, preferences: { buy, sell }, history: store.keys('session:history:').map(key => store.get<TradingSession>(key)!).filter(value => value?.account === session.account) }
}
export function importPaperHandoff(target: Store, input: PaperHandoff, now = Date.now()): 'imported' | 'unchanged' {
  const pack = structuredClone(input), source = pack.session, credentials = target.broker()
  if (pack.version !== 1 || !source || source.mode !== 'paper' || source.pending || !source.id || !credentials || credentials.account !== source.account) throw new Error('Paper handoff must match this workspace’s already linked broker account.')
  const settings = validateSettings(settingsFor(source))
  const active = ['armed', 'preparing', 'running', 'stopping']
  if (source.status === 'stopping' || active.includes(source.status) && (source.date !== istDate(now) || now >= istTime(source.date, settings.cutoff))) throw new Error('An active Paper session can only continue on its current trading day before cutoff.')
  if (hasExposure(source) && !['running', 'armed', 'preparing'].includes(source.status)) throw new Error('Resolve blocked Paper exposure before handoff.')
  const fingerprint = createHash('sha256').update(JSON.stringify(pack)).digest('hex'), receipt = `handoff:paper:${source.id}`
  if (target.get(receipt) === fingerprint) return 'unchanged'
  const existing = target.session()
  if (existing && (active.includes(existing.status) || hasExposure(existing) || existing.trades.length > 0)) throw new Error('The destination has its own active session or trading history. It cannot be overwritten.')
  for (const old of pack.history) {
    if (old.account !== source.account) throw new Error('History belongs to another broker account.')
    const saved = target.get(`session:history:${old.id}`)
    if (saved && JSON.stringify(saved) !== JSON.stringify(old)) throw new Error('A conflicting history record already exists.')
  }
  const buy = validateSettings({ ...pack.preferences.buy, direction: 'buy' }), sell = validateSettings({ ...pack.preferences.sell, direction: 'sell' })
  target.transaction(() => {
    for (const old of pack.history) target.put(`session:history:${old.id}`, old)
    target.put('strategy:settings', buy); target.put('strategy:settings:sell', sell)
    target.put('session', source); target.put(`session:history:${source.id}`, source)
    target.put(`session:${source.date}:${source.account}:paper${directionOf(source.settings) === 'sell' ? ':sell' : ''}`, source)
    target.put(receipt, fingerprint)
  })
  return 'imported'
}
