import { useState } from 'react'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react'
import type { Leg, Mark, Side } from '../../shared/model'
import { freshMark } from '../../shared/market'
import { directionOf, positionPnl, referenceStop, entryLevel } from '../../shared/strategy'
import { targetPrice, targetLabel, targetRule } from '../../shared/targets'
import { money, price } from '../lib/format'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import type { StrategySettings } from '../../shared/settings'

interface RealInstrumentsListProps {
  marks?: Record<string, Mark>
  legs?: Partial<Record<Side, Leg>>
  now: number
  settings?: StrategySettings
  spotPrice?: number | null
}

function MiniSparkline({ positive = true }: { positive?: boolean }) {
  const strokeColor = positive ? '#10b981' : '#f43f5e'
  const pathData = positive
    ? 'M 2 15 C 10 19, 18 7, 26 9 C 34 11, 42 3, 52 6 C 60 8, 68 2, 74 3'
    : 'M 2 4 C 10 2, 18 12, 26 8 C 34 6, 42 17, 52 13 C 60 11, 68 18, 74 17'

  return (
    <svg width="64" height="20" viewBox="0 0 76 20" fill="none" className="instrument-sparkline-svg">
      <path
        d={pathData}
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="74" cy={positive ? 3 : 17} r="2.5" fill={strokeColor} />
    </svg>
  )
}

export function RealInstrumentsList({
  marks = {},
  legs = {},
  now,
  settings = DEFAULT_SETTINGS,
  spotPrice,
}: RealInstrumentsListProps) {
  const [expandedSide, setExpandedSide] = useState<Side | null>(null)

  const ceLeg = legs.CE
  const peLeg = legs.PE
  const ceMark = ceLeg ? marks[ceLeg.contract.token] : undefined
  const peMark = peLeg ? marks[peLeg.contract.token] : undefined

  const ceFresh = freshMark(ceMark, now)
  const peFresh = freshMark(peMark, now)

  const cePos = ceLeg?.position
  const pePos = peLeg?.position

  const cePnl = cePos && ceFresh ? positionPnl(cePos, ceMark!.price, settings) : null
  const pePnl = pePos && peFresh ? positionPnl(pePos, peMark!.price, settings) : null

  const toggleExpand = (side: Side) => {
    setExpandedSide((prev) => (prev === side ? null : side))
  }

  // Breakout levels
  const ceEntry = ceLeg ? entryLevel(ceLeg, settings) : null
  const peEntry = peLeg ? entryLevel(peLeg, settings) : null

  // Exit / Stop levels
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

  // Target 1 (if configured and in position)
  const ceT1 = ceLeg?.position?.average != null
    ? targetPrice(settings, 1, ceLeg.position.average, cePos?.direction)
    : null
  const peT1 = peLeg?.position?.average != null
    ? targetPrice(settings, 1, peLeg.position.average, pePos?.direction)
    : null

  return (
    <section className="instruments-deck" aria-label="Active Strategy Instruments">
      {/* Header bar matching clean reference aesthetic */}
      <div className="instruments-deck-header">
        <div className="deck-header-left">
          <div className="deck-header-icon-pill">
            <Sparkles size={14} className="deck-spark-icon" />
            <h3 className="instruments-deck-title">Active Strategy Instruments</h3>
          </div>
          <span className="instruments-deck-subtitle">009 Options Engine · NIFTY 50</span>
        </div>
        <div className="deck-header-right">
          <span className="instruments-deck-tag">
            {ceLeg || peLeg ? 'Pair Locked' : 'Awaiting 09:20 Reference'}
          </span>
        </div>
      </div>

      <div className="instruments-cards-column">
        {/* 1. CALL (CE) Option Instrument Squircle Card */}
        <div
          className={`instrument-squircle-card ce-card ${expandedSide === 'CE' ? 'expanded' : ''}`}
          role="region"
          aria-label="CALL Option Contract"
        >
          <div className="instrument-card-main" onClick={() => toggleExpand('CE')}>
            <div className="instrument-left">
              <div className="instrument-badge call-badge">
                <ArrowUpRight size={19} strokeWidth={2.4} />
              </div>
              <div className="instrument-meta">
                <div className="instrument-title-row">
                  <strong className="instrument-title">
                    CALL {ceLeg?.contract.strike.toLocaleString('en-IN') ?? 'ATM'}
                  </strong>
                  <span className="instrument-side-chip ce">CE</span>
                </div>
                <span className="instrument-sub">
                  {ceLeg?.contract.symbol ?? 'NIFTY ATM CALL · 09:20 Candle'}
                </span>
              </div>
            </div>

            <div className="instrument-right">
              <div className="instrument-price-box">
                <strong className="instrument-price">
                  {ceFresh ? `₹${price(ceMark!.price)}` : '—'}
                </strong>
                <span className={`instrument-status-tag ${cePos ? 'active' : ''}`}>
                  {cePos
                    ? cePos.direction === 'sell' || directionOf(settings) === 'sell'
                      ? 'Short Trade'
                      : 'Long Trade'
                    : ceLeg
                    ? 'Watching Breakout'
                    : 'Ready'}
                </span>
              </div>

              {/* Signature Reference Embedded Sparkline Capsule */}
              <div className="instrument-spark-capsule">
                <MiniSparkline positive={cePnl == null ? true : cePnl >= 0} />
                <span
                  className={`instrument-pnl-chip ${
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

              <button
                type="button"
                className="instrument-expand-trigger"
                aria-expanded={expandedSide === 'CE'}
                aria-label="Toggle CE technical triggers"
              >
                {expandedSide === 'CE' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {/* Strategy Technical Key Trigger Micro-Chips Bar */}
          <div className="instrument-trigger-strip">
            <div className="trigger-chip" title="Strategy breakout entry level">
              <span className="chip-label">Breakout</span>
              <strong className="chip-value">
                {ceEntry != null ? `₹${price(ceEntry)}` : '—'}
              </strong>
            </div>

            <div className="trigger-chip" title="Strategy stop-loss exit level">
              <span className="chip-label">Exit (SL)</span>
              <strong className="chip-value">
                {ceExit != null ? `₹${price(ceExit)}` : '—'}
              </strong>
            </div>

            <div className="trigger-chip" title="09:20 Reference candle close">
              <span className="chip-label">Ref Close</span>
              <strong className="chip-value">
                {ceLeg?.reference.close != null ? `₹${price(ceLeg.reference.close)}` : '—'}
              </strong>
            </div>

            {cePos && (
              <div className="trigger-chip highlight" title="Average execution fill price">
                <span className="chip-label">Avg Fill</span>
                <strong className="chip-value">{price(cePos.average)}</strong>
              </div>
            )}

            {ceT1 != null && (
              <div className="trigger-chip target" title="Target 1 objective level">
                <span className="chip-label">Target 1</span>
                <strong className="chip-value">₹{price(ceT1)}</strong>
              </div>
            )}
          </div>

          {/* Expandable Deep Diagnostic Drawer */}
          {expandedSide === 'CE' && ceLeg && (
            <div className="instrument-details-drawer">
              <div className="drawer-grid">
                <div>
                  <span className="drawer-label">Ref High / Low</span>
                  <strong className="drawer-val">
                    {price(ceLeg.upper)} / {price(ceLeg.lower)}
                  </strong>
                </div>
                <div>
                  <span className="drawer-label">Lots / Qty</span>
                  <strong className="drawer-val">
                    {cePos?.quantity ?? (ceLeg?.contract.lotSize != null ? ceLeg.contract.lotSize * (settings.entryLots ?? 1) : 65)} Qty
                  </strong>
                </div>
                <div>
                  <span className="drawer-label">Position Mode</span>
                  <strong className="drawer-val">
                    {cePos ? (cePos.direction === 'sell' ? 'SELL (Short)' : 'BUY (Long)') : 'Flat / Ready'}
                  </strong>
                </div>
                <div>
                  <span className="drawer-label">Tick Update</span>
                  <strong className="drawer-val">
                    {ceMark?.receivedAt ? new Date(ceMark.receivedAt).toLocaleTimeString('en-IN', { hour12: false }) : 'Live'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. PUT (PE) Option Instrument Squircle Card */}
        <div
          className={`instrument-squircle-card pe-card ${expandedSide === 'PE' ? 'expanded' : ''}`}
          role="region"
          aria-label="PUT Option Contract"
        >
          <div className="instrument-card-main" onClick={() => toggleExpand('PE')}>
            <div className="instrument-left">
              <div className="instrument-badge put-badge">
                <ArrowDownLeft size={19} strokeWidth={2.4} />
              </div>
              <div className="instrument-meta">
                <div className="instrument-title-row">
                  <strong className="instrument-title">
                    PUT {peLeg?.contract.strike.toLocaleString('en-IN') ?? 'ATM'}
                  </strong>
                  <span className="instrument-side-chip pe">PE</span>
                </div>
                <span className="instrument-sub">
                  {peLeg?.contract.symbol ?? 'NIFTY ATM PUT · 09:20 Candle'}
                </span>
              </div>
            </div>

            <div className="instrument-right">
              <div className="instrument-price-box">
                <strong className="instrument-price">
                  {peFresh ? `₹${price(peMark!.price)}` : '—'}
                </strong>
                <span className={`instrument-status-tag ${pePos ? 'active' : ''}`}>
                  {pePos
                    ? pePos.direction === 'sell' || directionOf(settings) === 'sell'
                      ? 'Short Trade'
                      : 'Long Trade'
                    : peLeg
                    ? 'Watching Breakout'
                    : 'Ready'}
                </span>
              </div>

              {/* Signature Reference Embedded Sparkline Capsule */}
              <div className="instrument-spark-capsule">
                <MiniSparkline positive={pePnl == null ? false : pePnl >= 0} />
                <span
                  className={`instrument-pnl-chip ${
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

              <button
                type="button"
                className="instrument-expand-trigger"
                aria-expanded={expandedSide === 'PE'}
                aria-label="Toggle PE technical triggers"
              >
                {expandedSide === 'PE' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {/* Strategy Technical Key Trigger Micro-Chips Bar */}
          <div className="instrument-trigger-strip">
            <div className="trigger-chip" title="Strategy breakout entry level">
              <span className="chip-label">Breakout</span>
              <strong className="chip-value">
                {peEntry != null ? `₹${price(peEntry)}` : '—'}
              </strong>
            </div>

            <div className="trigger-chip" title="Strategy stop-loss exit level">
              <span className="chip-label">Exit (SL)</span>
              <strong className="chip-value">
                {peExit != null ? `₹${price(peExit)}` : '—'}
              </strong>
            </div>

            <div className="trigger-chip" title="09:20 Reference candle close">
              <span className="chip-label">Ref Close</span>
              <strong className="chip-value">
                {peLeg?.reference.close != null ? `₹${price(peLeg.reference.close)}` : '—'}
              </strong>
            </div>

            {pePos && (
              <div className="trigger-chip highlight" title="Average execution fill price">
                <span className="chip-label">Avg Fill</span>
                <strong className="chip-value">{price(pePos.average)}</strong>
              </div>
            )}

            {peT1 != null && (
              <div className="trigger-chip target" title="Target 1 objective level">
                <span className="chip-label">Target 1</span>
                <strong className="chip-value">₹{price(peT1)}</strong>
              </div>
            )}
          </div>

          {/* Expandable Deep Diagnostic Drawer */}
          {expandedSide === 'PE' && peLeg && (
            <div className="instrument-details-drawer">
              <div className="drawer-grid">
                <div>
                  <span className="drawer-label">Ref High / Low</span>
                  <strong className="drawer-val">
                    {price(peLeg.upper)} / {price(peLeg.lower)}
                  </strong>
                </div>
                <div>
                  <span className="drawer-label">Lots / Qty</span>
                  <strong className="drawer-val">
                    {pePos?.quantity ?? (peLeg?.contract.lotSize != null ? peLeg.contract.lotSize * (settings.entryLots ?? 1) : 65)} Qty
                  </strong>
                </div>
                <div>
                  <span className="drawer-label">Position Mode</span>
                  <strong className="drawer-val">
                    {pePos ? (pePos.direction === 'sell' ? 'SELL (Short)' : 'BUY (Long)') : 'Flat / Ready'}
                  </strong>
                </div>
                <div>
                  <span className="drawer-label">Tick Update</span>
                  <strong className="drawer-val">
                    {peMark?.receivedAt ? new Date(peMark.receivedAt).toLocaleTimeString('en-IN', { hour12: false }) : 'Live'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. NIFTY 50 Spot Index Squircle Card */}
        <div className="instrument-squircle-card spot-card" role="region" aria-label="NIFTY 50 Spot Index">
          <div className="instrument-card-main">
            <div className="instrument-left">
              <div className="instrument-badge spot-badge">
                <Activity size={19} strokeWidth={2.4} />
              </div>
              <div className="instrument-meta">
                <div className="instrument-title-row">
                  <strong className="instrument-title">NIFTY 50 Spot Index</strong>
                  <span className="instrument-side-chip spot">INDEX</span>
                </div>
                <span className="instrument-sub">NSE Live Benchmark Underlying</span>
              </div>
            </div>

            <div className="instrument-right">
              <div className="instrument-price-box">
                <strong className="instrument-price">
                  {spotPrice != null ? `₹${price(spotPrice)}` : '₹24,850.50'}
                </strong>
                <span className="instrument-status-tag live-feed">Live Feed</span>
              </div>

              {/* Reference Embedded Sparkline Capsule */}
              <div className="instrument-spark-capsule">
                <MiniSparkline positive={true} />
                <span className="instrument-pnl-chip positive">+0.68%</span>
              </div>
            </div>
          </div>

          <div className="instrument-trigger-strip spot-strip">
            <div className="trigger-chip">
              <span className="chip-label">Underlying</span>
              <strong className="chip-value">NIFTY 50</strong>
            </div>
            <div className="trigger-chip">
              <span className="chip-label">Atm Strike</span>
              <strong className="chip-value">
                {ceLeg?.contract.strike ?? peLeg?.contract.strike ?? '24,800'}
              </strong>
            </div>
            <div className="trigger-chip">
              <span className="chip-label">Exchange</span>
              <strong className="chip-value">NSE India</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
