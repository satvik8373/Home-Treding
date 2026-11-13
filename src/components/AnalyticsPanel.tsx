import { useEffect, useState } from 'react'
import type { Mode, TradingSession } from '../../shared/model'
import type { AnalyticsFilters, AnalyticsReport } from '../../shared/analytics'
import type { HistoryEvent, HistoryKind } from '../../server/sessionHistory'
import { money, dateTime } from '../lib/format'
import { strategyName } from '../../shared/strategy'
import { settingsFor, productFor } from '../../shared/settings'
import './AnalyticsPanel.css'

type Detail = { session: TradingSession; events: HistoryEvent[]; total: number; coverage: string; offset: number; limit: number; cloudIssue?: string | null }
const dayNow = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
const prior = (days: number) => new Date(Date.parse(dayNow()) - days * 86_400_000).toISOString().slice(0, 10)
const eventText = (event: HistoryEvent) => {
  const data = event.data as Record<string, unknown>
  if (event.kind === 'activity') return String(data.message ?? '')
  if (event.kind === 'decision') { const bar = data.candle as { close?: number } | undefined; return `${data.side ?? ''} · close ${bar?.close ?? '—'} · ${data.signal ?? 'No signal'} · ${data.explanation ?? ''}` }
  return event.kind === 'order' ? `${data.side ?? ''} ${data.transaction ?? ''} · ${data.quantity ?? ''} units · ${data.status ?? ''} · ${data.detail ?? ''}` : `${data.side ?? ''} ${data.transaction ?? ''} · ${data.quantity ?? ''} units @ ${data.price ?? ''} · ${data.reason ?? ''}`
}

export function AnalyticsPanel({ initialMode, online }: { initialMode: Mode; online: boolean }) {
  const [filters, setFilters] = useState<AnalyticsFilters>({ from: prior(29), to: dayNow(), mode: initialMode, strategy: 'all', product: 'all', group: 'day', account: '' })
  const [report, setReport] = useState<AnalyticsReport | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(''), [kind, setKind] = useState<HistoryKind | ''>(''), [offset, setOffset] = useState(0), [detail, setDetail] = useState<Detail | null>(null), [detailError, setDetailError] = useState('')
  const [format, setFormat] = useState('summary')
  const [exporting, setExporting] = useState(false)
  const params = new URLSearchParams({ ...filters }).toString()
  useEffect(() => {
    const cancel = new AbortController()
    void fetch(`/api/analytics?${params}`, { cache: 'no-store', signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(15_000)]) }).then(async response => {
      const value = await response.json(); if (!response.ok) throw Error(value.error || 'History could not be loaded.'); if (!cancel.signal.aborted) setReport(value)
    }).catch(error => { if (!cancel.signal.aborted) { setReport(null); setError(error instanceof Error ? error.message : 'History could not be loaded.') } }).finally(() => { if (!cancel.signal.aborted) setLoading(false) })
    return () => cancel.abort()
  }, [params, revision])
  useEffect(() => {
    if (!selected) return
    const cancel = new AbortController()
    void fetch(`/api/analytics/session/${encodeURIComponent(selected)}?${new URLSearchParams({ offset: String(offset), limit: '100', ...(kind ? { kind } : {}) })}`, { cache: 'no-store', signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(15_000)]) }).then(async response => {
      const value = await response.json(); if (!response.ok) throw Error(value.error || 'Session history unavailable.'); if (!cancel.signal.aborted) setDetail(value)
    }).catch(error => { if (!cancel.signal.aborted) setDetailError(error instanceof Error ? error.message : 'Session history unavailable.') })
    return () => cancel.abort()
  }, [selected, offset, kind, revision])
  const change = (patch: Partial<AnalyticsFilters>) => { setLoading(true); setError(''); setReport(null); setSelected(''); setDetail(null); setFilters(value => ({ ...value, ...patch })); setRevision(value => value + 1) }
  const openSession = (id: string) => { if (selected === id) return; setDetail(null); setDetailError(''); setSelected(id); setOffset(0); setKind('') }
  async function download(extra: Record<string, string> = { format }) {
    setExporting(true); setError('')
    try {
      const response = await fetch(`/api/analytics/export?${new URLSearchParams({ ...filters, ...extra })}`, { cache: 'no-store', signal: AbortSignal.timeout(25_000) })
      if (!response.ok) { const body = await response.json(); throw Error(body.error || 'Export unavailable.') }
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? '009-history.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setError(error instanceof Error ? error.message : 'Export unavailable.') }
    finally { setExporting(false) }
  }
  const stats = report?.totals
  return <section className="analytics-panel" aria-labelledby="analytics-title">
    <header className="analytics-heading"><div><h2 id="analytics-title">History & analytics</h2><p>Daily, Monday-based weekly and calendar-month reports · IST</p></div><button className="button secondary" disabled={loading || !online} onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1) }}>{loading ? 'Loading…' : 'Refresh history'}</button></header>
    <div className="analytics-filters">
      <label>From<input type="date" value={filters.from} onChange={e => change({ from: e.target.value })} /></label><label>To<input type="date" value={filters.to} onChange={e => change({ to: e.target.value })} /></label>
      <label>Mode<select value={filters.mode} onChange={e => change({ mode: e.target.value as Mode })}><option value="live">Live</option><option value="paper">Paper</option></select></label>
      <label>Report<select value={filters.group} onChange={e => change({ group: e.target.value as AnalyticsFilters['group'] })}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
      <label>Strategy<select value={filters.strategy} onChange={e => change({ strategy: e.target.value as AnalyticsFilters['strategy'] })}><option value="all">Buy + Sell</option><option value="buy">Breakout Buy</option><option value="sell">Breakout Sell</option></select></label>
      <label>Product<select value={filters.product} onChange={e => change({ product: e.target.value as AnalyticsFilters['product'] })}><option value="all">All products</option><option value="MIS">MIS</option><option value="NRML">NRML</option></select></label>
      {!!report?.accounts.length && <label>Broker account<select value={filters.account} onChange={e => change({ account: e.target.value })}><option value="">All saved accounts</option>{report.accounts.map(account => <option key={account}>{account}</option>)}</select></label>}
    </div>
    <div className="analytics-tools"><button className="text-button" onClick={() => change({ from: dayNow(), to: dayNow() })}>Today</button><button className="text-button" onClick={() => change({ from: prior(6), to: dayNow() })}>Last 7 days</button><button className="text-button" onClick={() => change({ from: dayNow().slice(0, 7) + '-01', to: dayNow() })}>This month</button>{report?.earliest && <button className="text-button" onClick={() => change({ from: report.earliest!, to: dayNow() })}>All saved</button>}<span className="analytics-mode">{filters.mode === 'paper' ? 'Paper · simulated fills' : 'Live · engine-confirmed fills'}</span></div>
    {error && <p className="analytics-error" role="alert">{error}</p>}
    {stats && <><div className="analytics-metrics"><div><span>Realized gross P&L</span><strong>{money(stats.realizedGross)}</strong><small>Before broker charges</small></div><div><span>Closed cycles</span><strong>{stats.closedCycles}</strong><small>{stats.entries} entries · {stats.fills} fills</small></div><div><span>Win rate · verified cycles</span><strong>{stats.winRate == null ? '—' : `${stats.winRate}%`}</strong><small>{stats.wins} wins · {stats.losses} losses · {stats.breakeven} flat</small></div><div><span>Maximum cycle drawdown</span><strong>{money(stats.maxDrawdown)}</strong><small>Gross closed-cycle equity</small></div></div>
      {!!stats.unverifiedSessions && <p className="analytics-warning" role="status">{stats.unverifiedSessions} session(s) have unverified accounting. Complete P&L is unavailable; verified-session subtotal: {money(stats.verifiedSubtotal)}.</p>}
      <p className="analytics-scope">Grouped by saved session date. Engine history only; manual broker trades and actual charges are not included. Estimated costs {money(stats.estimatedCosts)} · Estimated net {money(stats.estimatedNet)} · {stats.openLegs} open legs · {stats.pendingOrders} pending orders.</p>
      <div className="analytics-download"><label>CSV report<select value={format} onChange={e => setFormat(e.target.value)}><option value="summary">Period summary</option><option value="trades">Detailed fills</option><option value="orders">Order audit</option><option value="events">Engine events</option></select></label><button className="button secondary" disabled={exporting || loading} onClick={() => void download()}>{exporting ? 'Preparing…' : 'Download CSV'}</button><span>{report.persistence?.historyFirestore === 'synced' ? 'Daily archives saved to Firestore' : report.persistence?.historyFirestore === 'pending' ? 'Daily archives syncing' : report.persistence?.historyFirestore === 'unavailable' ? 'Cloud archive retrying · local history retained' : 'Cloud archives not configured'}</span></div>
      <div className="analytics-table-wrap"><table><caption>{filters.group === 'week' ? 'Weeks start on Monday' : filters.group === 'month' ? 'Calendar months' : 'Daily results'}</caption><thead><tr><th>Period</th><th>Sessions</th><th>Closed cycles</th><th>Gross P&L</th><th>Estimated net</th><th>Unverified</th></tr></thead><tbody>{report.buckets.map(bucket => <tr key={bucket.period}><td>{bucket.period}</td><td>{bucket.stats.sessions}</td><td>{bucket.stats.closedCycles}</td><td>{money(bucket.stats.realizedGross)}</td><td>{money(bucket.stats.estimatedNet)}</td><td>{bucket.stats.unverifiedSessions || '—'}</td></tr>)}{!report.buckets.length && <tr><td colSpan={6}>No saved {filters.mode} sessions in this date range.</td></tr>}</tbody></table></div>
      <h3>Saved sessions</h3><div className="analytics-table-wrap"><table><thead><tr><th>Date / strategy</th><th>Account / product</th><th>Status</th><th>Gross P&L</th><th>History coverage</th><th>Cloud copy</th><th>Details</th></tr></thead><tbody>{report.sessions.map(session => <tr key={session.id}><td>{session.date}<small>{session.strategy === 'sell' ? 'Breakout Sell' : 'Breakout Buy'}</small></td><td>{session.account}<small>{session.product}</small></td><td>{session.status}</td><td>{money(session.realizedGross)}</td><td>{session.journalCoverage === 'recorded' ? 'Journal recorded' : 'Legacy · partial logs'}<small>{session.events} events</small></td><td>{session.syncPending ? 'Pending' : session.syncedAt ? `Saved ${dateTime(session.syncedAt)}` : 'Not synced'}</td><td><button className="text-button" onClick={() => openSession(session.id)}>Open</button></td></tr>)}</tbody></table></div>
    </>}
    {selected && <section className="analytics-detail" aria-label="Session history"><header><h3>Session report</h3><button className="text-button" onClick={() => setSelected('')}>Close</button></header>{detailError && <p role="alert">{detailError}</p>}{!detail && !detailError && <p>Loading session history…</p>}{detail && <>
      <p>{detail.session.date} · {strategyName(detail.session.settings)} · {detail.session.mode.toUpperCase()} · {productFor(settingsFor(detail.session))}</p>
      <p>{detail.coverage === 'recorded' ? 'Journal retained from session recording.' : 'Only events present in the legacy snapshot could be recovered. Older trimmed logs are unavailable.'}</p>
      {detail.cloudIssue && <p role="status">{detail.cloudIssue}</p>}
      <details><summary>Locked rules, references and saved state</summary><pre>{JSON.stringify({ settings: settingsFor(detail.session), references: Object.fromEntries(Object.entries(detail.session.legs).map(([side, leg]) => [side, { contract: leg?.contract, reference: leg?.reference, upper: leg?.upper, lower: leg?.lower, position: leg?.position }])) }, null, 2)}</pre></details>
      <label className="analytics-kind">Event type<select value={kind} onChange={e => { setDetail(null); setDetailError(''); setKind(e.target.value as HistoryKind | ''); setOffset(0) }}><option value="">All events</option><option value="activity">Engine activity</option><option value="decision">Candle decisions</option><option value="order">Order lifecycle</option><option value="trade">Confirmed / simulated fills</option></select></label>
      <ol className="analytics-events">{detail.events.map(event => <li key={event.id}><time>{dateTime(event.at)} IST</time><span className="analytics-event-kind">{event.kind}</span><p>{eventText(event)}</p></li>)}</ol>{!detail.total && <p>No retained events for this selection.</p>}
      <div className="analytics-paging"><button className="button secondary" disabled={offset === 0} onClick={() => { setDetail(null); setDetailError(''); setOffset(value => Math.max(0, value - 100)) }}>Previous</button><span>{detail.total ? offset + 1 : 0}–{Math.min(offset + 100, detail.total)} of {detail.total}</span><button className="button secondary" disabled={offset + 100 >= detail.total} onClick={() => { setDetail(null); setDetailError(''); setOffset(value => value + 100) }}>Next</button><button className="text-button" disabled={exporting} onClick={() => void download({ format: 'events', sessionId: selected, offset: String(offset), limit: '100', kind })}>Download event page</button></div>
    </>}</section>}
  </section>
}
