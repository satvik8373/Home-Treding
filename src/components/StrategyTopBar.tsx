import { BookOpen, Check, Layers, Clock, Target } from 'lucide-react'
import type { StrategyDirection } from '../../shared/strategy'
import { directionOf, strategyName } from '../../shared/strategy'
import { targetLabel } from '../../shared/targets'
import { productFor } from '../../shared/settings'
import type { StrategySettings } from '../../shared/settings'
import type { TradingSession } from '../../shared/model'

interface StrategyTopBarProps {
  settings: StrategySettings
  session?: TradingSession | null
  locked: boolean
  working: string
  direction?: StrategyDirection | null
  onDirectionChange?: (dir: StrategyDirection) => void
  onRules?: () => void
}

const DIRECTIONS: { key: StrategyDirection; label: string; desc: string }[] = [
  { key: 'buy', label: '009 BUY', desc: 'Breakout Buy' },
  { key: 'sell', label: '009 SELL', desc: 'Option Sell' },
  { key: 'both', label: '009 BOTH', desc: 'Dual Buy & Sell' },
]

export function StrategyTopBar({
  settings,
  session,
  locked,
  working,
  direction,
  onDirectionChange,
  onRules,
}: StrategyTopBarProps) {
  const currentDir = direction ?? directionOf(settings)

  return (
    <div className="strategy-top-hub" aria-label="Strategy selection and focus parameters">
      {/* 1. Top Strategy Direction Pill Buttons (High Focus) */}
      <div className="strategy-direction-pills" role="radiogroup" aria-label="Strategy Direction">
        {DIRECTIONS.map((item) => {
          const isActive = currentDir === item.key
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={locked || !!working}
              className={`strategy-dir-btn ${isActive ? 'active' : ''}`}
              title={
                locked
                  ? 'Stop and flatten session before switching strategy'
                  : `Select ${item.label} (${item.desc})`
              }
              onClick={() => onDirectionChange?.(item.key)}
            >
              <span className="dir-btn-label">{item.label}</span>
              {isActive && <Check size={12} strokeWidth={3} className="dir-check-icon" />}
            </button>
          )
        })}
      </div>

      {/* 2. Key Strategy Parameters Chips Strip */}
      <div className="strategy-focus-chips">
        <span className="focus-chip" title="Atm strike automatically resolved at 09:20 IST">
          <strong>ATM</strong> {session?.atm?.toLocaleString('en-IN') ?? 'Auto (09:20)'}
        </span>
        <span className="focus-chip" title="Order quantity and product type">
          <strong>Size</strong> {settings.entryLots} lots · {productFor(settings)}
        </span>
        <span className="focus-chip" title="Trading window cutoff time">
          <Clock size={11} />
          <strong>Cutoff</strong> {settings.cutoff}
        </span>
        <span className="focus-chip" title="Profit target levels">
          <Target size={11} />
          <strong>Targets</strong> {settings.target1Lots ? targetLabel(settings, 1) : 'T1 Skip'} / {targetLabel(settings, 2)}
        </span>
        {onRules && (
          <button
            type="button"
            className="focus-rules-btn"
            onClick={onRules}
            title="Inspect complete strategy rules"
          >
            <BookOpen size={12} />
            <span>Rules</span>
          </button>
        )}
      </div>
    </div>
  )
}
