import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

interface AlertItem {
  id: string
  title: string
  body: string
  actionLabel?: string
  actionHref?: string
  tag?: string
  time?: string
}

interface StackedAlertDeckProps {
  alerts?: AlertItem[]
  onAction?: (alert: AlertItem) => void
}

const DEFAULT_ALERTS: AlertItem[] = [
  {
    id: '1',
    title: 'SPRD Dow jones industrial average EFT is up',
    body: 'Major indices are higher following comments from fed chair Powell on......',
    actionLabel: 'View ETF',
    tag: 'Macro Alert',
    time: '10m ago',
  },
  {
    id: '2',
    title: 'NIFTY 50 Strategy Execution Active',
    body: 'Opening range breakout strategy monitoring ATM Call & Put strikes. Live feeds synced with mStock official API.',
    actionLabel: 'View Signals',
    tag: 'Algo Signal',
    time: 'Just now',
  },
  {
    id: '3',
    title: 'Volatility Index & Premium Decay Update',
    body: 'India VIX trading in neutral band. Target 1 partial exits active at 40 points with trailing stop protection.',
    actionLabel: 'Inspect Rules',
    tag: 'Risk Desk',
    time: '25m ago',
  },
]

export function StackedAlertDeck({ alerts = DEFAULT_ALERTS, onAction }: StackedAlertDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const items = alerts && alerts.length > 0 ? alerts : DEFAULT_ALERTS
  const activeAlert = items[activeIndex] || items[0]
  const count = items.length

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % items.length)
  }

  return (
    <div className="neo-stack-wrapper" aria-label="Market and strategy alert deck">
      {/* 1. Behind Layer 2 (Soft Lavender peek from Image 1) */}
      <div className="neo-stack-layer neo-stack-layer-back" />

      {/* 2. Behind Layer 1 (Periwinkle peek from Image 1) */}
      <div className="neo-stack-layer neo-stack-layer-mid" />

      {/* 3. Badge Counter (Exact Image 1 "2" circle pill on top-right) */}
      <div
        className="neo-stack-badge"
        onClick={handleNext}
        title="Cycle next alert card"
        role="button"
        tabIndex={0}
      >
        <span>2</span>
      </div>

      {/* 4. Front Dark Card (Exact Image 1 Deep Midnight/Black Card) */}
      <div className="neo-stack-front-card" onClick={handleNext}>
        <div className="neo-stack-content">
          <h3 className="neo-stack-title">{activeAlert.title}</h3>

          <p className="neo-stack-body">{activeAlert.body}</p>

          <div className="neo-stack-action-row">
            <button
              type="button"
              className="neo-stack-btn"
              onClick={(e) => {
                e.stopPropagation()
                onAction?.(activeAlert)
              }}
            >
              <span>{activeAlert.actionLabel || 'View ETF'}</span>
              <ArrowUpRight size={13} />
            </button>
            <span className="neo-stack-hint">Tap card for next</span>
          </div>
        </div>
      </div>
    </div>
  )
}
