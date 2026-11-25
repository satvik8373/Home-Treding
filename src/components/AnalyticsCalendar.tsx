import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import type { SessionSummary } from '../../shared/analytics'
import { money } from '../lib/format'

export function AnalyticsCalendar({ month, sessions, selected, today, onMonth, onDay, loading = false, error = '' }: {
  loading?: boolean; error?: string; month: string; sessions: SessionSummary[]; selected: string; today: string;
  onMonth: (month: string) => void; onDay: (day: string) => void;
}) {
  const first = new Date(`${month}-01T00:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const move = (delta: number) => onMonth(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)).toISOString().slice(0, 7))
  const rows = new Map<string, SessionSummary[]>()
  for (const session of sessions) rows.set(session.date, [...(rows.get(session.date) ?? []), session])
  const daily = (day: string) => {
    const values = rows.get(day) ?? []
    return { values, pnl: values.length && values.every(value => value.realizedGross != null) ? values.reduce((sum, value) => sum + value.realizedGross!, 0) : null, fills: values.reduce((sum, value) => sum + value.fills, 0) }
  }
  const picked = selected ? daily(selected) : null
  const compact = (value: number) => `${value < 0 ? '−' : ''}${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(value))}`
  return <section className="pnl-calendar" aria-label="Trading performance calendar" aria-busy={loading}>
    <header className="pnl-calendar-heading"><div><span className="calendar-eyebrow"><CalendarDays size={14} />PERFORMANCE CALENDAR</span><h3>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3></div><div className="calendar-navigation"><button type="button" aria-label="Previous calendar month" onClick={() => move(-1)}><ChevronLeft size={18} /></button><button type="button" aria-label="Next calendar month" disabled={month >= today.slice(0, 7)} onClick={() => move(1)}><ChevronRight size={18} /></button></div></header>
    <div className="pnl-calendar-weekdays" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="pnl-calendar-grid">{Array.from({ length: offset }, (_, i) => <div key={`blank-${i}`} />)}{Array.from({ length: count }, (_, i) => {
      const day = `${month}-${String(i + 1).padStart(2, '0')}`, row = daily(day)
      const state = loading || error ? 'unavailable' : row.pnl == null ? row.values.length ? 'unverified' : 'empty' : row.pnl > 0 ? 'profit' : row.pnl < 0 ? 'loss' : 'flat'
      return <button key={day} type="button" className={`pnl-calendar-day ${state}${day === today ? ' is-today' : ''}`} aria-pressed={selected === day} disabled={day > today || loading || !!error} aria-label={`${day}: ${loading ? 'Loading' : error ? 'Data unavailable' : row.values.length ? row.pnl == null ? 'P&L unverified' : money(row.pnl) : 'No recorded session'}, ${row.fills} fills`} onClick={() => onDay(selected === day ? '' : day)}>
        <span className="calendar-day-number">{i + 1}</span><strong>{loading ? '…' : error ? '—' : row.pnl != null ? compact(row.pnl) : row.values.length ? '…' : '—'}</strong><small>{loading || error ? '' : row.fills ? `${row.fills} fills` : row.values.length ? 'No fills' : ''}</small>
      </button>
    })}</div>
    <footer className="pnl-calendar-footer">{error ? <span role="alert">{error}</span> : loading ? <span role="status">Loading recorded trading days…</span> : picked ? <><span>{selected}</span><strong>{picked.values.length ? picked.pnl == null ? 'P&L awaiting verification' : money(picked.pnl) : 'No recorded session'}</strong><span>{picked.fills} fills · <button type="button" onClick={() => onDay('')}>Show all days</button></span></> : <span>Daily amounts in ₹ · Select a day for full P&L and saved sessions. Gross, before charges.</span>}</footer>
  </section>
}
