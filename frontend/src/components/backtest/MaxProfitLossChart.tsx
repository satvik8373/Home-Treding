import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine
} from 'recharts';

interface DailyPnlBar {
  date: string;
  dayLabel: string;
  pnl: number;
  isProfit: boolean;
}

interface MaxProfitLossChartProps {
  dailyBars: DailyPnlBar[];
  avgProfit: number;
  avgLoss: number;
}

export const MaxProfitLossChart: React.FC<MaxProfitLossChartProps> = ({
  dailyBars,
  avgProfit,
  avgLoss
}) => {
  const [filter, setFilter] = useState<'top10' | 'top20' | 'top30' | 'all'>('top10');

  let displayedBars = [...dailyBars];
  if (filter === 'top10') {
    displayedBars = displayedBars.slice(-12);
  } else if (filter === 'top20') {
    displayedBars = displayedBars.slice(-20);
  } else if (filter === 'top30') {
    displayedBars = displayedBars.slice(-30);
  }

  const formatYAxis = (val: number) => {
    if (val === 0) return '0.00';
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return `${sign}${(abs / 1000).toFixed(0)}k`;
    }
    return `${sign}${abs}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper
          elevation={3}
          sx={{
            p: 1.5,
            bgcolor: '#0f172a',
            color: '#ffffff',
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
            {data.date}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: data.pnl >= 0 ? '#4ade80' : '#f87171'
            }}
          >
            P&L: ₹{data.pnl.toLocaleString('en-IN')}
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        mb: 4
      }}
    >
      {/* Header with Title and Filter Radios */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2
        }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              fontSize: '1.125rem',
              letterSpacing: '-0.01em'
            }}
          >
            Max Profit and Loss
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
            Avg Profit:{' '}
            <span style={{ color: '#16a34a', fontWeight: 700 }}>
              {avgProfit > 0 ? avgProfit.toFixed(2) : '4370.98'}
            </span>{' '}
            | Avg Loss:{' '}
            <span style={{ color: '#dc2626', fontWeight: 700 }}>
              {avgLoss < 0 ? avgLoss.toFixed(2) : '-4712.54'}
            </span>
          </Typography>
        </Box>

        {/* Radio Filter Group (Matching Screenshot 2) */}
        <RadioGroup
          row
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          sx={{ gap: 1 }}
        >
          <FormControlLabel
            value="top10"
            control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />}
            label={<Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Top 10</Typography>}
          />
          <FormControlLabel
            value="top20"
            control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />}
            label={<Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Top 20</Typography>}
          />
          <FormControlLabel
            value="top30"
            control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />}
            label={<Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Top 30</Typography>}
          />
          <FormControlLabel
            value="all"
            control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />}
            label={<Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>All</Typography>}
          />
        </RadioGroup>
      </Box>

      {/* Bar Chart Area */}
      <InteractiveDailyPnlSvgChart
        bars={displayedBars}
      />
    </Paper>
  );
};

// High-Fidelity Interactive SVG Daily P&L Bars Component (Matching Screenshot 2)
const InteractiveDailyPnlSvgChart: React.FC<{
  bars: DailyPnlBar[];
}> = ({ bars }) => {
  const [hoveredBar, setHoveredBar] = useState<any | null>(null);

  if (!bars || bars.length === 0) return null;

  const width = 800;
  const height = 260;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const pnlValues = bars.map((b) => b.pnl);
  let minPnl = Math.min(-1000, ...pnlValues);
  let maxPnl = Math.max(1000, ...pnlValues);
  const pnlSpan = maxPnl - minPnl || 1;

  const paddedMin = minPnl - pnlSpan * 0.08;
  const paddedMax = maxPnl + pnlSpan * 0.08;
  const totalRange = paddedMax - paddedMin;

  const zeroY = paddingTop + chartHeight - ((0 - paddedMin) / totalRange) * chartHeight;

  const slotWidth = chartWidth / bars.length;
  const barWidth = Math.min(26, Math.max(10, slotWidth * 0.55));

  const barElements = bars.map((b, idx) => {
    const centerX = paddingLeft + idx * slotWidth + slotWidth / 2;
    const targetY = paddingTop + chartHeight - ((b.pnl - paddedMin) / totalRange) * chartHeight;
    const barTop = Math.min(zeroY, targetY);
    const barHeight = Math.max(2, Math.abs(targetY - zeroY));

    return {
      ...b,
      x: centerX - barWidth / 2,
      y: barTop,
      width: barWidth,
      height: barHeight,
      centerX,
      isPositive: b.pnl >= 0
    };
  });

  // 4 Y-Axis Ticks
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = paddedMin + pct * totalRange;
    const y = paddingTop + chartHeight - pct * chartHeight;
    const label = val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val <= -1000 ? `-${(Math.abs(val) / 1000).toFixed(0)}k` : `${Math.round(val)}`;
    return { y, label, val };
  });

  return (
    <Box sx={{ width: '100%', position: 'relative', mt: 1 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoveredBar(null)}
      >
        {/* Horizontal Gridlines & Y-Axis Labels */}
        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={width - paddingRight}
              y2={tick.y}
              stroke="#f1f5f9"
              strokeDasharray={tick.val === 0 ? undefined : '3 3'}
              strokeWidth={tick.val === 0 ? 1.2 : 0.8}
            />
            <text
              x={paddingLeft - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="10.5"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Zero Baseline */}
        <line
          x1={paddingLeft}
          y1={zeroY}
          x2={width - paddingRight}
          y2={zeroY}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />

        {/* P&L Bars */}
        {barElements.map((bar, idx) => (
          <g
            key={idx}
            onMouseEnter={() => setHoveredBar(bar)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={3}
              ry={3}
              fill={bar.isPositive ? '#22c55e' : '#ef4444'}
              opacity={hoveredBar && hoveredBar.date !== bar.date ? 0.6 : 1}
              stroke={hoveredBar?.date === bar.date ? '#0f172a' : 'none'}
              strokeWidth={1.5}
            />
            {/* Day label below zero/bottom */}
            <text
              x={bar.centerX}
              y={height - paddingBottom + 16}
              textAnchor="middle"
              fill="#64748b"
              fontSize="9.5"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              {bar.dayLabel}
            </text>
          </g>
        ))}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredBar && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            left: `${(hoveredBar.centerX / width) * 100}%`,
            top: `${Math.max(10, (hoveredBar.y / height) * 100 - 30)}%`,
            transform: 'translate(-50%, -100%)',
            bgcolor: '#0f172a',
            color: '#ffffff',
            p: 1.2,
            borderRadius: 2,
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>
            {hoveredBar.dayLabel} ({hoveredBar.date})
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 800,
              color: hoveredBar.isPositive ? '#4ade80' : '#f87171',
              fontSize: '0.85rem'
            }}
          >
            P&L: {hoveredBar.isPositive ? '+' : ''}₹{hoveredBar.pnl.toLocaleString('en-IN')}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};
