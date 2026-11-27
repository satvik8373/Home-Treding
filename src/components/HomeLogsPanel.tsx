import { useMemo } from 'react'
import type { AppState, BrokerStatus, TradingSession } from '../../shared/model'
import { calendarDate, clock, price } from '../lib/format'

export type ClientRuntimeLog = {
  id: string
  at: number
  level: 'error' | 'warn' | 'info'
  source: 'ui' | 'chart' | 'network' | 'broker'
  title: string
  message: string
}

type LogItem = {
  id: string
  at: number
  level: 'error' | 'warn' | 'ok' | 'info'
  text: string
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
  working,
  connected,
  error,
  onDismissError,
  notice,
  onDismissNotice,
  runtimeLogs,
  onReconcile,
}: HomeLogsPanelProps) {
  const activeIssues = useMemo(() => {
    const list: { id: string; severity: 'error' | 'warn'; text: string; dismiss?: () => void; reconcile?: boolean }[] = []
    if (!deploymentAvailable) {
      list.push({
        id: 'deployment',
        severity: 'error',
        text: deploymentReason === 'setup' ? 'Execution engine not connected.' : 'Execution engine unreachable.',
      })
    } else if (!online) {
      list.push({
        id: 'offline',
        severity: 'error',
        text: 'Waiting for trading engine to reconnect.',
      })
    }
    if (error) {
      list.push({
        id: 'action-error',
        severity: 'error',
        text: error,
        dismiss: onDismissError,
      })
    }
    if (session?.status === 'blocked') {
      list.push({
        id: 'session-blocked',
        severity: 'error',
        text: session.message || 'Strategy paused and requires broker reconciliation.',
        reconcile: true,
      })
    } else if (session && !session.pnlVerified) {
      list.push({
        id: 'pnl-unverified',
        severity: 'warn',
        text: 'Positions need broker verification.',
        reconcile: true,
      })
    }
    if (broker?.connection && ['rejected', 'expired', 'retrying'].includes(broker.connection.phase)) {
      list.push({
        id: 'broker-connection',
        severity: broker.connection.phase === 'retrying' ? 'warn' : 'error',
        text: broker.connection.message,
      })
    }
    if (broker?.feedError) {
      list.push({
        id: 'feed-error',
        severity: 'error',
        text: broker.feedError,
      })
    }
    if (runtime?.liveExecution === false && runtime.reason) {
      list.push({
        id: 'runtime-paper-only',
        severity: 'warn',
        text: runtime.reason,
      })
    }
    return list
  }, [deploymentAvailable, deploymentReason, online, error, onDismissError, session, broker, runtime])

  const items = useMemo(() => {
    const rows: LogItem[] = []
    const activeTexts = new Set(activeIssues.map(i => i.text))

    for (const log of runtimeLogs) {
      if (error && log.message === error) continue
      if (activeTexts.has(log.message)) continue
      rows.push({
        id: `rt-${log.id}`,
        at: log.at,
        level: log.level,
        text: log.message,
      })
    }

    for (const [index, entry] of (session?.activity ?? []).entries()) {
      rows.push({
        id: `act-${entry.at}-${index}`,
        at: entry.at,
        level: entry.level === 'error' ? 'error' : 'info',
        text: entry.message,
      })
    }

    if (session?.pending && !(session.orderAudit ?? []).some(o => o.id === session.pending?.id)) {
      const p = session.pending
      rows.push({
        id: `pending-${p.id}`,
        at: p.submittedAt,
        level: 'warn',
        text: `${p.side} ${p.transaction} ${p.quantity} ${p.symbol} pending`,
      })
    }

    for (const order of session?.orderAudit ?? []) {
      const isErr = ['rejected', 'unknown', 'cancelled'].includes(order.status)
      const isWarn = ['cancel-requested', 'partial-terminal', 'submitting'].includes(order.status)
      const note = order.detail ? ` — ${order.detail}` : ''
      rows.push({
        id: `ord-${order.id}`,
        at: order.updatedAt || order.submittedAt,
        level: isErr ? 'error' : isWarn ? 'warn' : 'ok',
        text: `${order.side} ${order.transaction} ${order.quantity} ${order.symbol} ${order.status}${note}`,
      })
    }

    for (const trade of session?.trades ?? []) {
      rows.push({
        id: `trd-${trade.id}`,
        at: trade.at,
        level: trade.pnl != null && trade.pnl < 0 ? 'warn' : 'ok',
        text: `${trade.side} ${trade.transaction} ${trade.quantity} ${trade.symbol} @ ₹${price(trade.price)} (${trade.reason.replaceAll('_', ' ')})`,
      })
    }

    for (const [index, dec] of (session?.decisionAudit ?? []).entries()) {
      if (!dec.signal) continue
      rows.push({
        id: `dec-${dec.evaluatedAt}-${dec.side}-${index}`,
        at: dec.evaluatedAt,
        level: 'ok',
        text: `${dec.side} ${dec.signal.replaceAll('_', ' ')} — ${dec.explanation}`,
      })
    }

    return rows.sort((a, b) => b.at - a.at).slice(0, 60)
  }, [runtimeLogs, session, activeIssues, error])

  const errorCount = items.filter(i => i.level === 'error').length + activeIssues.filter(i => i.severity === 'error').length

  return (
    <section id="home-system-logs" className="panel activity-panel home-activity-logs" aria-labelledby="home-logs-title">
      <div className="home-activity-head">
        <h2 id="home-logs-title">System Logs &amp; Errors</h2>
        <span className={errorCount > 0 ? 'home-activity-count err' : 'home-activity-count'}>
          {items.length} {items.length === 1 ? 'event' : 'events'}
          {errorCount > 0 ? ` · ${errorCount} ${errorCount === 1 ? 'error' : 'errors'}` : ''}
        </span>
      </div>

      {notice && (
        <div className="home-activity-alert info" role="status">
          <time>{clock(notice.at, true)}</time>
          <p>{notice.message}</p>
          <button type="button" className="text-button" onClick={onDismissNotice}>
            Dismiss
          </button>
        </div>
      )}

      {activeIssues.length > 0 && (
        <div className="home-activity-alerts" role="region" aria-label="Active errors">
          {activeIssues.map(issue => (
            <div key={issue.id} className={`home-activity-alert ${issue.severity}`} role="alert">
              <p className={issue.severity === 'error' ? 'negative-text' : 'warn-text'}>{issue.text}</p>
              {(issue.reconcile || issue.dismiss) && (
                <span className="home-activity-alert-actions">
                  {issue.reconcile && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={!online || !connected || !!working}
                      onClick={onReconcile}
                    >
                      Reconcile
                    </button>
                  )}
                  {issue.dismiss && (
                    <button type="button" className="text-button" onClick={issue.dismiss}>
                      Dismiss
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <ol className="activity-list home-activity-list" role="log" aria-live="polite">
          {items.map(item => (
            <li key={item.id} className="home-activity-item">
              <time title={calendarDate(item.at)}>{clock(item.at, true)}</time>
              <p
                className={
                  item.level === 'error'
                    ? 'negative-text'
                    : item.level === 'ok'
                      ? 'positive-text'
                      : item.level === 'warn'
                        ? 'warn-text'
                        : ''
                }
              >
                {item.text}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="trade-empty">Activity appears after the strategy starts.</p>
      )}
    </section>
  )
}
