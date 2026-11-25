import { Link2, Check, PictureInPicture2 } from 'lucide-react'
import { NeoAvatar } from './NeoAvatar'

interface NeoHeaderProps {
  connected: boolean
  deploymentAvailable: boolean
  brokerPhase?: string
  brokerLinked?: boolean
  onBroker: () => void
  onLiveScore: () => void
  onProfile?: () => void
}

export function NeoHeader({
  connected,
  deploymentAvailable,
  brokerPhase,
  brokerLinked,
  onBroker,
  onLiveScore,
  onProfile,
}: NeoHeaderProps) {
  return (
    <header className="neo-header-bar" aria-label="Terminal header">
      {/* 1. Left: Profile Avatar (Compact, saves space) */}
      <div className="neo-header-left">
        <button
          type="button"
          className="neo-avatar-btn"
          onClick={onProfile}
          title="Account Profile"
          aria-label="Account Profile"
        >
          <NeoAvatar size={36} />
        </button>
      </div>

      {/* 2. Right: Real Trading Tool Actions (Score & Broker Link) */}
      <div className="neo-header-right">
        <button
          type="button"
          className="neo-header-action-pill"
          onClick={onLiveScore}
          title="Open floating live match score window"
        >
          <PictureInPicture2 size={13} />
          <span className="pill-text">Score</span>
        </button>

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
              ? 'mStock'
              : brokerPhase === 'checking' || brokerPhase === 'retrying'
              ? 'Restoring'
              : brokerLinked
              ? 'Verify'
              : 'Connect'}
          </span>
          {connected && <Check size={11} strokeWidth={3} />}
        </button>
      </div>
    </header>
  )
}
