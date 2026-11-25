import { useEffect, useState } from 'react'
import type { Mode, TradingSession } from '../../shared/model'
import type { AnalyticsFilters, AnalyticsReport } from '../../shared/analytics'
import { periodFor } from '../../shared/analytics'
import type { HistoryEvent, HistoryKind } from '../../server/sessionHistory'
import { DataGrid } from './DataGrid'
import { money, dateTime, pnlTone } from '../lib/format'
import { strategyName } from '../../shared/strategy'
import { settingsFor, productFor } from '../../shared/settings'
import { AnalyticsCalendar } from './AnalyticsCalendar'
import './AnalyticsPanel.css'

type Detail = { session: TradingSession; events: HistoryEvent[]; total: number; coverage: string; offset: number; limit: number; cloudIssue?: string | null }
const historyStart = () => new Date(Date.parse(dayNow()) - 3660 * 86_400_000).toISOString().slice(0, 10)
const dayNow = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
const eventText = (event: HistoryEvent) => {
  const data = event.data as Record<string, unknown>
  if (event.kind === 'activity') return String(data.message ?? '')
  if (event.kind === 'decision') { const bar = data.candle as { close?: number } | undefined; return `${data.side ?? ''} · close ${bar?.close ?? '—'} · ${data.signal ?? 'No signal'} · ${data.explanation ?? ''}` }
  return event.kind === 'order' ? `${data.side ?? ''} ${data.transaction ?? ''} · ${data.quantity ?? ''} units · ${data.status ?? ''} · ${data.detail ?? ''}` : `${data.side ?? ''} ${data.transaction ?? ''} · ${data.quantity ?? ''} units @ ${data.price ?? ''} · ${data.reason ?? ''}`
}

export function AnalyticsPanel({ initialMode, online }: { initialMode: Mode; online: boolean }) {
  const [filters, setFilters] = useState<AnalyticsFilters>({ from: historyStart(), to: dayNow(), mode: initialMode, strategy: 'all', product: 'all', group: 'day', account: '' })
  const [report, setReport] = useState<AnalyticsReport | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(''), [kind, setKind] = useState<HistoryKind | ''>(''), [offset, setOffset] = useState(0), [detail, setDetail] = useState<Detail | null>(null), [detailError, setDetailError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(dayNow().slice(0, 7)), [calendarDay, setCalendarDay] = useState('')
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'other'>('all')
  const [calendarResult, setCalendarResult] = useState<{ key: string; report: AnalyticsReport } | null>(null)
  const [calendarFailure, setCalendarFailure] = useState<{ key: string; message: string } | null>(null)
  const [format, setFormat] = useState('summary')
  const [exporting, setExporting] = useState(false)
  const params = new URLSearchParams({ ...filters }).toString()
  useEffect(() => {
    const cancel = new AbortController()
    void fetch(`/api/analytics?${params}`, { cache: 'no-store', signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(15_000)]) }).then(async response => {
      const value = await response.json(); if (!response.ok) throw Error(value.error || 'History could not be loaded.'); if (!cancel.signal.aborted) { setReport(value); setError('') }
    }).catch(error => { if (!cancel.signal.aborted) { setReport(null); setError(error instanceof Error ? error.message : 'History could not be loaded.') } }).finally(() => { if (!cancel.signal.aborted) setLoading(false) })
    return () => cancel.abort()
  }, [params, revision])

  const calendarParams = new URLSearchParams({ ...filters, from: calendarMonth + '-01', to: new Date(Date.UTC(Number(calendarMonth.slice(0, 4)), Number(calendarMonth.slice(5)), 0)).toISOString().slice(0, 10), group: 'day' }).toString()
  useEffect(() => {
    const cancel = new AbortController()
    void fetch(`/api/analytics?${calendarParams}`, { cache: 'no-store', signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(15_000)]) }).then(async response => {
      const value = await response.json()
      if (!response.ok) throw Error(value.error || 'Calendar could not be loaded.')
      if (!cancel.signal.aborted) { setCalendarResult({ key: calendarParams, report: value }); setCalendarFailure(null) }
    }).catch(error => { if (!cancel.signal.aborted) { setCalendarResult(null); setCalendarFailure({ key: calendarParams, message: error instanceof Error ? error.message : 'Calendar could not be loaded.' }) } })
    return () => cancel.abort()
  }, [calendarParams, revision])
  useEffect(() => {
    if (!online) return
    const timer = setInterval(() => { if (!document.hidden) setRevision(value => value + 1) }, 15000)
    return () => clearInterval(timer)
  }, [online])
  useEffect(() => {
    if (!selected) return
    const cancel = new AbortController()
    void fetch(`/api/analytics/session/${encodeURIComponent(selected)}?${new URLSearchParams({ offset: String(offset), limit: '100', ...(kind ? { kind } : {}) })}`, { cache: 'no-store', signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(15_000)]) }).then(async response => {
      const value = await response.json(); if (!response.ok) throw Error(value.error || 'Session history unavailable.'); if (!cancel.signal.aborted) setDetail(value)
    }).catch(error => { if (!cancel.signal.aborted) setDetailError(error instanceof Error ? error.message : 'Session history unavailable.') })
    return () => cancel.abort()
  }, [selected, offset, kind, revision])
  const change = (patch: Partial<AnalyticsFilters>) => { if (patch.to) setCalendarMonth(patch.to.slice(0, 7)); setLoading(true); setError(''); setCalendarDay(''); setReport(null); setSelected(''); setDetail(null); setFilters(value => ({ ...value, ...patch })); setRevision(value => value + 1) }
  const selectPeriod = (next: 'all' | 'today' | 'week' | 'month') => {
    setPeriod(next)
    const today = dayNow()
    change({ from: next === 'all' ? historyStart() : next === 'week' ? periodFor(today, 'week') : next === 'month' ? calendarMonth + '-01' : today, to: next === 'month' ? monthEnd(calendarMonth) : today, group: 'day' })
  }
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
  const monthEnd = (month: string) => {
    const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
    return last < dayNow() ? last : dayNow()
  }
  const calendarError = calendarFailure?.key === calendarParams ? calendarFailure.message : ''
  const calendarReport = calendarResult?.key === calendarParams ? calendarResult.report : null
  const chooseDay = (day: string) => {
    setPeriod(day === dayNow() ? 'today' : day ? 'other' : 'month')
    change(day ? { from: day, to: day } : { from: calendarMonth + '-01', to: monthEnd(calendarMonth) })
    setCalendarDay(day)
  }
  const stats = report?.totals
  return <section className="analytics-panel" aria-labelledby="analytics-title">
    <header className="analytics-heading"><div><span className="history-eyebrow">TRADING JOURNAL</span><h2 id="analytics-title">History</h2><p>Your trading days, results and session reports.</p></div><button className="text-button" disabled={loading || !online} onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1) }}>{loading ? 'Updating…' : 'Refresh'}</button></header>
    <div className="history-calendar-controls"><div role="group" aria-label="History mode">{(['paper', 'live'] as const).map(mode => <button key={mode} type="button" aria-pressed={filters.mode === mode} onClick={() => change({ mode })}>{mode === 'paper' ? 'Paper' : 'Live'}</button>)}</div><label><span className="sr-only">History strategy</span><select aria-label="History strategy" value={filters.strategy} onChange={e => change({ strategy: e.target.value as AnalyticsFilters['strategy'] })}><option value="all">All strategies</option><option value="buy">Buy</option><option value="sell">Sell</option><option value="both">Both · Buy &amp; Sell</option></select></label></div>
    <AnalyticsCalendar month={calendarMonth} sessions={calendarReport?.sessions ?? []} selected={calendarDay} today={dayNow()} loading={!calendarReport && !calendarError} error={calendarError} onDay={chooseDay} onMonth={month => { setPeriod('month'); change({ from: month + '-01', to: monthEnd(month) }); }} />
    <section className="history-analysis" aria-labelledby="history-analysis-title">
      <div className="history-section-title"><div><span className="history-eyebrow">PERFORMANCE</span><h3 id="history-analysis-title">Analysis & reports</h3></div><span>{period === 'all' ? 'All recorded history' : filters.from === filters.to ? filters.to : `${filters.from} – ${filters.to}`} · IST</span></div>
    <div className="analytics-periods" role="group" aria-label="History period">{(['all', 'today', 'week', 'month'] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => selectPeriod(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    {error && <p className="analytics-error" role="alert">{error}</p>}
    {loading && <p className="history-loading" role="status">Updating analysis…</p>}
    {stats && <>
      <DataGrid className="analytics-simple-stats" label="Performance summary" fields={[
        { label: 'Gross P&L', value: money(stats.realizedGross), detail: 'Before charges', tone: pnlTone(stats.realizedGross) },
        { label: 'Closed trades', value: stats.closedCycles, detail: `${stats.fills} fills` },
        { label: 'Win rate', value: stats.winRate == null ? '—' : `${stats.winRate}%`, detail: `${stats.wins}W · ${stats.losses}L` },
      ]} />
      {!!stats.unverifiedSessions && <p className="analytics-warning" role="status">{stats.unverifiedSessions} session(s) await accounting verification. Complete P&L is unavailable.</p>}
      {!!(stats.openLegs || stats.pendingOrders) && <p className="analytics-scope">{stats.openLegs} open legs · {stats.pendingOrders} pending orders</p>}
      <details className="history-report-breakdown">
        <summary>Performance breakdown <span>Trades, risk & activity</span></summary>
        <DataGrid label="Performance breakdown" fields={[
          { label: 'Winning trades', value: stats.wins },
          { label: 'Losing trades', value: stats.losses },
          { label: 'Breakeven trades', value: stats.breakeven },
          { label: 'Profit factor', value: stats.profitFactor == null ? '—' : stats.profitFactor.toFixed(2) },
          { label: 'Maximum drawdown', value: money(stats.maxDrawdown) },
          { label: 'Recorded sessions', value: stats.sessions },
          { label: 'Entries', value: stats.entries },
          { label: 'Executed fills', value: stats.fills },
        ]} />
      </details>
      <div className="analytics-history-heading"><h3>Session history</h3><span>{filters.mode === 'paper' ? 'Simulated fills' : 'Confirmed engine fills'}</span></div>
      <div className="analytics-session-list">{report.sessions.filter(session => !calendarDay || session.date === calendarDay).map(session => <button type="button" className="analytics-session-card" key={session.id} onClick={() => openSession(session.id)} aria-pressed={selected === session.id} aria-label={`Open ${session.date} ${session.strategy} session`}><div><strong>{session.date}</strong><span>{session.strategy === 'both' ? 'Both · Buy & Sell' : session.strategy === 'sell' ? 'Breakout Sell' : 'Breakout Buy'} · {session.product}</span><small>{session.fills} fills · {session.status}</small></div><div className="analytics-session-result"><strong className={session.realizedGross != null && session.realizedGross > 0 ? 'positive-text' : session.realizedGross != null && session.realizedGross < 0 ? 'negative-text' : ''}>{money(session.realizedGross)}</strong><span>View details →</span></div></button>)}</div>
      {!report.sessions.some(session => !calendarDay || session.date === calendarDay) && <p className="analytics-empty">No recorded {filters.mode} sessions {period === 'today' ? 'today' : 'for this selection'}.</p>}
    </>}
    </section>
    <details className="analytics-other" aria-label="Other history options"><summary>Custom dates & exports</summary>
    <div className="analytics-filters">
      <label>From<input type="date" value={filters.from} onChange={e => { setPeriod('other'); change({ from: e.target.value }) }} /></label><label>To<input type="date" value={filters.to} onChange={e => { setPeriod('other'); change({ to: e.target.value }) }} /></label>
      <label>Product<select value={filters.product} onChange={e => change({ product: e.target.value as AnalyticsFilters['product'] })}><option value="all">All products</option><option value="MIS">MIS</option><option value="NRML">NRML</option></select></label>
      {!!report?.accounts.length && <label>Broker account<select value={filters.account} onChange={e => change({ account: e.target.value })}><option value="">All saved accounts</option>{report.accounts.map(account => <option key={account}>{account}</option>)}</select></label>}
    </div>
      <div className="analytics-other-actions"><button className="text-button" onClick={() => { setPeriod('other'); change({ from: dayNow().slice(0, 4) + '-01-01', to: dayNow() }) }}>This year</button></div>
      <div className="analytics-download"><label>Export<select value={format} onChange={e => setFormat(e.target.value)}><option value="summary">Summary</option><option value="trades">Fills</option><option value="orders">Orders</option><option value="events">Events</option></select></label><button className="button secondary" disabled={exporting || loading} onClick={() => void download()}>{exporting ? 'Preparing…' : 'Download CSV'}</button></div>
    </details>
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
