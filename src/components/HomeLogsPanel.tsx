import { useMemo, useState } from 'react'
import type { AppState, BrokerStatus, TradingSession } from '../../shared/model'
import { calendarDate, clock, money, price } from '../lib/format'

export type ClientRuntimeLog = {
  id: string
  at: number
  level: 'error' | 'warn' | 'info'
  source: 'ui' | 'chart' | 'network' | 'broker'
  title: string
  message: string
}

type LogCategory = 'all' | 'errors' | 'engine' | 'orders' | 'trades' | 'candles'

type UnifiedLogEntry = {
  id: string
  at: number
  category: Exclude<LogCategory, 'all' | 'errors'>
  level: 'error' | 'warn' | 'ok' | 'info'
  tag: string
  line: string
  detail?: string
  subEvents?: { at: number; label: string }[]
}

interface HomeLogsPanelProps {
  session?: TradingSession | null
  broker?: BrokerStatus
  runtime?: AppState['runtime']
  online: boolean
  deploymentAvailable: boolean
  deploymentReason?: 'setup' | 'unavailable' | null
  now: number
  working: string
  connected: boolean
  error: string
  onDismissError: () => void
  notice: { message: string; at: number } | null
  onDismissNotice: () => void
  runtimeLogs: ClientRuntimeLog[]
  onClearRuntimeLogs: () => void
  onReconcile: () => void
}

export function HomeLogsPanel({
  session,
  broker,
  runtime,
  online,
  deploymentAvailable,
  deploymentReason,
  now,
  working,
  connected,
  error,
  onDismissError,
  notice,
  onDismissNotice,
  runtimeLogs,
  onClearRuntimeLogs,
  onReconcile,
}: HomeLogsPanelProps) {
  const [filter, setFilter] = useState<LogCategory>('all')
  const [search, setSearch] = useState('')

  const activeIssues = useMemo(() => {
    const list: { id: string; severity: 'error' | 'warn'; label: string; detail: string; dismiss?: () => void; reconcile?: boolean }[] = []
    if (!deploymentAvailable) {
      list.push({
        id: 'deployment',
        severity: 'error',
        label: deploymentReason === 'setup' ? 'Engine not connected' : 'Engine unreachable',
        detail: 'Market data, broker connection, backtests and order execution are unavailable until the execution engine connects.',
      })
    } else if (!online) {
      list.push({
        id: 'offline',
        severity: 'error',
        label: 'Engine offline',
        detail: 'Waiting for the trading engine to reconnect. Live market updates are paused.',
      })
    }
    if (error) {
      list.push({
        id: 'action-error',
        severity: 'error',
        label: 'Action error',
        detail: error,
        dismiss: onDismissError,
      })
    }
    if (session?.status === 'blocked') {
      list.push({
        id: 'session-blocked',
        severity: 'error',
        label: 'Session blocked',
        detail: session.message || 'Strategy paused and requires broker reconciliation.',
        reconcile: true,
      })
    }
    if (session && !session.pnlVerified) {
      list.push({
        id: 'pnl-unverified',
        severity: 'warn',
        label: 'Quantities unverified',
        detail: 'Broker positions or quantity accounting needs verification before automatic entries resume.',
        reconcile: session.status !== 'blocked',
      })
    }
    if (broker?.connection && ['rejected', 'expired', 'retrying'].includes(broker.connection.phase)) {
      list.push({
        id: 'broker-connection',
        severity: broker.connection.phase === 'retrying' ? 'warn' : 'error',
        label: `Broker ${broker.connection.phase}`,
        detail: broker.connection.message + (broker.connection.nextRetryAt ? ` (retry ${clock(broker.connection.nextRetryAt, true)} IST)` : ''),
      })
    }
    if (broker?.feedError) {
      list.push({
        id: 'feed-error',
        severity: 'error',
        label: 'WebSocket error',
        detail: broker.feedError,
      })
    } else if (connected && broker && broker.feed !== 'connected') {
      list.push({
        id: 'feed-status',
        severity: 'warn',
        label: `Stream ${broker.feed}`,
        detail: 'WebSocket feed not live; using official REST quote fallback.',
      })
    }
    if (runtime?.liveExecution === false) {
      list.push({
        id: 'runtime-paper-only',
        severity: 'warn',
        label: 'Live execution disabled',
        detail: runtime.reason,
      })
    }
    return list
  }, [deploymentAvailable, deploymentReason, online, error, onDismissError, session, broker, connected, runtime])

  const entries = useMemo(() => {
    const items: UnifiedLogEntry[] = []

    for (const log of runtimeLogs) {
      items.push({
        id: `rt-${log.id}`,
        at: log.at,
        category: 'engine',
        level: log.level,
        tag: log.source.toUpperCase(),
        line: `${log.title}: ${log.message}`,
      })
    }

    for (const [index, entry] of (session?.activity ?? []).entries()) {
      items.push({
        id: `act-${entry.at}-${index}`,
        at: entry.at,
        category: 'engine',
        level: entry.level === 'error' ? 'error' : 'info',
        tag: entry.level === 'error' ? 'ERR' : 'LOG',
        line: entry.message,
      })
    }

    if (session?.pending && !(session.orderAudit ?? []).some(o => o.id === session.pending?.id)) {
      const p = session.pending
      items.push({
        id: `pending-${p.id}`,
        at: p.submittedAt,
        category: 'orders',
        level: 'warn',
        tag: 'ORDER PENDING',
        line: `${p.side} ${p.transaction} ${p.quantity} ${p.symbol} (${p.reason}) — awaiting broker confirmation`,
        detail: `tag ${p.tag}${p.orderId ? ` · order ${p.orderId}` : ''}`,
      })
    }

    for (const order of session?.orderAudit ?? []) {
      const isErr = ['rejected', 'unknown', 'cancelled'].includes(order.status)
      const isWarn = ['cancel-requested', 'partial-terminal', 'submitting'].includes(order.status)
      items.push({
        id: `ord-${order.id}`,
        at: order.updatedAt || order.submittedAt,
        category: 'orders',
        level: isErr ? 'error' : isWarn ? 'warn' : 'ok',
        tag: `ORDER ${order.status.toUpperCase()}`,
        line: `${order.side} ${order.transaction} ${order.quantity} ${order.symbol} (${order.reason})${order.detail ? ` — ${order.detail}` : ''}`,
        detail: `filled ${order.filled ?? '—'}${order.average != null ? ` @ ₹${price(order.average)}` : ''} · id ${order.orderId ?? 'none'} · tag ${order.tag}`,
        subEvents: order.events?.map(ev => ({
          at: ev.at,
          label: `${ev.status}: ${ev.detail}`,
        })),
      })
    }

    for (const trade of session?.trades ?? []) {
      items.push({
        id: `trd-${trade.id}`,
        at: trade.at,
        category: 'trades',
        level: trade.pnl != null && trade.pnl < 0 ? 'warn' : 'ok',
        tag: `${trade.mode.toUpperCase()} TRADE`,
        line: `${trade.side} ${trade.transaction} ${trade.quantity} ${trade.symbol} @ ₹${price(trade.price)} (${trade.reason})`,
        detail: `premium ${money(trade.quantity * trade.price)} · pnl ${trade.pnl != null ? money(trade.pnl) : 'open'} · order ${trade.orderId}`,
      })
    }

    for (const [index, dec] of (session?.decisionAudit ?? []).entries()) {
      items.push({
        id: `dec-${dec.evaluatedAt}-${dec.side}-${index}`,
        at: dec.evaluatedAt,
        category: 'candles',
        level: dec.signal ? 'ok' : 'info',
        tag: `${dec.side} CANDLE`,
        line: `${dec.signal ?? 'HOLD'} — ${dec.explanation}`,
        detail: `${clock(dec.candle.start, true)}–${clock(dec.candle.end, true)} IST · O ${price(dec.candle.open)} H ${price(dec.candle.high)} L ${price(dec.candle.low)} C ${price(dec.candle.close)}`,
      })
    }

    return items.sort((a, b) => b.at - a.at)
  }, [runtimeLogs, session])

  const counts = useMemo(() => ({
    all: entries.length,
    errors: entries.filter(e => e.level === 'error').length + activeIssues.filter(i => i.severity === 'error').length,
    engine: entries.filter(e => e.category === 'engine').length,
    orders: entries.filter(e => e.category === 'orders').length,
    trades: entries.filter(e => e.category === 'trades').length,
    candles: entries.filter(e => e.category === 'candles').length,
  }), [entries, activeIssues])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(entry => {
      if (filter === 'errors' && entry.level !== 'error') return false
      if (filter !== 'all' && filter !== 'errors' && entry.category !== filter) return false
      if (!q) return true
      return (
        entry.line.toLowerCase().includes(q)
        || entry.tag.toLowerCase().includes(q)
        || (entry.detail?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [entries, filter, search])

  return (
    <section id="home-system-logs" className="home-logs-plain" aria-labelledby="home-logs-title">
      <div className="home-logs-top">
        <div className="home-logs-heading">
          <h2 id="home-logs-title">System Logs &amp; Errors</h2>
          <span className={counts.errors > 0 ? 'home-logs-status err' : 'home-logs-status'}>
            {counts.errors} {counts.errors === 1 ? 'error' : 'errors'} · {counts.all} logs
          </span>
        </div>
        <div className="home-logs-links">
          {online && deploymentAvailable && (
            <a className="home-logs-link" href="/api/audit/export">
              Export JSON
            </a>
          )}
          {runtimeLogs.length > 0 && (
            <button type="button" className="home-logs-link" onClick={onClearRuntimeLogs}>
              Clear UI logs
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="home-logs-plain-line info" role="status">
          <span>
            {clock(notice.at, true)} · {notice.message}
          </span>
          <button type="button" className="home-logs-inline-btn" onClick={onDismissNotice}>
            Dismiss
          </button>
        </div>
      )}

      {activeIssues.length > 0 && (
        <div className="home-logs-issues-plain" role="region" aria-label="Active errors and alerts">
          {activeIssues.map(issue => (
            <div key={issue.id} className={`home-logs-plain-line ${issue.severity}`} role="alert">
              <span>
                <strong>{issue.label}:</strong> {issue.detail}
              </span>
              <span className="home-logs-inline-actions">
                {issue.reconcile && (
                  <button
                    type="button"
                    className="home-logs-inline-btn"
                    disabled={!online || !connected || !!working}
                    onClick={onReconcile}
                  >
                    Reconcile
                  </button>
                )}
                {issue.dismiss && (
                  <button type="button" className="home-logs-inline-btn" onClick={issue.dismiss}>
                    Dismiss
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="home-logs-bar">
        <div className="home-logs-filter-row" role="tablist" aria-label="Filter system logs">
          {([
            ['all', 'All', counts.all],
            ['errors', 'Errors', counts.errors],
            ['engine', 'Engine', counts.engine],
            ['orders', 'Orders', counts.orders],
            ['trades', 'Trades', counts.trades],
            ['candles', 'Candles', counts.candles],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`home-logs-filter ${filter === key ? 'active' : ''} ${key === 'errors' && count > 0 ? 'err' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <input
          type="search"
          className="home-logs-search-plain"
          aria-label="Filter system logs"
          value={search}
          placeholder="Filter logs…"
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length > 0 ? (
        <div className="home-logs-list-plain" role="log" aria-live="polite">
          {filtered.map(item => (
            <div key={item.id} className={`home-log-row-plain level-${item.level}`}>
              <time title={calendarDate(item.at)}>{clock(item.at, true)}</time>
              <span className={`home-log-lvl level-${item.level}`}>[{item.tag}]</span>
              <div className="home-log-txt">
                <span>{item.line}</span>
                {item.detail && <small>{item.detail}</small>}
                {item.subEvents && item.subEvents.length > 0 && (
                  <details className="home-log-subevents">
                    <summary>events ({item.subEvents.length})</summary>
                    <ul>
                      {item.subEvents.map((ev, i) => (
                        <li key={i}>
                          <time>{clock(ev.at, true)}</time>
                          <span>{ev.label}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="home-logs-empty-plain">
          {search.trim() || filter !== 'all'
            ? 'No matching logs or errors.'
            : `No events logged yet (${clock(now, true)} IST). All errors, engine logs, orders, trades, and candle evaluations appear here.`}
        </p>
      )}
    </section>
  )
}
