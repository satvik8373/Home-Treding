import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  Search,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import type { Leg, Mark } from '../../shared/model'
import { price } from '../lib/format'

interface ExplorePanelProps {
  onBack: () => void
  marks?: Record<string, Mark>
  legs?: Partial<Record<'CE' | 'PE', Leg>>
}

// Sparkline SVG generator for stock cards
function MiniSparkline({
  positive = true,
  dark = false,
}: {
  positive?: boolean
  dark?: boolean
}) {
  const strokeColor = positive ? '#10b981' : '#f43f5e'
  const pathData = positive
    ? 'M 2 18 C 10 22, 18 10, 26 12 C 34 14, 42 4, 52 8 C 60 11, 68 2, 78 4'
    : 'M 2 6 C 10 4, 18 14, 26 10 C 34 8, 42 20, 52 16 C 60 14, 68 22, 78 20'

  return (
    <svg width="72" height="24" viewBox="0 0 80 24" fill="none" className="mini-sparkline-svg">
      <path
        d={pathData}
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="78"
        cy={positive ? 4 : 20}
        r="3"
        fill={strokeColor}
      />
    </svg>
  )
}

export function ExplorePanel({ onBack, marks = {}, legs = {} }: ExplorePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'crypto' | 'stocks' | 'algo'>('all')

  const spotPrice = marks['26000']?.price ?? 24850.5
  const ceStrike = legs.CE?.contract.strike ?? 24900
  const peStrike = legs.PE?.contract.strike ?? 24800
  const ceMark = legs.CE ? marks[legs.CE.contract.token] : undefined
  const peMark = legs.PE ? marks[legs.PE.contract.token] : undefined

  // Crypto list matching Image 2 "Most popular Crypto"
  const cryptoItems = [
    {
      id: 'btc',
      symbol: '₿',
      name: 'Bitcoin',
      change: '-3.34%',
      positive: false,
      theme: 'pastel-blue', // Image 2 pastel blue card
      type: 'crypto',
    },
    {
      id: 'sol',
      symbol: '◎',
      name: 'Solana',
      change: '-1.15%',
      positive: false,
      theme: 'dark-navy', // Image 2 midnight dark card
      type: 'crypto',
    },
    {
      id: 'eth',
      symbol: 'Ξ',
      name: 'Binance / ETH',
      change: '-1.85%',
      positive: false,
      theme: 'pastel-peach', // Image 2 peach card
      type: 'crypto',
    },
    {
      id: 'nifty',
      symbol: 'N50',
      name: 'NIFTY 50',
      change: '+0.68%',
      positive: true,
      theme: 'pastel-mint',
      type: 'algo',
    },
  ]

  // Stocks & Strategy Instruments matching Image 2 "Stock list"
  const stockItems = [
    {
      id: 'aapl',
      name: 'Apple',
      price: '$4,435.96',
      change: '5,2%',
      positive: true,
      dark: true, // Image 2 Dark card for Apple
      type: 'stocks',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.92.04-2.02.62-2.66 1.37-.56.65-1.06 1.71-0.93 2.74 1.04.08 2.06-.51 2.67-1.26z" />
        </svg>
      ),
    },
    {
      id: 'twtr',
      name: 'Twitter',
      price: '$4,435.96',
      change: '4,6%',
      positive: true,
      dark: false, // Image 2 Light card for Twitter
      type: 'stocks',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.954 4.569c-.885.389-1.83.654-2.825.775 1.014-.611 1.794-1.574 2.163-2.723-.951.555-2.005.959-3.127 1.184-.896-.959-2.173-1.559-3.591-1.559-2.717 0-4.92 2.203-4.92 4.917 0 .39.045.765.127 1.124C7.691 8.094 4.066 6.13 1.64 3.161c-.427.722-.666 1.561-.666 2.475 0 1.71.87 3.213 2.188 4.096-.807-.026-1.566-.248-2.228-.616v.061c0 2.385 1.693 4.374 3.946 4.827-.413.111-.849.171-1.296.171-.314 0-.615-.03-.916-.086.631 1.953 2.445 3.377 4.604 3.417-1.68 1.319-3.809 2.105-6.102 2.105-.39 0-.779-.023-1.17-.067 2.18 1.394 4.768 2.209 7.557 2.209 9.054 0 13.999-7.496 13.999-13.986 0-.209 0-.42-.015-.63.961-.689 1.8-1.56 2.46-2.548l-.047-.02z" />
        </svg>
      ),
    },
    {
      id: 'ce_contract',
      name: `NIFTY CALL ${ceStrike}`,
      price: ceMark?.price ? `₹${price(ceMark.price)}` : '₹124.50',
      change: '8.4%',
      positive: true,
      dark: true,
      type: 'algo',
      icon: <span style={{ fontWeight: 800, fontSize: 13 }}>CE</span>,
    },
    {
      id: 'pe_contract',
      name: `NIFTY PUT ${peStrike}`,
      price: peMark?.price ? `₹${price(peMark.price)}` : '₹98.20',
      change: '3.1%',
      positive: false,
      dark: false,
      type: 'algo',
      icon: <span style={{ fontWeight: 800, fontSize: 13 }}>PE</span>,
    },
  ]

  // Filter items based on user search
  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return stockItems
    const q = searchQuery.toLowerCase()
    return stockItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.price.toLowerCase().includes(q)
    )
  }, [searchQuery, stockItems])

  const filteredCrypto = useMemo(() => {
    if (!searchQuery.trim()) return cryptoItems
    const q = searchQuery.toLowerCase()
    return cryptoItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.symbol.toLowerCase().includes(q)
    )
  }, [searchQuery, cryptoItems])

  return (
    <div className="neo-explore-screen" aria-label="Explore financial assets">
      {/* 1. Header with Circular Back Button and Title (Exact Image 2) */}
      <div className="explore-header-row">
        <button
          type="button"
          className="explore-back-btn"
          onClick={onBack}
          aria-label="Go back to Market overview"
          title="Back to Market"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 className="explore-page-title">Explore</h1>
      </div>

      {/* 2. Full Pill Search Bar (Exact Image 2: Search people, stocks & crypto) */}
      <div className="explore-search-wrap">
        <div className="explore-search-box">
          <Search size={18} className="explore-search-icon" />
          <input
            type="text"
            className="explore-search-input"
            placeholder="Search people, stocks & crypto"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="explore-clear-search"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 3. Section: "Most popular Crypto" (Exact Image 2 Squircle Cards) */}
      <section className="explore-section">
        <div className="explore-section-header">
          <h2 className="explore-section-title">Most popular Crypto</h2>
        </div>

        <div className="crypto-cards-grid">
          {filteredCrypto.map((item) => (
            <div
              key={item.id}
              className={`crypto-squircle-card card-${item.theme}`}
            >
              <div className="crypto-card-top">
                <div className="crypto-icon-badge">
                  <span>{item.symbol}</span>
                </div>
              </div>
              <div className="crypto-card-bottom">
                <strong className="crypto-card-name">{item.name}</strong>
                <span className={`crypto-card-change ${item.positive ? 'positive' : 'negative'}`}>
                  {item.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Section: "Stock list" (Exact Image 2 Apple Dark Card & Twitter Light Card) */}
      <section className="explore-section">
        <div className="explore-section-header">
          <h2 className="explore-section-title">Stock list</h2>
          <button type="button" className="explore-view-all-btn">
            View all
          </button>
        </div>

        <div className="stock-list-column">
          {filteredStocks.map((item) => (
            <div
              key={item.id}
              className={`stock-list-card ${item.dark ? 'dark-card' : 'light-card'}`}
            >
              {/* Left icon badge + name + price */}
              <div className="stock-card-left">
                <div className="stock-logo-circle">
                  {item.icon}
                </div>
                <div className="stock-info-wrap">
                  <strong className="stock-name">{item.name}</strong>
                  <span className="stock-price">{item.price}</span>
                </div>
              </div>

              {/* Right sparkline wave container + percent badge */}
              <div className="stock-card-right">
                <div className="sparkline-container">
                  <MiniSparkline positive={item.positive} dark={item.dark} />
                  <span className="sparkline-percent">{item.change}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Section: "Alternative Assets" (Exact Image 2) */}
      <section className="explore-section">
        <div className="explore-section-header">
          <h2 className="explore-section-title">Alternative Assets</h2>
          <button type="button" className="explore-view-all-btn">
            View all
          </button>
        </div>

        <div className="alternative-assets-grid">
          <div className="alt-asset-tile">
            <div className="alt-asset-badge gold">AU</div>
            <div className="alt-asset-content">
              <strong>Gold / Precious Metals</strong>
              <span>MCX Gold Spot · ₹78,450 / 10g</span>
            </div>
            <span className="alt-asset-trend positive">+1.2%</span>
          </div>

          <div className="alt-asset-tile">
            <div className="alt-asset-badge vix">VIX</div>
            <div className="alt-asset-content">
              <strong>India VIX Volatility</strong>
              <span>Implied Index Volatility · 13.84</span>
            </div>
            <span className="alt-asset-trend negative">-2.4%</span>
          </div>
        </div>
      </section>
    </div>
  )
}
