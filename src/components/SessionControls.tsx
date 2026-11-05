import { BookOpen, Play, Square } from "lucide-react";
import type { Mode, TradingSession } from "../../shared/model";
import type { useDashboard } from "../hooks/useDashboard";
import { clock } from '../lib/format';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';

type Props = {
  settings?: StrategySettings;
  onSettings?: () => void;
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
  action: ReturnType<typeof useDashboard>["action"];
  onRules: () => void;
};
export function SessionControls({
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
  onRules,
  settings = DEFAULT_SETTINGS,
  onSettings,
}: Props) {
  const shownMode = locked ? session!.mode : mode;
  const local = new Date(now + 330 * 60_000),
    minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const inWindow =
    ![0, 6].includes(local.getUTCDay()) && minutes >= 540 && minutes < Number(settings.cutoff.slice(0, 2)) * 60 + Number(settings.cutoff.slice(3));
  return (
    <section className="panel session-panel">
      <div className="panel-title">
        <h2>009 Strategy</h2>
        <div className="session-rule-actions">{onSettings && <button className="text-button" onClick={onSettings}>Settings</button>}<button className="text-button" onClick={onRules}>
          <BookOpen size={13} />
          Rules
        </button></div>
      </div>
      <div className="session-body">
        <div className="mode-switch" aria-label="Execution mode">
          <button
            disabled={locked}
            className={shownMode === "paper" ? "active" : ""}
            onClick={() => {
              setMode("paper");
              setLiveAck(false);
            }}
          >
            Paper
          </button>
          <button
            disabled={locked}
            className={shownMode === "live" ? "active live" : ""}
            onClick={() => setMode("live")}
          >
            Live
          </button>
        </div>
        <p className="mode-description">
          {!online ? 'Execution engine offline' : !connected ? 'Connect mStock for market data' : shownMode === "paper"
            ? "Simulated orders · real market data"
            : "Real orders · connected mStock account"}
        </p>
        <dl className="session-rules">
          <div>
            <dt>Signal candle</dt>
            <dd>5 minutes</dd>
          </div>
          <div>
            <dt>Reference close</dt>
            <dd>09:15–09:20</dd>
          </div>
          <div>
            <dt>Breakout / exit</dt>
            <dd>+{settings.breakoutPercent}% / −{settings.exitPercent}%</dd>
          </div>
          <div>
            <dt>Entry size</dt>
            <dd>{settings.entryLots} lots · {settings.enabledSides.join(' + ')}</dd>
          </div>
          <div>
            <dt>Profit targets</dt>
            <dd>+₹{settings.target1Points} / +₹{settings.target2Points}</dd>
          </div>
          <div>
            <dt>Square off</dt>
            <dd>{settings.cutoff} IST</dd>
          </div>
        </dl>
        {shownMode === "live" && !locked && (
          <label className="live-check">
            <input
              type="checkbox"
              checked={liveAck}
              onChange={(e) => setLiveAck(e.target.checked)}
            />
            Place real orders for this session.
          </label>
        )}
        {locked ? (
          <button
            className="button danger full-width"
            disabled={!online || !!working || session?.status === "stopping"}
            onClick={() => void action("/api/strategy/stop", {}, "stop")}
          >
            <Square size={12} fill="currentColor" />
            {working === "stop" || session?.status === "stopping"
              ? "Closing positions…"
              : "Stop & square off"}
          </button>
        ) : (
          <button
            className="button primary full-width"
            disabled={
              !online ||
              !connected ||
              !!working ||
              !inWindow ||
              (shownMode === "live" && !liveAck)
            }
            onClick={() =>
              void action(
                "/api/strategy/start",
                { mode, liveAcknowledged: liveAck },
                "start",
              )
            }
          >
            <Play size={14} fill="currentColor" />
            {working === "start" ? "Starting…" : "Start strategy"}
          </button>
        )}
        <p className="control-hint">
          {!connected
            ? "Connect your broker to start."
            : !inWindow && !locked
              ? `Start window: weekdays 09:00–${settings.cutoff} IST.`
              : "The backend monitors even when this tab is closed."}
        </p>
        {session?.pending && <div className="pending-order" role="status">
          <strong>Awaiting broker confirmation</strong>
          <span>{session.pending.side} · {session.pending.transaction} · {session.pending.quantity} units</span>
          <span>{session.pending.reason.replaceAll('_', ' ')} · submitted {clock(session.pending.submittedAt, true)} IST</span>
          <small>{session.pending.orderId ? `Order ID ${session.pending.orderId}` : `Acknowledgement unknown · tag ${session.pending.tag}`}</small>
        </div>}
      </div>
    </section>
  );
}
