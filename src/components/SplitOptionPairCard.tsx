import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import type { TradingSession, Mark } from '../../shared/model'
import { freshMark } from '../../shared/market'
import { directionOf, positionPnl, entryLevel } from '../../shared/strategy'
import { money, price } from '../lib/format'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import type { StrategySettings } from '../../shared/settings'

interface SplitOptionPairCardProps {
  session?: TradingSession | null
  marks?: Record<string, Mark>
  now: number
  settings?: StrategySettings
}

export function SplitOptionPairCard({
  session,
  marks = {},
  now,
  settings = DEFAULT_SETTINGS,
}: SplitOptionPairCardProps) {
  const ceLeg = session?.legs?.CE
  const peLeg = session?.legs?.PE

  const ceMark = ceLeg ? marks[ceLeg.contract.token] : undefined
  const peMark = peLeg ? marks[peLeg.contract.token] : undefined

  const ceFresh = freshMark(ceMark, now)
  const peFresh = freshMark(peMark, now)

  const cePos = ceLeg?.position
  const pePos = peLeg?.position

  const cePnl = cePos && ceFresh ? positionPnl(cePos, ceMark!.price, settings) : null
  const pePnl = pePos && peFresh ? positionPnl(pePos, peMark!.price, settings) : null

  const atmStrike =
    session?.atm ??
    ceLeg?.contract.strike ??
    peLeg?.contract.strike ??
    null

  const ceEntry = ceLeg ? entryLevel(ceLeg, settings) : null
  const peEntry = peLeg ? entryLevel(peLeg, settings) : null

  const ceExit = ceLeg
    ? cePos?.direction === 'sell' || directionOf(settings) === 'sell'
      ? ceLeg.upper
      : ceLeg.lower
    : null
  const peExit = peLeg
    ? pePos?.direction === 'sell' || directionOf(settings) === 'sell'
      ? peLeg.upper
      : peLeg.lower
    : null

  const lotSize = ceLeg?.contract.lotSize ?? peLeg?.contract.lotSize ?? 65
  const totalUnits = settings.entryLots * lotSize

  return (
    <section className="split-option-card" aria-label="Strategy Options Pair">
      {/* 1. Header Bar */}
      <div className="split-card-header">
        <div className="split-header-left">
          <span className="split-header-title">Active Strategy Options</span>
          <span className="split-atm-pill">
            ATM {atmStrike ? atmStrike.toLocaleString('en-IN') : 'Auto (09:20)'}
          </span>
        </div>
        <span className={`split-header-status ${cePos || pePos ? 'active' : ''}`}>
          {cePos || pePos
            ? 'In Position'
            : ceLeg || peLeg
            ? 'Watching Breakout'
            : 'Ready'}
        </span>
      </div>

      {/* 2. Split Body (CALL on Left, PUT on Right) */}
      <div className="split-card-grid">
        {/* Left Column: CALL (CE) */}
        <div className="split-leg-pane call-pane">
          <div className="split-leg-head">
            <div className="split-leg-info">
              <span className="split-badge call-badge">
                <ArrowUpRight size={15} strokeWidth={2.4} />
              </span>
              <div className="split-leg-meta">
                <div className="split-title-row">
                  <strong className="split-leg-name">CALL</strong>
                  <span className="split-side-tag ce">CE</span>
                </div>
                <span className="split-strike-label">
                  {ceLeg?.contract.strike.toLocaleString('en-IN') ?? 'ATM Strike'}
                </span>
              </div>
            </div>

            <span className={`split-status-pill ${cePos ? 'active' : ''}`}>
              {cePos
                ? cePos.direction === 'sell' || directionOf(settings) === 'sell'
                  ? 'Short'
                  : 'Long'
                : ceLeg
                ? 'Watching'
                : 'Ready'}
            </span>
          </div>

          <div className="split-price-row">
            <strong className="split-price">
              {ceFresh ? `₹${price(ceMark!.price)}` : '—'}
            </strong>
            <span
              className={`split-pnl-chip ${
                cePnl != null && cePnl > 0
                  ? 'positive'
                  : cePnl != null && cePnl < 0
                  ? 'negative'
                  : 'neutral'
              }`}
            >
              {cePnl != null ? money(cePnl) : cePos ? 'Open' : 'Flat'}
            </span>
          </div>

          <div className="split-metrics-table">
            <div className="split-metric-item">
              <span className="metric-lbl">Breakout</span>
              <strong className="metric-num">
                {ceEntry != null ? `₹${price(ceEntry)}` : '—'}
              </strong>
            </div>
            <div className="split-metric-item">
              <span className="metric-lbl">Exit (SL)</span>
              <strong className="metric-num">
                {ceExit != null ? `₹${price(ceExit)}` : '—'}
              </strong>
            </div>
            <div className="split-metric-item">
              <span className="metric-lbl">Ref Close</span>
              <strong className="metric-num">
                {ceLeg?.reference.close != null ? `₹${price(ceLeg.reference.close)}` : '—'}
              </strong>
            </div>
            {cePos && (
              <div className="split-metric-item highlight">
                <span className="metric-lbl">Avg Fill</span>
                <strong className="metric-num">{price(cePos.average)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: PUT (PE) */}
        <div className="split-leg-pane put-pane">
          <div className="split-leg-head">
            <div className="split-leg-info">
              <span className="split-badge put-badge">
                <ArrowDownLeft size={15} strokeWidth={2.4} />
              </span>
              <div className="split-leg-meta">
                <div className="split-title-row">
                  <strong className="split-leg-name">PUT</strong>
                  <span className="split-side-tag pe">PE</span>
                </div>
                <span className="split-strike-label">
                  {peLeg?.contract.strike.toLocaleString('en-IN') ?? 'ATM Strike'}
                </span>
              </div>
            </div>

            <span className={`split-status-pill ${pePos ? 'active' : ''}`}>
              {pePos
                ? pePos.direction === 'sell' || directionOf(settings) === 'sell'
                  ? 'Short'
                  : 'Long'
                : peLeg
                ? 'Watching'
                : 'Ready'}
            </span>
          </div>

          <div className="split-price-row">
            <strong className="split-price">
              {peFresh ? `₹${price(peMark!.price)}` : '—'}
            </strong>
            <span
              className={`split-pnl-chip ${
                pePnl != null && pePnl > 0
                  ? 'positive'
                  : pePnl != null && pePnl < 0
                  ? 'negative'
                  : 'neutral'
              }`}
            >
              {pePnl != null ? money(pePnl) : pePos ? 'Open' : 'Flat'}
            </span>
          </div>

          <div className="split-metrics-table">
            <div className="split-metric-item">
              <span className="metric-lbl">Breakout</span>
              <strong className="metric-num">
                {peEntry != null ? `₹${price(peEntry)}` : '—'}
              </strong>
            </div>
            <div className="split-metric-item">
              <span className="metric-lbl">Exit (SL)</span>
              <strong className="metric-num">
                {peExit != null ? `₹${price(peExit)}` : '—'}
              </strong>
            </div>
            <div className="split-metric-item">
              <span className="metric-lbl">Ref Close</span>
              <strong className="metric-num">
                {peLeg?.reference.close != null ? `₹${price(peLeg.reference.close)}` : '—'}
              </strong>
            </div>
            {pePos && (
              <div className="split-metric-item highlight">
                <span className="metric-lbl">Avg Fill</span>
                <strong className="metric-num">{price(pePos.average)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Unified Bottom Context Strip */}
      <div className="split-card-footer">
        <span>
          {ceLeg || peLeg
            ? `NIFTY 50 Options · Lot ${lotSize} · Entry ${totalUnits} units (${settings.entryLots} lots)`
            : 'Awaiting 09:20 IST reference candle to resolve ATM option strikes.'}
        </span>
      </div>
    </section>
  )
}
