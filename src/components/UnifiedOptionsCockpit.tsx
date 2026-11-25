import { ArrowUpRight, ArrowDownLeft, Clock, Target, Activity } from 'lucide-react'
import type { TradingSession, Mark } from '../../shared/model'
import { freshMark } from '../../shared/market'
import { directionOf, positionPnl, entryLevel } from '../../shared/strategy'
import { targetPrice, targetLabel } from '../../shared/targets'
import { money, price } from '../lib/format'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import type { StrategySettings } from '../../shared/settings'

interface UnifiedOptionsCockpitProps {
  session?: TradingSession | null
  marks?: Record<string, Mark>
  now: number
  settings?: StrategySettings
}

export function UnifiedOptionsCockpit({
  session,
  marks = {},
  now,
  settings = DEFAULT_SETTINGS,
}: UnifiedOptionsCockpitProps) {
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

  const ceT1 = cePos?.average != null
    ? targetPrice(settings, 1, cePos.average, cePos.direction)
    : null
  const peT1 = pePos?.average != null
    ? targetPrice(settings, 1, pePos.average, pePos.direction)
    : null

  const ceT2 = cePos?.average != null
    ? targetPrice(settings, 2, cePos.average, cePos.direction)
    : null
  const peT2 = pePos?.average != null
    ? targetPrice(settings, 2, pePos.average, pePos.direction)
    : null

  const lotSize = ceLeg?.contract.lotSize ?? peLeg?.contract.lotSize ?? 65
  const totalUnits = settings.entryLots * lotSize

  return (
    <section className="cockpit-unified-card" aria-label="Strategy Options Cockpit">
      {/* 1. Header Bar: Title + ATM Chip + Global State */}
      <div className="cockpit-card-header">
        <div className="cockpit-header-left">
          <span className="cockpit-header-title">Active Strategy Options</span>
          <span className="cockpit-atm-pill">
            ATM {atmStrike ? atmStrike.toLocaleString('en-IN') : 'Auto (09:20)'}
          </span>
        </div>
        <span className={`cockpit-status-tag ${cePos || pePos ? 'active' : ''}`}>
          {cePos || pePos
            ? 'In Position'
            : ceLeg || peLeg
            ? 'Watching Breakout'
            : 'Ready'}
        </span>
      </div>

      {/* 2. Unified Divided Body (CALL on Left, PUT on Right, Minimal Hairline Divider) */}
      <div className="cockpit-divided-body">
        {/* Left Column: CALL (CE) */}
        <div className="cockpit-side-column call-column">
          <div className="cockpit-side-head">
            <div className="cockpit-identity">
              <span className="cockpit-circle-badge call-badge">
                <ArrowUpRight size={15} strokeWidth={2.4} />
              </span>
              <div className="cockpit-naming">
                <div className="cockpit-title-row">
                  <strong className="cockpit-side-title">CALL</strong>
                  <span className="cockpit-side-tag ce">CE</span>
                </div>
                <span className="cockpit-strike-sub">
                  {ceLeg?.contract.strike ? `Strike ${ceLeg.contract.strike.toLocaleString('en-IN')}` : 'ATM Strike'}
                </span>
              </div>
            </div>

            <span className={`cockpit-pill-state ${cePos ? 'active' : ''}`}>
              {cePos
                ? cePos.direction === 'sell' || directionOf(settings) === 'sell'
                  ? 'Short'
                  : 'Long'
                : ceLeg
                ? 'Watching'
                : 'Ready'}
            </span>
          </div>

          <div className="cockpit-price-row">
            <div className="cockpit-ltp-group">
              <span className="cockpit-micro-tag">LIVE LTP</span>
              <strong className="cockpit-ltp-val">
                {ceFresh ? `₹${price(ceMark!.price)}` : '—'}
              </strong>
              <span className="cockpit-ltp-sub">
                {ceFresh ? 'Live feed' : ceLeg ? 'Waiting tick' : 'Waiting 09:20'}
              </span>
            </div>

            <div className="cockpit-pnl-group">
              <span className="cockpit-micro-tag">OPEN P&L</span>
              <strong
                className={`cockpit-pnl-val ${
                  cePnl != null && cePnl > 0
                    ? 'positive'
                    : cePnl != null && cePnl < 0
                    ? 'negative'
                    : 'neutral'
                }`}
              >
                {cePnl != null ? money(cePnl) : cePos ? 'Open' : 'Flat'}
              </strong>
              <span className="cockpit-pos-sub">
                {cePos ? `${cePos.quantity} units (${cePos.quantity / lotSize}L)` : 'No position'}
              </span>
            </div>
          </div>

          {/* Minimal Divided Key Levels Grid */}
          <div className="cockpit-metrics-grid">
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Breakout</span>
              <strong className="cell-val">
                {ceEntry != null ? `₹${price(ceEntry)}` : '—'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Exit (SL)</span>
              <strong className="cell-val">
                {ceExit != null ? `₹${price(ceExit)}` : '—'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Ref Close</span>
              <strong className="cell-val">
                {ceLeg?.reference.close != null ? `₹${price(ceLeg.reference.close)}` : '—'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Target 1</span>
              <strong className="cell-val">
                {ceT1 != null ? `₹${price(ceT1)}` : settings.target1Lots ? targetLabel(settings, 1) : 'Skip T1'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Target 2</span>
              <strong className="cell-val">
                {ceT2 != null ? `₹${price(ceT2)}` : targetLabel(settings, 2)}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Avg Fill</span>
              <strong className="cell-val">
                {cePos?.average != null ? `₹${price(cePos.average)}` : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* Minimal Hairline Divider */}
        <div className="cockpit-minimal-divider" role="separator" />

        {/* Right Column: PUT (PE) */}
        <div className="cockpit-side-column put-column">
          <div className="cockpit-side-head">
            <div className="cockpit-identity">
              <span className="cockpit-circle-badge put-badge">
                <ArrowDownLeft size={15} strokeWidth={2.4} />
              </span>
              <div className="cockpit-naming">
                <div className="cockpit-title-row">
                  <strong className="cockpit-side-title">PUT</strong>
                  <span className="cockpit-side-tag pe">PE</span>
                </div>
                <span className="cockpit-strike-sub">
                  {peLeg?.contract.strike ? `Strike ${peLeg.contract.strike.toLocaleString('en-IN')}` : 'ATM Strike'}
                </span>
              </div>
            </div>

            <span className={`cockpit-pill-state ${pePos ? 'active' : ''}`}>
              {pePos
                ? pePos.direction === 'sell' || directionOf(settings) === 'sell'
                  ? 'Short'
                  : 'Long'
                : peLeg
                ? 'Watching'
                : 'Ready'}
            </span>
          </div>

          <div className="cockpit-price-row">
            <div className="cockpit-ltp-group">
              <span className="cockpit-micro-tag">LIVE LTP</span>
              <strong className="cockpit-ltp-val">
                {peFresh ? `₹${price(peMark!.price)}` : '—'}
              </strong>
              <span className="cockpit-ltp-sub">
                {peFresh ? 'Live feed' : peLeg ? 'Waiting tick' : 'Waiting 09:20'}
              </span>
            </div>

            <div className="cockpit-pnl-group">
              <span className="cockpit-micro-tag">OPEN P&L</span>
              <strong
                className={`cockpit-pnl-val ${
                  pePnl != null && pePnl > 0
                    ? 'positive'
                    : pePnl != null && pePnl < 0
                    ? 'negative'
                    : 'neutral'
                }`}
              >
                {pePnl != null ? money(pePnl) : pePos ? 'Open' : 'Flat'}
              </strong>
              <span className="cockpit-pos-sub">
                {pePos ? `${pePos.quantity} units (${pePos.quantity / lotSize}L)` : 'No position'}
              </span>
            </div>
          </div>

          {/* Minimal Divided Key Levels Grid */}
          <div className="cockpit-metrics-grid">
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Breakout</span>
              <strong className="cell-val">
                {peEntry != null ? `₹${price(peEntry)}` : '—'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Exit (SL)</span>
              <strong className="cell-val">
                {peExit != null ? `₹${price(peExit)}` : '—'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Ref Close</span>
              <strong className="cell-val">
                {peLeg?.reference.close != null ? `₹${price(peLeg.reference.close)}` : '—'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Target 1</span>
              <strong className="cell-val">
                {peT1 != null ? `₹${price(peT1)}` : settings.target1Lots ? targetLabel(settings, 1) : 'Skip T1'}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Target 2</span>
              <strong className="cell-val">
                {peT2 != null ? `₹${price(peT2)}` : targetLabel(settings, 2)}
              </strong>
            </div>
            <div className="cockpit-metric-cell">
              <span className="cell-lbl">Avg Fill</span>
              <strong className="cell-val">
                {pePos?.average != null ? `₹${price(pePos.average)}` : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Divided Minimal Footer */}
      <div className="cockpit-card-footer">
        <div className="cockpit-footer-item">
          <span className="footer-lbl">LOT</span>
          <strong className="footer-val">{lotSize} qty</strong>
        </div>
        <span className="footer-divider-dot">·</span>
        <div className="cockpit-footer-item">
          <span className="footer-lbl">ORDER</span>
          <strong className="footer-val">{totalUnits} units ({settings.entryLots} lots)</strong>
        </div>
        <span className="footer-divider-dot">·</span>
        <div className="cockpit-footer-item">
          <span className="footer-lbl">CUTOFF</span>
          <strong className="footer-val">{settings.cutoff} IST</strong>
        </div>
      </div>
    </section>
  )
}
