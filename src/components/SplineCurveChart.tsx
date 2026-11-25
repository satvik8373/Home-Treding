import { useState, useMemo, useRef } from 'react'
import type { Candle } from '../../shared/model'

interface SplineCurveChartProps {
  candles?: Candle[]
  livePrice?: number | null
  symbol?: string
  percentChange?: number | null
  timeframe?: string
  onTimeframeChange?: (tf: string) => void
}

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

export function SplineCurveChart({
  candles = [],
  livePrice,
  symbol = 'NIFTY',
  percentChange,
  timeframe: controlledTimeframe,
  onTimeframeChange,
}: SplineCurveChartProps) {
  const [internalTimeframe, setInternalTimeframe] = useState('3M')
  const activeTimeframe = controlledTimeframe || internalTimeframe
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const handleTimeframe = (tf: string) => {
    setInternalTimeframe(tf)
    onTimeframeChange?.(tf)
  }

  // Generate or sample smooth points (matching the aesthetic of Image 1)
  const isDefaultFlow = !candles || candles.length < 8

  const chartData = useMemo(() => {
    if (!isDefaultFlow && candles.length >= 8) {
      // Sample ~24 representative points for a smooth aesthetic curve
      const step = Math.max(1, Math.floor(candles.length / 24))
      const sampled = []
      for (let i = 0; i < candles.length; i += step) {
        sampled.push(candles[i].close)
      }
      if (livePrice && sampled[sampled.length - 1] !== livePrice) {
        sampled.push(livePrice)
      }
      return sampled
    }

    // Exact curve data from Image 1:
    // Starts at $3000, dips slightly, rises to peak at $7320.36, drops softly, then curves up
    return [
      3000, 2900, 2800, 3300, 4900, 7320.36, 6100, 4800, 4600, 5400, 5600, 5400, 5900, 6300,
    ]
  }, [candles, livePrice, isDefaultFlow])

  // Coordinate math for SVG spline
  const width = 640
  const height = 240
  const paddingX = 65
  const paddingY = 40

  const minVal = isDefaultFlow ? 0 : Math.min(...chartData) * 0.92
  const maxVal = isDefaultFlow ? 9500 : Math.max(...chartData) * 1.08
  const range = maxVal - minVal || 1

  const points = useMemo(() => {
    return chartData.map((val, idx) => {
      const x = paddingX + (idx / (chartData.length - 1)) * (width - paddingX - 25)
      const y = height - paddingY - ((val - minVal) / range) * (height - paddingY * 2)
      return { x, y, val }
    })
  }, [chartData, minVal, range])

  // Find peak point for the default bubble (e.g. $7320.36 in Image 1)
  const peakIndex = useMemo(() => {
    let maxIdx = 0
    chartData.forEach((v, idx) => {
      if (v > chartData[maxIdx]) maxIdx = idx
    })
    return maxIdx
  }, [chartData])

  const selectedIndex = hoverIndex !== null ? hoverIndex : peakIndex
  const activePoint = points[selectedIndex] || points[peakIndex] || points[0]

  // Construct smooth cubic bezier SVG path
  const splinePath = useMemo(() => {
    if (!points.length) return ''
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] || p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }
    return d
  }, [points])

  // Area path for gradient fill
  const areaPath = useMemo(() => {
    if (!points.length || !splinePath) return ''
    const first = points[0]
    const last = points[points.length - 1]
    const bottom = height - paddingY + 10
    return `${splinePath} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`
  }, [splinePath, points])

  // Grid price levels (exact Image 1: $9000, $6000, $3000, $00)
  const gridLevels = useMemo(() => {
    if (isDefaultFlow) {
      return [
        { label: '$9000', val: 9000 },
        { label: '$6000', val: 6000 },
        { label: '$3000', val: 3000 },
        { label: '$00', val: 500 },
      ]
    }
    const step = range / 3
    return [
      { label: `₹${Math.round(maxVal).toLocaleString('en-IN')}`, val: maxVal },
      { label: `₹${Math.round(minVal + step * 2).toLocaleString('en-IN')}`, val: minVal + step * 2 },
      { label: `₹${Math.round(minVal + step).toLocaleString('en-IN')}`, val: minVal + step },
      { label: `₹${Math.max(0, Math.round(minVal)).toLocaleString('en-IN')}`, val: minVal },
    ]
  }, [isDefaultFlow, minVal, maxVal, range])

  // Handle pointer interaction for smooth tracking
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !points.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const pointerX = ((e.clientX - rect.left) / rect.width) * width

    // Find nearest point
    let closestIdx = 0
    let closestDist = Infinity
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - pointerX)
      if (dist < closestDist) {
        closestDist = dist
        closestIdx = idx
      }
    })
    setHoverIndex(closestIdx)
  }

  const handlePointerLeave = () => {
    setHoverIndex(null)
  }

  return (
    <div className="neo-spline-card">
      {/* 1. Spline Curve SVG Canvas */}
      <div className="neo-spline-svg-wrapper">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="neo-spline-svg"
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Dual tone curve stroke gradient: sky blue -> lavender/pink (exact Image 1) */}
            <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
              <stop offset="65%" stopColor="#93c5fd" stopOpacity="1" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
            </linearGradient>

            {/* Soft area background fill */}
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.16" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Bubble Drop Shadow Filter */}
            <filter id="bubbleShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Faint Horizontal Dashed Gridlines & Price Labels (Exact Image 1) */}
          {gridLevels.map((lvl, index) => {
            const y = height - paddingY - ((lvl.val - minVal) / range) * (height - paddingY * 2)
            return (
              <g key={index} className="neo-grid-level">
                <text
                  x={12}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="500"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                >
                  {lvl.label}
                </text>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - 15}
                  y2={y}
                  stroke="#edf2f7"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              </g>
            )
          })}

          {/* Area Fill Under Spline (with living shimmer fill animation) */}
          <path d={areaPath} fill="url(#areaGradient)" className="neo-spline-area-fill" />

          {/* Smooth Dual-Tone Spline Stroke */}
          <path
            d={splinePath}
            fill="none"
            stroke="url(#curveGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="neo-spline-curve-line"
          />

          {/* Interactive Selected Point on Curve (Dark Dot in Image 1) */}
          {activePoint && (
            <g className="neo-chart-active-marker">
              {/* Pulsing subtle aura ring */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="10"
                fill="#0f172a"
                fillOpacity="0.12"
              />
              {/* Outer border */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5.5"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="2.5"
              />
              {/* Center dark dot */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3"
                fill="#0f172a"
              />

              {/* Exact Floating White Capsule Bubble (Image 1: $7320.36) */}
              <g
                transform={`translate(${Math.max(
                  paddingX + 45,
                  Math.min(width - 55, activePoint.x)
                )}, ${Math.max(26, activePoint.y - 24)})`}
              >
                {/* Capsule background with drop shadow */}
                <rect
                  x="-42"
                  y="-16"
                  width="84"
                  height="26"
                  rx="13"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="0.8"
                  filter="url(#bubbleShadow)"
                />
                {/* Price text inside bubble */}
                <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="11.5"
                  fontWeight="700"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                >
                  ${activePoint.val.toFixed(2)}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* 2. Timeframe Pill Bar Below Chart (Exact Image 1: 1D 1W 1M [3M] 1Y ALL) */}
      <div className="neo-timeframe-bar" role="tablist" aria-label="Chart time intervals">
        {TIMEFRAMES.map((tf) => {
          const isActive = activeTimeframe === tf
          return (
            <button
              key={tf}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`neo-timeframe-pill ${isActive ? 'active' : ''}`}
              onClick={() => handleTimeframe(tf)}
            >
              {tf}
            </button>
          )
        })}
      </div>
    </div>
  )
}
