import { directionOf, strategyName } from '../../shared/strategy';
import { targetLabel } from '../../shared/targets';
import { Dialog } from "./Dialog";
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';

const rules = (settings: StrategySettings) => {
  const dir = directionOf(settings)
  return [
    [
      "ATM selection",
      "Nearest strike to NIFTY’s 09:20 opening-candle close; nearest valid expiry and official lot size.",
    ],
    [
      "Reference",
      "Each option’s completed 09:15–09:20 close, locked for the day.",
    ],
    ['Day continuity', 'Stop/Start, engine restarts and settings changes retain the same day-session, reference, trades and entry/reset state. Setting changes apply next trading day. A process restart checkpoints the running session; Stop & square off explicitly closes positions.'],
    [
      "Entry",
      dir === 'both'
        ? `From 09:25: a new completed 5m close beyond reference levels. BUY when closing ≥ upper breakout (+${settings.breakoutPercent}%), or SELL short when closing ≤ lower breakdown (-${settings.breakoutPercent}%). ${settings.entryLots} lots when that enabled leg is flat.`
        : `From 09:25: a new completed 5m close ${dir === 'sell' ? '≤' : '≥'} reference × ${(1 + (dir === 'sell' ? -1 : 1) * settings.breakoutPercent / 100).toFixed(6)}. ${dir === 'sell' ? 'SELL short' : 'BUY'} ${settings.entryLots} lots when that enabled leg is flat.`,
    ],
    [
      "Targets",
      `T1: ${settings.target1Lots ? `${settings.target1Lots} lots at ${targetLabel(settings, 1)}` : 'skipped'}. T2: all remaining units at ${targetLabel(settings, 2)}, after T1 completes. Minutes count from the original entry, not from T1. Time exits run regardless of P&L; clock deadlines already passed become due after entry. Fresh market data and confirmed broker fills are required. Stop/lower exit and square-off retain priority.`,
    ],
    [
      dir === 'both' ? 'Opposite candle exit' : dir === 'sell' ? 'Upper exit' : 'Lower exit',
      dir === 'both'
        ? `A completed 5m close across the channel (below lower for BUY, or above upper for SELL) squares off the remaining quantity.`
        : `A completed 5m close ${dir === 'sell' ? '>' : '<'} reference × ${(1 + (dir === 'sell' ? 1 : -1) * settings.exitPercent / 100).toFixed(6)} ${dir === 'sell' ? 'BUYs back' : 'SELLs'} the remaining quantity.`,
    ],
    ['Reference stop', (settings.stopLossPoints ?? 0) > 0 ? `A fresh option price at or beyond the original opening close ${dir === 'sell' ? '+ ₹' : dir === 'both' ? '± ₹' : '− ₹'}${settings.stopLossPoints} exits all remaining units. This stop stays fixed through targets and re-entries; actual fills may differ. Candle-close exits remain active.` : 'Disabled for this snapshot. The completed-candle exit remains active.'],
    [
      "Re-entry",
      `After a full exit, a completed 5m candle must reset ${dir === 'both' ? 'inside the reference channel (between lower and upper levels)' : dir === 'sell' ? 'above the original lower sell breakout' : 'below the original upper buy breakout'}. A later candle must close beyond that level before another entry. The morning reference never changes. ${settings.maxEntriesPerLeg ? `Maximum ${settings.maxEntriesPerLeg} entries per leg.` : 'No configured entry-count cap.'}`,
    ],
    [
      "Cutoff",
      `${settings.cutoff} IST: block entries and square off held strategy positions. Stop uses the same exit flow.`,
    ],
  ];
};
export function RulesDialog({ onClose, settings = DEFAULT_SETTINGS }: { onClose: () => void; settings?: StrategySettings }) {
  return (
    <Dialog titleId="rules-title" onClose={onClose}>
      <span className="eyebrow">{strategyName(settings).toUpperCase()}</span>
      <h2 id="rules-title">The trading rules</h2>
      <p className="dialog-description">
        Effective {directionOf(settings)} rule snapshot. Breakout {settings.breakoutPercent}% / candle exit {settings.exitPercent}%; {settings.entryLots} lots per entry.
      </p>
      <dl className="rules-detail">
        {rules(settings).map(([title, text]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
