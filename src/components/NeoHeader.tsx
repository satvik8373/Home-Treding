import { Link2, Check, TrendingUp } from 'lucide-react'
import { NeoAvatar } from './NeoAvatar'

interface NeoHeaderProps {
  connected: boolean
  deploymentAvailable: boolean
  brokerPhase?: string
  brokerLinked?: boolean
  onBroker: () => void
  onLiveScore?: () => void
  onProfile?: () => void
}

export function NeoHeader({
  connected,
  deploymentAvailable,
  brokerPhase,
  brokerLinked,
  onBroker,
  onProfile,
}: NeoHeaderProps) {
  return (
    <header className="neo-header-bar" aria-label="Terminal header">
      {/* 1. Left: Brand Mark + Title "Mavrix Trading" + Algo Badge */}
      <div className="neo-header-brand-group">
        <div className="neo-brand-mark" aria-hidden="true">
          <TrendingUp size={16} strokeWidth={2.4} />
        </div>
        <div className="neo-brand-text">
          <h1 className="neo-brand-title">Mavrix Trading</h1>
          <span className="neo-brand-badge">009 ALGO</span>
        </div>
      </div>

      {/* 2. Right: Broker Link Pill & Account Profile Avatar */}
      <div className="neo-header-right">
        <button
          type="button"
          className={`neo-broker-pill ${connected ? 'connected' : ''}`}
          disabled={!deploymentAvailable}
          title={!deploymentAvailable ? 'Connect hosted execution engine first.' : undefined}
          onClick={onBroker}
        >
          <Link2 size={13} />
          <span>
            {connected
              ? 'mStock Connected'
              : brokerPhase === 'checking' || brokerPhase === 'retrying'
              ? 'Restoring…'
              : brokerLinked
              ? 'Verify mStock'
              : 'Connect mStock'}
          </span>
          {connected && <Check size={12} strokeWidth={2.5} />}
        </button>

        {onProfile && (
          <button
            type="button"
            className="neo-avatar-btn"
            onClick={onProfile}
            title="Account Profile"
            aria-label="Account Profile"
          >
            <NeoAvatar size={32} />
          </button>
        )}
      </div>
    </header>
  )
}
