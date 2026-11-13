import type { Mode, TradingSession } from './model.ts'
import { directionOf } from './strategy.ts'
import { productFor, settingsFor } from './settings.ts'

export type Grouping = 'day' | 'week' | 'month'
export interface AnalyticsFilters { from: string; to: string; mode: Mode; strategy: 'all' | 'buy' | 'sell'; product: 'all' | 'MIS' | 'NRML'; group: Grouping; account: string }
export interface SessionSummary { id: string; date: string; mode: Mode; strategy: string; product: string; account: string; status: string; fills: number; entries: number; closedCycles: number; wins: number; losses: number; breakeven: number; realizedGross: number | null; estimatedCosts: number; estimatedNet: number | null; openLegs: number; pending: boolean; journalCoverage: string; events: number; syncedAt: number | null; syncPending: boolean }
export interface AnalyticsStats { sessions: number; fills: number; entries: number; closedCycles: number; wins: number; losses: number; breakeven: number; winRate: number | null; realizedGross: number | null; verifiedSubtotal: number; estimatedCosts: number; estimatedNet: number | null; unverifiedSessions: number; openLegs: number; pendingOrders: number; profitFactor: number | null; maxDrawdown: number | null }
export interface AnalyticsReport { filters: AnalyticsFilters; checkedAt: number; accounts: string[]; earliest: string | null; sessions: SessionSummary[]; totals: AnalyticsStats; buckets: { period: string; stats: AnalyticsStats }[]; persistence?: { historyFirestore?: string; historyLastSyncedAt?: number | null } }
export const periodFor = (day: string, group: Grouping) => {
  if (group === 'month') return day.slice(0, 7)
  if (group === 'day') return day
  const date = new Date(`${day}T00:00:00Z`), offset = (date.getUTCDay() + 6) % 7
  return new Date(date.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
}
export interface ClosedCycle { at: number; pnl: number }
export function cycles(session: TradingSession): ClosedCycle[] {
  const open = new Map<string, { remaining: number; pnl: number }>(), closed: ClosedCycle[] = []
  for (const trade of [...session.trades].sort((a, b) => a.at - b.at)) {
    const key = `${trade.side}:${trade.symbol}`
    if (trade.reason === 'BREAKOUT') { open.set(key, { remaining: trade.quantity, pnl: 0 }); continue }
    const cycle = open.get(key)
    if (!cycle || trade.quantity > cycle.remaining || trade.pnl == null) { open.delete(key); continue }
    cycle.remaining -= trade.quantity; cycle.pnl += trade.pnl
    if (!cycle.remaining) { closed.push({ at: trade.at, pnl: Math.round(cycle.pnl * 100) / 100 }); open.delete(key) }
  }
  return closed
}
const round = (value: number) => Math.round(value * 100) / 100
function verifiedLedger(session: TradingSession): boolean {
  if (!session.pnlVerified) return false
  const remaining = new Map<string, number>(), entering = directionOf(session.settings) === 'sell' ? 'SELL' : 'BUY'
  for (const trade of [...session.trades].sort((a, b) => a.at - b.at)) {
    const key = `${trade.side}:${trade.symbol}`, quantity = remaining.get(key) ?? 0
    if (!Number.isInteger(trade.quantity) || trade.quantity <= 0 || trade.mode !== session.mode) return false
    if (trade.reason === 'BREAKOUT') { if (quantity || trade.transaction !== entering) return false; remaining.set(key, trade.quantity) }
    else { if (trade.quantity > quantity || trade.transaction === entering || trade.pnl == null || !Number.isFinite(trade.pnl)) return false; remaining.set(key, quantity - trade.quantity) }
  }
  for (const [key, quantity] of remaining) {
    const leg = Object.values(session.legs).find(leg => leg && `${leg.contract.side}:${leg.contract.symbol}` === key)
    if (quantity !== (leg?.position?.quantity ?? 0)) return false
  }
  return true
}
export function summarize(session: TradingSession): Omit<SessionSummary, 'journalCoverage' | 'events' | 'syncedAt' | 'syncPending'> {
  const verified = verifiedLedger(session), completed = verified ? cycles(session) : [], estimatedCosts = round(settingsFor(session).feePerOrderEstimate * session.trades.length)
  const realizedGross = verified ? round(session.trades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0)) : null
  return { id: session.id, date: session.date, mode: session.mode, strategy: directionOf(session.settings), product: productFor(settingsFor(session)), account: session.account, status: session.status, fills: session.trades.length, entries: session.trades.filter(trade => trade.reason === 'BREAKOUT').length, closedCycles: completed.length, wins: completed.filter(x => x.pnl > 0).length, losses: completed.filter(x => x.pnl < 0).length, breakeven: completed.filter(x => x.pnl === 0).length, realizedGross, estimatedCosts, estimatedNet: realizedGross == null ? null : round(realizedGross - estimatedCosts), openLegs: Object.values(session.legs).filter(leg => !!leg?.position).length, pending: !!session.pending }
}
export function aggregate(sessions: TradingSession[]): AnalyticsStats {
  const rows = sessions.map(summarize), completed = sessions.filter(verifiedLedger).flatMap(cycles).sort((a, b) => a.at - b.at)
  return aggregateSummaries(rows, completed)
}
export function aggregateSummaries(rows: ReturnType<typeof summarize>[], completed: ClosedCycle[]): AnalyticsStats {
  completed = [...completed].sort((a, b) => a.at - b.at)
  const sum = (key: 'fills' | 'entries' | 'closedCycles' | 'wins' | 'losses' | 'breakeven' | 'estimatedCosts' | 'openLegs') => rows.reduce((n, row) => n + row[key], 0)
  const unverifiedSessions = rows.filter(row => row.realizedGross == null).length, verifiedSubtotal = round(rows.reduce((n, row) => n + (row.realizedGross ?? 0), 0))
  let equity = 0, peak = 0, maxDrawdown = 0
  for (const cycle of completed) { equity += cycle.pnl; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity) }
  const profits = completed.filter(x => x.pnl > 0).reduce((n, x) => n + x.pnl, 0), losses = -completed.filter(x => x.pnl < 0).reduce((n, x) => n + x.pnl, 0)
  return { sessions: rows.length, fills: sum('fills'), entries: sum('entries'), closedCycles: completed.length, wins: sum('wins'), losses: sum('losses'), breakeven: sum('breakeven'), winRate: completed.length ? round(sum('wins') / completed.length * 100) : null, realizedGross: unverifiedSessions || !rows.length ? null : verifiedSubtotal, verifiedSubtotal, estimatedCosts: round(sum('estimatedCosts')), estimatedNet: unverifiedSessions || !rows.length ? null : round(verifiedSubtotal - sum('estimatedCosts')), unverifiedSessions, openLegs: sum('openLegs'), pendingOrders: rows.filter(row => row.pending).length, profitFactor: unverifiedSessions || !losses ? null : round(profits / losses), maxDrawdown: unverifiedSessions || !completed.length ? null : round(maxDrawdown) }
}
