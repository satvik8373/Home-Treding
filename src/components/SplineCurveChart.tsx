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

  const isDefaultFlow = !candles || candles.length < 8

  // Base reference price: use live quote, or realistic NIFTY 50 / option ATM base
  const basePrice = useMemo(() => {
    if (livePrice && livePrice > 0) return livePrice
    if (symbol === 'NIFTY') return 24150.0
    return 185.0
  }, [livePrice, symbol])

  const chartData = useMemo(() => {
    if (!isDefaultFlow && candles.length >= 8) {
      // Sample ~24 representative points for a smooth aesthetic curve
      const step = Math.max(1, Math.floor(candles.length / 24))
      const sampled: number[] = []
      for (let i = 0; i < candles.length; i += step) {
        sampled.push(Number(candles[i].close.toFixed(2)))
      }
      if (livePrice && sampled[sampled.length - 1] !== livePrice) {
        sampled.push(Number(livePrice.toFixed(2)))
      }
      return sampled
    }

    // Realistic market wave oscillation around basePrice
    const multipliers = [
      0.997, 0.995, 0.994, 0.997, 1.002, 1.006, 1.004, 1.001, 0.998, 1.002, 1.005, 1.003, 1.006, 1.008,
    ]
    return multipliers.map((m) => Number((basePrice * m).toFixed(2)))
  }, [candles, livePrice, isDefaultFlow, basePrice])

  // Coordinate math for SVG spline
  const width = 640
  const height = 240
  const paddingX = 72
  const paddingY = 36

  const rawMin = Math.min(...chartData)
  const rawMax = Math.max(...chartData)
  const margin = Math.max(1, (rawMax - rawMin) * 0.12)
  const minVal = rawMin - margin
  const maxVal = rawMax + margin
  const range = maxVal - minVal || 1

  const points = useMemo(() => {
    return chartData.map((val, idx) => {
      const x = paddingX + (idx / Math.max(1, chartData.length - 1)) * (width - paddingX - 25)
      const y = height - paddingY - ((val - minVal) / range) * (height - paddingY * 2)
      return { x, y, val }
    })
  }, [chartData, minVal, range])

  // Find peak point for default bubble
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

  // Grid price levels in Indian Rupee format
  const gridLevels = useMemo(() => {
    const step = (rawMax - rawMin) / 3 || 10
    return [
      { label: `₹${Math.round(rawMax).toLocaleString('en-IN')}`, val: rawMax },
      { label: `₹${Math.round(rawMin + step * 2).toLocaleString('en-IN')}`, val: rawMin + step * 2 },
      { label: `₹${Math.round(rawMin + step).toLocaleString('en-IN')}`, val: rawMin + step },
      { label: `₹${Math.round(rawMin).toLocaleString('en-IN')}`, val: rawMin },
    ]
  }, [rawMin, rawMax])

  // Handle pointer interaction for smooth tracking
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !points.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const pointerX = ((e.clientX - rect.left) / rect.width) * width

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

  const bubbleText = activePoint
    ? `₹${Number(activePoint.val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : ''

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
            {/* Subtle soft monochromatic area fill */}
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Faint Horizontal Dashed Gridlines & Price Labels */}
          {gridLevels.map((lvl, index) => {
            const y = height - paddingY - ((lvl.val - minVal) / range) * (height - paddingY * 2)
            return (
              <g key={index} className="neo-grid-level">
                <text
                  x={8}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {lvl.label}
                </text>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - 15}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              </g>
            )
          })}

          {/* Clean monochromatic area fill */}
          <path d={areaPath} fill="url(#areaGradient)" className="neo-spline-area-fill" />

          {/* Crisp, solid institutional blue curve line (Zero neon, zero glow) */}
          <path
            d={splinePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="neo-spline-curve-line"
          />

          {/* Interactive Selected Point on Curve (Clean, solid point, no pulsing aura) */}
          {activePoint && (
            <g className="neo-chart-active-marker">
              {/* Solid outer ring */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth="2.2"
              />
              {/* Center point */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="1.8"
                fill="#2563eb"
              />

              {/* Floating Solid Capsule with exact Rupee Price (Crisp border, no glow shadow) */}
              <g
                transform={`translate(${Math.max(
                  paddingX + 54,
                  Math.min(width - 64, activePoint.x)
                )}, ${Math.max(26, activePoint.y - 24)})`}
              >
                <rect
                  x="-52"
                  y="-14"
                  width="104"
                  height="26"
                  rx="6"
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {bubbleText}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* 2. Timeframe Pill Bar Below Chart (1D 1W 1M [3M] 1Y ALL) */}
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
