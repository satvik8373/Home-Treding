import { Dialog } from "./Dialog";

const rules = [
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
    "From 09:25: a new completed 5m close ≥ reference × 1.0009. Buy 3 lots when that leg is flat.",
  ],
  [
    "Targets",
    "Fresh option prices trigger 1 lot at actual fill + ₹20, then all remaining units at fill + ₹40.",
  ],
  [
    "Lower exit",
    "A completed 5m close < reference × 0.9991 exits the remaining quantity.",
  ],
  [
    "Re-entry",
    "Allowed on a later qualifying candle. CALL and PUT run independently and can both be open.",
  ],
  [
    "Cutoff",
    "15:10 IST: block entries and square off both legs. Stop uses the same exit flow.",
  ],
];
export function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog titleId="rules-title" onClose={onClose}>
      <span className="eyebrow">009 STRATEGY</span>
      <h2 id="rules-title">The trading rules</h2>
      <p className="dialog-description">
        Close-based 0.09% levels. Independent CALL and PUT decisions.
      </p>
      <dl className="rules-detail">
        {rules.map(([title, text]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
