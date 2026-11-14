import { ChevronDown, SlidersHorizontal, BookOpen, Clock } from 'lucide-react';
import type { StrategyDirection } from '../../shared/strategy';
import { directionOf, strategyName } from '../../shared/strategy';
import { targetLabel } from '../../shared/targets';
import { productFor } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';
import type { TradingSession } from '../../shared/model';

type Props = {
  settings: StrategySettings;
  session?: TradingSession | null;
  locked: boolean;
  working: string;
  direction?: StrategyDirection;
  onDirectionChange?: (dir: StrategyDirection) => void;
  onSettings?: () => void;
  onRules?: () => void;
};

export function StrategyContextBanner({
  settings,
  session,
  locked,
  working,
  direction,
  onDirectionChange,
  onSettings,
  onRules,
}: Props) {
  const currentDir = direction ?? directionOf(settings);

  return (
    <div className="strategy-context-banner">
      <div className="banner-top-row">
        <div className="banner-strategy-picker">
          {onDirectionChange ? (
            <div className="custom-select-wrap">
              <select
                className="banner-select"
                aria-label="Strategy"
                value={currentDir}
                disabled={locked || !!working}
                onChange={(e) => onDirectionChange(e.target.value as StrategyDirection)}
                title={locked ? 'Stop and flatten before switching direction' : 'Select Strategy'}
              >
                <option value="buy">009 Breakout – Buy</option>
                <option value="sell">009 Breakout – Sell</option>
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
          ) : (
            <h2 className="banner-title">{strategyName(settings)}</h2>
          )}
        </div>

        <div className="banner-actions">
          {onSettings && (
            <button className="banner-btn" onClick={onSettings} title="Configure parameters">
              <SlidersHorizontal size={13} />
              <span>Settings</span>
            </button>
          )}
          {onRules && (
            <button className="banner-btn" onClick={onRules} title="Read strategy rules">
              <BookOpen size={13} />
              <span>Rules</span>
            </button>
          )}
        </div>
      </div>

      <div className="banner-chips-row">
        <span className="banner-chip">
          <strong>ATM</strong> {session?.atm?.toLocaleString('en-IN') ?? 'Auto (09:20)'}
        </span>
        <span className="banner-chip">
          <strong>Size</strong> {settings.entryLots} lots · {productFor(settings)}
        </span>
        <span className="banner-chip">
          <Clock size={11} />
          <strong>Cutoff</strong> {settings.cutoff} IST
        </span>
        <span className="banner-chip">
          <strong>Targets</strong> {settings.target1Lots ? targetLabel(settings, 1) : 'T1 Skipped'} / {targetLabel(settings, 2)}
        </span>
      </div>

      <details className="banner-accordion">
        <summary className="accordion-trigger">
          <span>Detailed Strategy Setup</span>
          <ChevronDown size={12} className="accordion-arrow" />
        </summary>
        <div className="accordion-content">
          <dl className="specs-grid">
            <div>
              <dt>Broker Product</dt>
              <dd>{productFor(settings) === 'MIS' ? 'Day Trade · MIS' : 'Carry Forward · NRML'}</dd>
            </div>
            <div>
              <dt>Reference Candle</dt>
              <dd>09:15–09:20 (5-min close)</dd>
            </div>
            <div>
              <dt>Breakout / Exit</dt>
              <dd>
                {currentDir === 'sell' ? '−' : '+'}{settings.breakoutPercent}% / {currentDir === 'sell' ? '+' : '−'}{settings.exitPercent}%
              </dd>
            </div>
            <div>
              <dt>Stop Loss</dt>
              <dd>
                {(settings.stopLossPoints ?? 0) > 0
                  ? `Reference ${currentDir === 'sell' ? '+' : '−'}${settings.stopLossPoints} pts`
                  : 'Disabled'}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </div>
  );
}
