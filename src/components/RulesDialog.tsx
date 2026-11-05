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
  [
    "Re-entry",
    `Allowed on a later qualifying candle, subject to ${settings.maxEntriesPerLeg ? `${settings.maxEntriesPerLeg} entries per leg in this session` : 'no configured entry-count cap'}. Entry legs: ${settings.enabledSides.join(' + ')}. Both ATM references are fetched.`,
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
