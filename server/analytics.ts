import { parse } from 'csv-parse/sync'
import type { AppState, TradingSession } from '../shared/model.ts'
import { aggregateSummaries, cycles, periodFor, summarize } from '../shared/analytics.ts'
import type { AnalyticsFilters, AnalyticsReport } from '../shared/analytics.ts'
import { directionOf } from '../shared/strategy.ts'
import { productFor, settingsFor } from '../shared/settings.ts'
import { csvRows, istFields, ordersReport, tradesReport } from './reports.ts'
import type { BacktestRepository } from './backtest/service.ts'
import type { HistoryKind, SessionHistory } from './sessionHistory.ts'
import { istDate } from './time.ts'
import type { Snapshot } from './backup/firestore.ts'

export type AnalyticsRepository = BacktestRepository & { history?: SessionHistory }
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export function analyticsFilters(query: Record<string, unknown>, now = Date.now()): AnalyticsFilters {
  const today = istDate(now), from = String(query.from ?? new Date(Date.parse(today) - 29 * 86_400_000).toISOString().slice(0, 10)), to = String(query.to ?? today)
  if (!validDay(from) || !validDay(to) || from > to || Date.parse(to) - Date.parse(from) > 3660 * 86_400_000) throw new Error('Choose a valid date range of up to ten years.')
  const mode = String(query.mode ?? 'live'), strategy = String(query.strategy ?? 'all'), product = String(query.product ?? 'all'), group = String(query.group ?? 'day'), account = String(query.account ?? '')
  if (!['paper', 'live'].includes(mode) || !['all', 'buy', 'sell'].includes(strategy) || !['all', 'MIS', 'NRML'].includes(product) || !['day', 'week', 'month'].includes(group) || account.length > 100) throw new Error('Invalid analytics filters. Paper and Live must be reviewed separately.')
  return { from, to, mode, strategy, product, group, account } as AnalyticsFilters
}
export class Analytics {
  constructor(private repository: AnalyticsRepository, private current: () => TradingSession | null, private persistence: () => AppState['persistence'] = () => undefined, private now = Date.now, private cloudArchive?: (session: TradingSession) => Promise<Snapshot | null>) {}
  private saved(from?: string, to?: string, compact = false): TradingSession[] {
    const sessions = new Map<string, TradingSession>()
    if (this.repository.history) { for (const value of this.repository.history.sessions(from, to, compact)) sessions.set(value.id, value) }
    else for (const key of this.repository.keys('session:history:')) { const value = this.repository.get<TradingSession>(key); if (value?.id) sessions.set(value.id, value) }
    const current = this.current(); if (current) sessions.set(current.id, structuredClone(current))
    return [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  }
  selected(filters: AnalyticsFilters): TradingSession[] {
    return this.saved(filters.from, filters.to, true).filter(s => s.date >= filters.from && s.date <= filters.to && s.mode === filters.mode && (!filters.account || s.account === filters.account) && (filters.strategy === 'all' || directionOf(s.settings) === filters.strategy) && (filters.product === 'all' || productFor(settingsFor(s)) === filters.product))
  }
  read(query: Record<string, unknown>): AnalyticsReport {
    const filters = analyticsFilters(query, this.now()), days = this.repository.history?.days() ?? []
    const cached = this.repository.history?.summaries(filters) ?? this.selected(filters).map(session => ({ summary: summarize(session), cycles: summarize(session).realizedGross == null ? [] : cycles(session) }))
    const metadata = this.repository.history?.metadata(), all = metadata ? [] : this.saved()
    const grouped = new Map<string, typeof cached>()
    for (const row of cached) { const key = periodFor(row.summary.date, filters.group); grouped.set(key, [...(grouped.get(key) ?? []), row]) }
    const stats = (rows: typeof cached) => aggregateSummaries(rows.map(row => row.summary), rows.flatMap(row => row.cycles))
    return { filters, checkedAt: this.now(), accounts: metadata?.accounts ?? [...new Set(all.map(s => s.account))].sort(), earliest: metadata?.earliest ?? all[0]?.date ?? null, totals: stats(cached), buckets: [...grouped].map(([period, rows]) => ({ period, stats: stats(rows) })), persistence: this.persistence(), sessions: cached.map(({ summary: session }) => {
      const day = days.find(d => d.day === session.date), count = this.repository.history?.events(session.id, undefined, 0, 0).total ?? 0
      return { ...session, journalCoverage: day?.coverage ?? 'legacy-partial', events: count, syncedAt: day?.syncedAt ?? null, syncPending: !!day && day.revision > day.syncedRevision }
    }) }
  }
  async detail(id: string, query: Record<string, unknown>) {
    const current = this.current(), session = current?.id === id ? current : this.repository.history ? this.repository.history.session(id) : this.saved().find(s => s.id === id)
    if (!session) throw new Error('This session is not available in your workspace.')
    const kind = query.kind ? String(query.kind) as HistoryKind : undefined
    if (kind && !['activity', 'decision', 'order', 'trade'].includes(kind)) throw new Error('Invalid event type.')
    const offset = Number(query.offset ?? 0), limit = Number(query.limit ?? 100)
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid history page.')
    let journal = this.repository.history?.events(id, kind, offset, limit) ?? { events: [], total: 0 }
    const coverage = this.repository.history?.days().find(d => d.day === session.date)?.coverage ?? 'legacy-partial'
    let cloudIssue: string | null = null
    if (coverage === 'legacy-partial' && this.cloudArchive) {
      try {
        const cloud = await this.cloudArchive(session)
        if (cloud) {
          const remote = cloud.records.filter(row => row.key.startsWith('journal:')).map(row => JSON.parse(row.value) as import('./sessionHistory.ts').HistoryEvent).filter(event => event.sessionId === id && (!kind || event.kind === kind))
          const local: typeof remote = []
          for (let page = 0; page < journal.total; page += 1000) local.push(...(this.repository.history?.events(id, kind, page, 1000).events ?? []))
          const combined = [...new Map([...remote, ...local].map(event => [event.id, event])).values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
          journal = { total: combined.length, events: combined.slice(offset, offset + limit) }
        }
      } catch { cloudIssue = 'Cloud archive is unavailable; retained local events are shown.' }
    }
    return { session, ...journal, coverage, cloudIssue, offset, limit }
  }
  export(query: Record<string, unknown>) {
    const report = this.read(query), format = String(query.format ?? 'summary')
    const filename = `009-${report.filters.mode}-${format}-${report.filters.from}-${report.filters.to}.csv`
    if (format === 'summary') {
      const rows = report.buckets.map(b => ({ period: b.period, grouping: report.filters.group, mode: report.filters.mode, account_filter: report.filters.account || 'All saved workspace accounts', strategy_filter: report.filters.strategy, product_filter: report.filters.product, ...b.stats, scope: 'Saved engine sessions only; gross P&L excludes broker charges; drawdown uses verified completed cycles' }))
      return { filename, body: csvRows(['period', 'grouping', 'mode', 'account_filter', 'strategy_filter', 'product_filter', ...Object.keys(report.totals), 'scope'], rows) }
    }
    if (format === 'trades' || format === 'orders') {
      const selected = this.selected(report.filters)
      const rows = selected.flatMap(s => (parse((format === 'trades' ? tradesReport(s) : ordersReport(s)).body, { bom: true, columns: true }) as Record<string, string | number>[]).map(row => ({ ...row, broker_account: s.account }) as Record<string, string | number>))
      for (const row of rows) {
        row.report_scope = 'Selected saved engine history only; not the full broker ledger'
        for (const [key, value] of Object.entries(row)) if ((key.endsWith('_inr') || key.endsWith('_units') || key === 'lots') && value !== '' && Number.isFinite(Number(value))) row[key] = Number(value)
      }
      const fallback = (format === 'trades' ? tradesReport(null) : ordersReport(null)).body
      const columns = (parse(fallback, { bom: true }) as string[][])[0]
      columns.push('broker_account')
      const body = csvRows(columns, rows)
      if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error('This export is large. Choose a shorter date range.')
      return { filename, body }
    }
    if (format !== 'events') throw new Error('Choose summary, trades, orders or events.')
    const rows = report.sessions.flatMap(s => {
      const total = this.repository.history?.events(s.id, undefined, 0, 0).total ?? 0
      if (total > 5000) throw new Error('Choose one session or a smaller range for this large event export.')
      return (this.repository.history?.events(s.id, undefined, 0, 5000).events ?? []).map(event => ({ session_id: s.id, session_date: s.date, mode: s.mode, strategy: s.strategy, broker_product: s.product, ...istFields(event.at, 'event'), kind: event.kind, details_json: JSON.stringify(event.data) }))
    })
    const body = csvRows(['session_id', 'session_date', 'mode', 'strategy', 'broker_product', ...Object.keys(istFields(0, 'event')), 'kind', 'details_json'], rows)
    if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error('This export is large. Choose a shorter date range.')
    return { filename, body }
  }
  async eventPage(id: string, query: Record<string, unknown>) {
    if (!this.read(query).sessions.some(session => session.id === id)) throw new Error('This session is not in the selected report.')
    const detail = await this.detail(id, query)
    const rows = detail.events.map(event => ({ session_id: id, session_date: detail.session.date, mode: detail.session.mode, ...istFields(event.at, 'event'), kind: event.kind, details_json: JSON.stringify(event.data), scope: `Event page ${detail.offset + 1}-${Math.min(detail.offset + detail.limit, detail.total)} of ${detail.total}; ${detail.coverage}` }))
    return { filename: `009-${detail.session.mode}-events-${detail.session.date}-page-${Math.floor(detail.offset / detail.limit) + 1}.csv`, body: csvRows(['session_id', 'session_date', 'mode', ...Object.keys(istFields(0, 'event')), 'kind', 'details_json', 'scope'], rows) }
  }
}
