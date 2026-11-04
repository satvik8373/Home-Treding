import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Leg, Mark, Side } from "../../shared/model";
import { freshMark } from "../../shared/market";
import { money, price } from "../lib/format";
import { RULES } from '../../shared/model';

export function LegCard({
  side,
  leg,
  mark,
  now,
}: {
  side: Side;
  leg?: Leg;
  mark?: Mark;
  now: number;
}) {
  const fresh = freshMark(mark, now),
    position = leg?.position;
  const pnl =
    position && fresh
      ? (mark.price - position.average) * position.quantity
      : null;
  return (
    <section
      className="leg-card"
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
          {position ? "Open" : leg ? "Watching" : "Waiting"}
        </span>
      </div>
      <div className="leg-price-row">
        <strong>{fresh ? `₹${price(mark.price)}` : "—"}</strong>
        <span>{position ? `${position.quantity} units` : "No position"}</span>
      </div>
      <dl className="leg-values">
        <div>
          <dt>Reference</dt>
          <dd>{price(leg?.reference.close)}</dd>
        </div>
        <div>
          <dt>Breakout</dt>
          <dd>{price(leg?.upper)}</dd>
        </div>
        <div>
          <dt>Lower exit</dt>
          <dd>{price(leg?.lower)}</dd>
        </div>
        <div>
          <dt>Avg fill</dt>
          <dd>{price(position?.average)}</dd>
        </div>
        <div>
          <dt>Target 1</dt>
          <dd>{position ? price(position.average + 20) : "—"}</dd>
        </div>
        <div>
          <dt>Target 2</dt>
          <dd>{position ? price(position.average + 40) : "—"}</dd>
        </div>
      </dl>
      <div className="leg-footer">
        <span>{leg?.entries ?? 0} entries{leg ? ` · lot ${leg.contract.lotSize} · entry ${RULES.entryLots * leg.contract.lotSize} units` : ''}</span>
        <span>
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
        </span>
      </div>
    </section>
  );
}
