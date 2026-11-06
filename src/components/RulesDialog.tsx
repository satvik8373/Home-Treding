import { Dialog } from "./Dialog";
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';

const rules = (settings: StrategySettings) => [
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
    `From 09:25: a new completed 5m close ≥ reference × ${(1 + settings.breakoutPercent / 100).toFixed(6)}. Buy ${settings.entryLots} lots when that enabled leg is flat.`,
  ],
  [
    "Targets",
    `Fresh option prices trigger ${settings.target1Lots} lots at actual fill + ₹${settings.target1Points} (${settings.target1Lots ? 'first target enabled' : 'first target skipped'}), then all remaining units at fill + ₹${settings.target2Points}.`,
  ],
  [
    "Lower exit",
    `A completed 5m close < reference × ${(1 - settings.exitPercent / 100).toFixed(6)} exits the remaining quantity.`,
  ],
  ['Reference stop', (settings.stopLossPoints ?? 0) > 0 ? `A fresh option price at or below the fixed 09:15–09:20 option reference close − ₹${settings.stopLossPoints} triggers a MARKET exit of all remaining units without waiting for candle close. The stop stays fixed through targets and re-entries; entry prices do not change it. The candle-close lower exit also remains active. Actual fills can differ from the trigger price.` : 'Disabled for this rule snapshot. The existing candle-close lower exit remains active.'],
  [
    "Re-entry",
    `After a full exit, a completed 5m candle must close below the original buy level. A later candle must close strictly above that same level before another BUY. The morning reference never changes. ${settings.maxEntriesPerLeg ? `Maximum ${settings.maxEntriesPerLeg} entries per leg.` : 'No configured entry-count cap.'}`,
  ],
  [
    "Cutoff",
    `${settings.cutoff} IST: block entries and square off held strategy positions. Stop uses the same exit flow.`,
  ],
];
export function RulesDialog({ onClose, settings = DEFAULT_SETTINGS }: { onClose: () => void; settings?: StrategySettings }) {
  return (
    <Dialog titleId="rules-title" onClose={onClose}>
      <span className="eyebrow">009 STRATEGY</span>
      <h2 id="rules-title">The trading rules</h2>
      <p className="dialog-description">
        Effective rule snapshot. Close-based +{settings.breakoutPercent}% / −{settings.exitPercent}% levels; {settings.entryLots} lots per entry.
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
