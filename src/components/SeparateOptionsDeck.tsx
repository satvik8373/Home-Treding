import { ArrowUpRight, ArrowDownLeft, Target, Shield, Clock } from 'lucide-react'
import type { TradingSession, Mark, Side } from '../../shared/model'
import { freshMark } from '../../shared/market'
import { directionOf, positionPnl, referenceStop, entryLevel } from '../../shared/strategy'
import { targetPrice, targetLabel } from '../../shared/targets'
import { money, price } from '../lib/format'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import type { StrategySettings } from '../../shared/settings'

interface SeparateOptionsDeckProps {
  session?: TradingSession | null
  marks?: Record<string, Mark>
  now: number
  settings?: StrategySettings
}

interface SingleLegCardProps {
  side: Side
  session?: TradingSession | null
  marks?: Record<string, Mark>
  now: number
  settings: StrategySettings
}

function SingleLegCard({ side, session, marks = {}, now, settings }: SingleLegCardProps) {
  const isCall = side === 'CE'
  const leg = session?.legs?.[side]
  const mark = leg ? marks[leg.contract.token] : undefined
  const fresh = freshMark(mark, now)
  const position = leg?.position

  const pnl = position && fresh ? positionPnl(position, mark.price, settings) : null

  const strikeStr = leg?.contract.strike
    ? leg.contract.strike.toLocaleString('en-IN')
    : session?.atm
    ? session.atm.toLocaleString('en-IN')
    : 'ATM'

  const entry = leg ? entryLevel(leg, settings) : null
  const exitLevel = leg
    ? position?.direction === 'sell' || directionOf(settings) === 'sell'
      ? leg.upper
      : leg.lower
    : null

  const refStop =
    position &&
    (settings.stopLossPoints ?? 0) > 0 &&
    leg?.reference.close != null &&
    referenceStop(leg.reference.close, settings, position.direction) > 0
      ? referenceStop(leg.reference.close, settings, position.direction)
      : null

  const t1 = position?.average != null
    ? targetPrice(settings, 1, position.average, position.direction)
    : null
  const t2 = position?.average != null
    ? targetPrice(settings, 2, position.average, position.direction)
    : null

  const lotSize = leg?.contract.lotSize ?? 65
  const orderUnits = settings.entryLots * lotSize

  return (
    <article
      className={`separate-leg-card ${isCall ? 'call-card' : 'put-card'}`}
      aria-label={`${isCall ? 'CALL' : 'PUT'} Option Strategy Leg`}
    >
      {/* 1. Card Top Bar: Icon + Side + Strike + Live Status Tag */}
      <div className="leg-card-header">
        <div className="leg-card-title-group">
          <div className={`leg-circle-badge ${isCall ? 'call-badge' : 'put-badge'}`}>
            {isCall ? (
              <ArrowUpRight size={18} strokeWidth={2.4} />
            ) : (
              <ArrowDownLeft size={18} strokeWidth={2.4} />
            )}
          </div>
          <div className="leg-naming-meta">
            <div className="leg-title-row">
              <strong className="leg-main-title">{isCall ? 'CALL' : 'PUT'}</strong>
              <span className={`leg-strike-badge ${isCall ? 'ce' : 'pe'}`}>{strikeStr}</span>
              <span className={`leg-side-indicator ${isCall ? 'ce' : 'pe'}`}>{isCall ? 'CE' : 'PE'}</span>
            </div>
            <span className="leg-contract-sub">
              {leg?.contract.symbol ?? 'NIFTY ATM · 09:20 Reference Candle'}
            </span>
          </div>
        </div>

        <span className={`leg-state-pill ${position ? 'active' : ''}`}>
          {position
            ? position.direction === 'sell' || directionOf(settings) === 'sell'
              ? 'Short Trade'
              : 'Long Trade'
            : leg
            ? 'Watching Breakout'
            : 'Waiting'}
        </span>
      </div>

      {/* 2. Hero Pricing & Open Position Row */}
      <div className="leg-price-pnl-row">
        <div className="leg-ltp-block">
          <span className="leg-ltp-label">LIVE LTP</span>
          <strong className="leg-ltp-price">
            {fresh ? `₹${price(mark!.price)}` : '—'}
          </strong>
        </div>

        <div className="leg-pnl-capsule">
          <span className="leg-capsule-label">OPEN P&L</span>
          <strong
            className={`leg-capsule-pnl ${
              pnl != null && pnl > 0
                ? 'positive'
                : pnl != null && pnl < 0
                ? 'negative'
                : 'neutral'
            }`}
          >
            {pnl != null ? money(pnl) : position ? 'Open' : 'Flat'}
          </strong>
          <small className="leg-units-count">
            {position ? `${position.quantity} units (${position.quantity / lotSize}L)` : 'No Position'}
          </small>
        </div>
      </div>

      {/* 3. All Required Algorithmic Levels Visible At Once (No Dropdown / No Drawers) */}
      <div className="leg-levels-grid">
        <div className="level-item" title="Breakout entry execution level">
          <span className="level-label">Breakout</span>
          <strong className="level-val">
            {entry != null ? `₹${price(entry)}` : '—'}
          </strong>
        </div>

        <div className="level-item" title="Algorithmic stop-loss exit level">
          <span className="level-label">Exit (SL)</span>
          <strong className="level-val">
            {exitLevel != null ? `₹${price(exitLevel)}` : '—'}
          </strong>
        </div>

        <div className="level-item" title="09:20 Reference candle close">
          <span className="level-label">Ref Close</span>
          <strong className="level-val">
            {leg?.reference.close != null ? `₹${price(leg.reference.close)}` : '—'}
          </strong>
        </div>

        <div className="level-item" title="09:20 Reference candle High / Low range">
          <span className="level-label">Ref Range</span>
          <strong className="level-val">
            {leg ? `${price(leg.upper)} / ${price(leg.lower)}` : '—'}
          </strong>
        </div>

        <div className="level-item" title="Target 1 objective level">
          <span className="level-label">Target 1</span>
          <strong className="level-val">
            {t1 != null ? `₹${price(t1)}` : settings.target1Lots ? targetLabel(settings, 1) : 'Skip T1'}
          </strong>
        </div>

        <div className="level-item" title="Target 2 objective level">
          <span className="level-label">Target 2</span>
          <strong className="level-val">
            {t2 != null ? `₹${price(t2)}` : targetLabel(settings, 2)}
          </strong>
        </div>

        <div className="level-item" title="Average execution fill price">
          <span className="level-label">Avg Fill</span>
          <strong className="level-val">
            {position?.average != null ? `₹${price(position.average)}` : '—'}
          </strong>
        </div>

        <div className="level-item" title="Session executions count">
          <span className="level-label">Entries</span>
          <strong className="level-val">
            {leg?.entries ?? 0} {settings.maxEntriesPerLeg ? `/ ${settings.maxEntriesPerLeg}` : ''}
          </strong>
        </div>
      </div>

      {/* 4. Clear Footer Strip */}
      <div className="leg-card-footer-strip">
        <span className="footer-chip">
          Lot {lotSize} · Size {orderUnits} units ({settings.entryLots} lots)
        </span>
        <span className="footer-chip cutoff">
          <Clock size={11} />
          Cutoff {settings.cutoff}
        </span>
      </div>
    </article>
  )
}

export function SeparateOptionsDeck({
  session,
  marks = {},
  now,
  settings = DEFAULT_SETTINGS,
}: SeparateOptionsDeckProps) {
  return (
    <section className="separate-options-deck" aria-label="Strategy Option Positions">
      <SingleLegCard
        side="CE"
        session={session}
        marks={marks}
        now={now}
        settings={settings}
      />
      <SingleLegCard
        side="PE"
        session={session}
        marks={marks}
        now={now}
        settings={settings}
      />
    </section>
  )
}
