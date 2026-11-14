import { directionOf, signFor, referenceStop, entryLevel } from '../../shared/strategy';
import { targetPrice, targetDeadline, targetLabel } from '../../shared/targets';
import { clock } from '../lib/format';
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Leg, Mark, Side } from "../../shared/model";
import { freshMark } from "../../shared/market";
import { money, price } from "../lib/format";
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';

export function LegCard({
  side,
  leg,
  mark,
  now,
  settings = DEFAULT_SETTINGS,
}: {
  side: Side;
  leg?: Leg;
  mark?: Mark;
  now: number;
  settings?: StrategySettings;
}) {
  const fresh = freshMark(mark, now),
    position = leg?.position;
  const targetDisplay = (target: 1 | 2) => {
    if (!position || target === 1 && !settings.target1Lots) return '—'
    const level = targetPrice(settings, target, position.average)
    const day = new Date(now + 330 * 60_000).toISOString().slice(0, 10)
    const deadline = targetDeadline(settings, target, position.entryAt, day)
    return level != null ? price(level) : deadline != null ? `${clock(deadline, true)} IST` : targetLabel(settings, target)
  }
  const pnl =
    position && fresh
      ? signFor(settings) * (mark.price - position.average) * position.quantity
      : null;
  return (
    <section
      className="tile tile--wide leg-card"
      aria-label={`${side === "CE" ? "Call" : "Put"} position`}
    >
      <div className="leg-heading">
        <span className={`leg-icon ${side === "CE" ? "call" : "put"}`}>
          {side === "CE" ? (
            <ArrowUpRight size={18} />
          ) : (
            <ArrowDownLeft size={18} />
          )}
        </span>
        <div>
          <h3>
            {side === "CE" ? "CALL" : "PUT"}{" "}
            <small>
              {leg?.contract.strike.toLocaleString("en-IN") ?? "ATM"}
            </small>
          </h3>
          <p>{leg?.contract.symbol ?? "Waiting for reference candle"}</p>
        </div>
        <span className={`tag ${position ? "positive" : ""}`}>
          {position ? directionOf(settings) === 'sell' ? 'Short' : 'Long' : leg ? "Watching" : "Waiting"}
        </span>
      </div>
      <div className="leg-price-row">
        <strong>{fresh ? `₹${price(mark.price)}` : "—"}</strong>
        <span>{position ? `${position.quantity} units` : "No position"}</span>
      </div>
      <div className="leg-open-pnl"><span>
          Open P&L{" "}
          <b
            className={
              pnl != null && pnl < 0
                ? "negative-text"
                : pnl != null && pnl > 0
                  ? "positive-text"
                  : ""
            }
          >
            {money(pnl)}
          </b>
        </span></div>
      <dl className="leg-values">
        <div>
          <dt>Reference</dt>
          <dd>{price(leg?.reference.close)}</dd>
        </div>
        <div>
          <dt>Breakout</dt>
          <dd>{price(leg ? entryLevel(leg, settings) : null)}</dd>
        </div>
        <div>
          <dt>{directionOf(settings) === 'sell' ? 'Upper exit' : 'Lower exit'}</dt>
          <dd>{price(leg ? directionOf(settings) === 'sell' ? leg.upper : leg.lower : null)}</dd>
        </div>
        <div>
          <dt>Avg fill</dt>
          <dd>{price(position?.average)}</dd>
        </div>
        <div><dt>Reference stop</dt><dd>{position && (settings.stopLossPoints ?? 0) > 0 && referenceStop(leg!.reference.close, settings) > 0 ? price(referenceStop(leg!.reference.close, settings)) : '—'}</dd></div>
        <div>
          <dt>Target 1</dt>
          <dd>{targetDisplay(1)}</dd>
        </div>
        <div>
          <dt>Target 2</dt>
          <dd>{targetDisplay(2)}</dd>
        </div>
      </dl>
      <div className="leg-footer">
        <span>{leg?.entries ?? 0} entries{leg ? ` · lot ${leg.contract.lotSize} · entry ${settings.entryLots * leg.contract.lotSize} units` : ''}</span>
      </div>
    </section>
  );
}
