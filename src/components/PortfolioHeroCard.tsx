import { Play, Square, ArrowUpDown, AlertCircle, Info } from 'lucide-react'
import type { Mode, Side, TradingSession } from '../../shared/model'
import type { StrategySettings } from '../../shared/settings'
import { directionOf } from '../../shared/strategy'
import type { useDashboard } from '../hooks/useDashboard'
import { money } from '../lib/format'

type Props = {
  session?: TradingSession | null
  locked: boolean
  connected: boolean
  online: boolean
  working: string
  now: number
  mode: Mode
  setMode: (mode: Mode) => void
  liveAck: boolean
  setLiveAck: (value: boolean) => void
  action: ReturnType<typeof useDashboard>['action']
  settings: StrategySettings
  liveAvailable?: boolean
  liveReason?: string
  total?: number | null
  openPnl?: number | null
  realized?: number | null
  positions?: Side[]
}

export function PortfolioHeroCard({
  session,
  locked,
  connected,
  online,
  working,
  now,
  mode,
  setMode,
  liveAck,
  setLiveAck,
  action,
  settings,
  liveAvailable = true,
  liveReason,
  total,
  openPnl,
  realized,
  positions = [],
}: Props) {
  const shownMode = locked ? session!.mode : mode
  const local = new Date(now + 330 * 60_000)
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes()
  const cutoffMinutes = Number(settings.cutoff.slice(0, 2)) * 60 + Number(settings.cutoff.slice(3))
  const inWindow = ![0, 6].includes(local.getUTCDay()) && minutes >= 540 && minutes < cutoffMinutes
  const resumeDay = session?.date === local.toISOString().slice(0, 10) && session.mode === shownMode

  const isPositive = total != null && total > 0
  const isNegative = total != null && total < 0

  const statusLabel = !online
    ? 'Engine offline'
    : ({
        idle: 'Not started',
        armed: 'Armed',
        preparing: 'Loading reference',
        running: 'Running',
        stopping: 'Closing positions',
        blocked: 'Needs attention',
        stopped: 'Stopped',
      }[session?.status ?? 'idle'])

  // Balance formatting
  const rawBalance = total != null ? money(total) : '₹0.00'
  const decimalMatch = rawBalance.match(/(.*)(\.\d{2}.*)$/)
  const integerPart = decimalMatch ? decimalMatch[1] : rawBalance
  const decimalPart = decimalMatch ? decimalMatch[2] : (total == null ? '.00' : '')

  return (
    <div className={`portfolio-hero-card neo-portfolio-card ${isPositive ? 'status-positive' : isNegative ? 'status-negative' : ''}`}>
      {/* Hidden/Subtle Eyebrow elements for accessibility & unit tests */}
      <div className="hero-top-row neo-meta-top-row">
        <div className="hero-eyebrow-wrap">
          <span className="hero-eyebrow">SESSION P&L</span>
          <span className={`hero-mode-pill ${shownMode === 'live' ? 'live-pill' : 'paper-pill'}`}>
            {shownMode.toUpperCase()}
          </span>
        </div>
        <div className="hero-badge-wrap">
          <span className={`hero-status-pill ${session?.status === 'running' ? 'active' : ''}`}>
            <span
              className={`status-indicator ${
                session?.status === 'running' ? 'running' : online ? 'online' : 'offline'
              }`}
            />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Primary Hero Balance Display */}
      <div className="hero-main-row neo-balance-section">
        <div className="hero-balance-wrap neo-balance-wrap">
          <div className="neo-balance-display">
            <strong
              className={`hero-balance-text neo-balance-text ${
                isPositive ? 'positive-value' : isNegative ? 'negative-value' : ''
              }`}
            >
              <span className="neo-balance-integer">{integerPart}</span>
              {decimalPart && <span className="neo-balance-decimal">{decimalPart}</span>}
            </strong>
          </div>

          <span className="hero-balance-sub-label">
            Gross · before charges · {session ? (session.pnlVerified ? 'Tracked session' : 'Awaiting verification') : 'No session started'}
          </span>
        </div>
      </div>

      {/* Execution Action Controls (Sleek floating capsules) */}
      <div className="hero-execution neo-hero-execution">
        {shownMode === 'live' && !locked && (
          <div className="hero-live-warning">
            <label className="live-confirm-label">
              <input
                type="checkbox"
                checked={liveAck}
                onChange={(e) => setLiveAck(e.target.checked)}
              />
              <span>Confirm real order execution for this session</span>
            </label>
          </div>
        )}

        {!liveAvailable && shownMode === 'live' && (
          <div className="hero-limit-notice">
            <AlertCircle size={13} />
            <span>{liveReason || 'Live execution is unavailable on this engine.'}</span>
          </div>
        )}

        <div className="hero-actions-row neo-actions-row">
          {locked ? (
            <button
              className="hero-action-btn btn-danger"
              disabled={!online || !!working || session?.status === 'stopping'}
              onClick={() => void action('/api/strategy/stop', {}, 'stop')}
            >
              <Square size={13} fill="currentColor" />
              <span>{working === 'stop' || session?.status === 'stopping' ? 'Closing…' : 'Square Off & Stop'}</span>
            </button>
          ) : (
            <button
              className="hero-action-btn btn-primary"
              disabled={!online || !connected || !!working || !inWindow || (shownMode === 'live' && (!liveAck || !liveAvailable))}
              aria-describedby="strategy-control-hint"
              onClick={() =>
                void action(
                  '/api/strategy/start',
                  { mode, strategy: directionOf(settings), liveAcknowledged: liveAck },
                  'start',
                )
              }
            >
              <Play size={13} fill="currentColor" />
              <span>{working === 'start' ? 'Starting…' : resumeDay ? 'Resume Session' : 'Start Strategy'}</span>
            </button>
          )}

          <button
            className="hero-action-btn btn-secondary"
            disabled={locked || !!working || (shownMode === 'paper' && !liveAvailable)}
            onClick={() => {
              if (!locked) {
                setMode(shownMode === 'paper' ? 'live' : 'paper')
                setLiveAck(false)
              }
            }}
            title={locked ? 'Stop session before switching mode' : 'Toggle Paper / Live mode'}
          >
            <ArrowUpDown size={13} />
            <span>{shownMode === 'paper' ? 'Switch to Live' : 'Switch to Paper'}</span>
          </button>
        </div>

        {/* Streamlined Strategy Status Hint Strip */}
        <div className="hero-single-hint-strip" aria-label="Strategy status hint">
          <Info size={13} className="hero-hint-icon" />
          <span id="strategy-control-hint" className="hero-control-hint">
            {!online
              ? 'Waiting for the engine connection.'
              : !connected
              ? 'Connect mStock to start.'
              : working
              ? 'Request in progress. Waiting for engine confirmation.'
              : shownMode === 'live' && !liveAvailable
              ? liveReason || 'Live execution is unavailable on this engine.'
              : !inWindow && !locked
              ? `Start window: weekdays 09:00–${settings.cutoff} IST.`
              : locked
              ? 'Monitoring continues when this page is closed.'
              : shownMode === 'live'
              ? 'Real broker orders require your confirmation above.'
              : 'Paper orders are simulated.'}
          </span>
          {session?.message && (
            <span className="hero-session-message-inline" role="status">
              · {session.message}
            </span>
          )}
        </div>
      </div>

      {session?.pending && (
        <div className="hero-pending" role="status">
          <strong>Awaiting broker confirmation</strong>
          <span>{session.pending.side} · {session.pending.transaction} · {session.pending.quantity} units</span>
          <small>{session.pending.orderId ? `Order ID ${session.pending.orderId}` : 'Submission outcome not yet confirmed'}</small>
        </div>
      )}

      {/* Subtle minimalist stats row (zero boxy containers) */}
      <div className="hero-metrics-strip neo-metrics-strip" aria-label="Session metrics">
        <div className="hero-metric-cell neo-metric-cell">
          <span className="metric-cell-label">OPEN P&L</span>
          <strong
            className={`metric-cell-value ${
              openPnl != null && openPnl < 0 ? 'negative-text' : openPnl != null && openPnl > 0 ? 'positive-text' : ''
            }`}
          >
            {money(openPnl ?? null)}
          </strong>
          <small className="metric-cell-sub">
            {!session ? 'No session' : openPnl == null ? 'Waiting' : positions.length ? 'Unrealized' : 'Flat'}
          </small>
        </div>

        <div className="hero-metric-cell neo-metric-cell">
          <span className="metric-cell-label">REALIZED P&L</span>
          <strong
            className={`metric-cell-value ${
              realized != null && realized < 0 ? 'negative-text' : realized != null && realized > 0 ? 'positive-text' : ''
            }`}
          >
            {money(realized ?? null)}
          </strong>
          <small className="metric-cell-sub">
            {session && !session.pnlVerified ? 'Unverified' : 'Before charges'}
          </small>
        </div>

        <div className="hero-metric-cell neo-metric-cell">
          <span className="metric-cell-label">OPEN POSITIONS</span>
          <strong className="metric-cell-value status-value">
            {!session ? '—' : positions.length ? positions.map((side) => (side === 'CE' ? 'CALL' : 'PUT')).join('+') : 'Flat'}
          </strong>
          <small className="metric-cell-sub">
            {session ? `${session.trades.length} fills` : 'CALL & PUT'}
          </small>
        </div>

        <div className="hero-metric-cell neo-metric-cell">
          <span className="metric-cell-label">STATUS & MODE</span>
          <strong className="metric-cell-value status-value">
            {shownMode.toUpperCase()}
          </strong>
          <small className="metric-cell-sub">
            {session?.status === 'running' ? 'Active' : 'Ready'}
          </small>
        </div>
      </div>
    </div>
  )
}
