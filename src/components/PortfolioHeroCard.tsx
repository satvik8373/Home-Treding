import { Play, Square, ArrowUpDown, AlertCircle } from 'lucide-react';
import type { Mode, Side, TradingSession } from '../../shared/model';
import type { StrategySettings } from '../../shared/settings';
import { directionOf } from '../../shared/strategy';
import type { useDashboard } from '../hooks/useDashboard';
import { money, date } from '../lib/format';

type Props = {
  session?: TradingSession | null;
  locked: boolean;
  connected: boolean;
  online: boolean;
  working: string;
  now: number;
  mode: Mode;
  setMode: (mode: Mode) => void;
  liveAck: boolean;
  setLiveAck: (value: boolean) => void;
  action: ReturnType<typeof useDashboard>['action'];
  settings: StrategySettings;
  liveAvailable?: boolean;
  liveReason?: string;
  total?: number | null;
  openPnl?: number | null;
  realized?: number | null;
  positions?: Side[];
};

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
  const shownMode = locked ? session!.mode : mode;
  const local = new Date(now + 330 * 60_000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const cutoffMinutes = Number(settings.cutoff.slice(0, 2)) * 60 + Number(settings.cutoff.slice(3));
  const inWindow = ![0, 6].includes(local.getUTCDay()) && minutes >= 540 && minutes < cutoffMinutes;
  const resumeDay = session?.date === local.toISOString().slice(0, 10) && session.mode === shownMode;

  const isPositive = total != null && total > 0;
  const isNegative = total != null && total < 0;

  const statusLabel = !online ? 'Engine offline' : ({ idle: 'Not started', armed: 'Armed', preparing: 'Loading reference', running: 'Running', stopping: 'Closing positions', blocked: 'Needs attention', stopped: 'Stopped' }[session?.status ?? 'idle']);

  return (
    <div className={`portfolio-hero-card ${isPositive ? 'status-positive' : isNegative ? 'status-negative' : ''}`}>
      {/* 1. Upper Tier: P&L Balance & Primary Action Controls */}
      <div className="hero-upper-tier">
        <div className="hero-top-row">
          <div className="hero-eyebrow-wrap">
            <span className="hero-eyebrow">SESSION P&L</span>
            <span className="hero-mode-pill">{shownMode.toUpperCase()}</span>
          </div>
          <div className="hero-badge-wrap">
            <span className={`hero-status-pill ${session?.status === 'running' ? 'active' : ''}`}>
              <span className={`status-indicator ${session?.status === 'running' ? 'running' : online ? 'online' : 'offline'}`} />
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="hero-main-row">
          <div className="hero-balance-wrap">
            <strong className={`hero-balance-text ${isPositive ? 'positive-value' : isNegative ? 'negative-value' : ''}`}>
              {money(total ?? null)}
            </strong>
            <span className="hero-balance-sub-label">
              Gross · before charges · {session ? (session.pnlVerified ? 'Tracked session' : 'Awaiting verification') : 'No session started'}
            </span>
          </div>


        </div>

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

        <div className="hero-actions-row">
          {locked ? (
            <button
              className="hero-action-btn btn-danger"
              disabled={!online || !!working || session?.status === 'stopping'}
              onClick={() => void action('/api/strategy/stop', {}, 'stop')}
            >
              <Square size={14} fill="currentColor" />
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
              <Play size={14} fill="currentColor" />
              <span>{working === 'start' ? 'Starting…' : resumeDay ? 'Resume Session' : 'Start Strategy'}</span>
            </button>
          )}

          <button
            className="hero-action-btn btn-secondary"
            disabled={locked || !!working || (shownMode === 'paper' && !liveAvailable)}
            onClick={() => {
              if (!locked) {
                setMode(shownMode === 'paper' ? 'live' : 'paper');
                setLiveAck(false);
              }
            }}
            title={locked ? 'Stop session before switching mode' : 'Toggle Paper / Live mode'}
          >
            <ArrowUpDown size={14} />
            <span>{shownMode === 'paper' ? 'Switch to Live' : 'Switch to Paper'}</span>
          </button>
        </div>
        <p id="strategy-control-hint" className="hero-control-hint">{!online ? 'Waiting for the engine connection.' : !connected ? 'Connect mStock to start.' : working ? 'Request in progress. Waiting for engine confirmation.' : shownMode === 'live' && !liveAvailable ? liveReason || 'Live execution is unavailable on this engine.' : !inWindow && !locked ? `Start window: weekdays 09:00–${settings.cutoff} IST.` : locked ? 'Monitoring continues when this page is closed.' : shownMode === 'live' ? 'Real broker orders require your confirmation above.' : 'Paper orders are simulated.'}</p>
        {session && <p className="hero-session-message" role="status">{session.message}</p>}
        {session?.pending && <div className="hero-pending" role="status"><strong>Awaiting broker confirmation</strong><span>{session.pending.side} · {session.pending.transaction} · {session.pending.quantity} units</span><small>{session.pending.orderId ? `Order ID ${session.pending.orderId}` : 'Submission outcome not yet confirmed'}</small></div>}
      </div>

      {/* 2. Lower Tier: Merged 4 Metric Boxes (Directly from User Screenshot) */}
      <div className="hero-metrics-strip">
        <div className="hero-metric-cell">
          <span className="metric-cell-label">OPEN P&L</span>
          <strong className={`metric-cell-value ${openPnl != null && openPnl < 0 ? 'negative-text' : openPnl != null && openPnl > 0 ? 'positive-text' : ''}`}>
            {money(openPnl ?? null)}
          </strong>
          <small className="metric-cell-sub">
            {!session ? 'No session started' : openPnl == null ? 'Waiting for prices' : positions.length ? 'Unrealized positions' : 'No open positions'}
          </small>
        </div>

        <div className="hero-metric-cell">
          <span className="metric-cell-label">REALIZED P&L</span>
          <strong className={`metric-cell-value ${realized != null && realized < 0 ? 'negative-text' : realized != null && realized > 0 ? 'positive-text' : ''}`}>
            {money(realized ?? null)}
          </strong>
          <small className="metric-cell-sub">
            {session && !session.pnlVerified ? 'Awaiting verification' : 'Closed quantities · before charges'}
          </small>
        </div>

        <div className="hero-metric-cell">
          <span className="metric-cell-label">OPEN POSITIONS</span>
          <strong className="metric-cell-value status-value">
            {!session ? '—' : positions.length ? positions.map((side) => (side === 'CE' ? 'CALL' : 'PUT')).join(' + ') : 'Flat'}
          </strong>
          <small className="metric-cell-sub">
            {session ? `${session.trades.length} ${session.mode === 'paper' ? 'simulated' : 'confirmed'} fills` : 'CALL & PUT separate'}
          </small>
        </div>

        <div className="hero-metric-cell">
          <span className="metric-cell-label">LOCKED ATM</span>
          <strong className="metric-cell-value">
            {session?.atm?.toLocaleString('en-IN') ?? '—'}
          </strong>
          <small className="metric-cell-sub">
            {session?.expiry ? `Expiry ${date(session.expiry)}` : 'Selected from 09:20 close'}
          </small>
        </div>
      </div>
    </div>
  );
}
