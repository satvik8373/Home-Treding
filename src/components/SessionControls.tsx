import { directionOf, strategyName } from '../../shared/strategy';
import { targetLabel } from '../../shared/targets';
import { BookOpen, Play, Square } from "lucide-react";
import type { Mode, TradingSession } from "../../shared/model";
import type { useDashboard } from "../hooks/useDashboard";
import { clock } from '../lib/format';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';

type Props = {
  liveAvailable?: boolean;
  liveReason?: string;
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
  liveAvailable = true,
  liveReason,
}: Props) {
  const shownMode = locked ? session!.mode : mode;
  const local = new Date(now + 330 * 60_000),
    minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const inWindow =
    ![0, 6].includes(local.getUTCDay()) && minutes >= 540 && minutes < Number(settings.cutoff.slice(0, 2)) * 60 + Number(settings.cutoff.slice(3));
  const resumeDay = session?.date === local.toISOString().slice(0, 10) && session.mode === shownMode;
  return (
    <section className="panel session-panel">
      <div className="panel-title">
        <h2>{strategyName(settings)}</h2>
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
            disabled={locked || !liveAvailable}
            className={shownMode === "live" ? "active live" : ""}
            title={!liveAvailable ? 'Live unavailable on this hosted engine' : undefined}
            aria-describedby={!liveAvailable ? 'live-unavailable-reason' : undefined}
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
        {!liveAvailable && <details className="execution-limit"><summary id="live-unavailable-reason">Why Live is unavailable</summary><p>{liveReason}</p><p>A match with your saved IP reference does not verify that the broker approved the IP or that the address is static.</p></details>}
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
            <dd>{directionOf(settings) === 'sell' ? '−' : '+'}{settings.breakoutPercent}% / {directionOf(settings) === 'sell' ? '+' : '−'}{settings.exitPercent}%</dd>
          </div>
          <div>
            <dt>Entry size</dt>
            <dd>{settings.entryLots} lots · {settings.enabledSides.join(' + ')}</dd>
          </div>
          <div>
            <dt>Target exits</dt>
            <dd>{settings.target1Lots ? targetLabel(settings, 1) : 'T1 skipped'} / {targetLabel(settings, 2)}</dd>
          </div>
          <div>
            <dt>Square off</dt>
            <dd>{settings.cutoff} IST</dd>
          </div>
          <div><dt>Reference stop</dt><dd>{(settings.stopLossPoints ?? 0) > 0 ? `Reference ${directionOf(settings) === 'sell' ? '+' : '−'}${settings.stopLossPoints} pts` : 'Disabled'}</dd></div>
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
                { mode, strategy: directionOf(settings), liveAcknowledged: liveAck },
                "start",
              )
            }
          >
            <Play size={14} fill="currentColor" />
            {working === "start" ? "Starting…" : resumeDay ? "Resume day session" : "Start strategy"}
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
