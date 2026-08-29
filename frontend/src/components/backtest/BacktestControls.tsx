import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  ButtonGroup,
  Chip,
  Menu,
  MenuItem,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  KeyboardArrowDown,
  ArrowBack,
  Download,
  PlayArrow,
  Check
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

interface EquityPoint {
  date: string;
  equity: number;
  pnl: number;
  drawdown: number;
}

interface BacktestControlsProps {
  strategyName: string;
  strategiesList: Array<{ id: string; name: string }>;
  selectedStrategyId: string;
  onSelectStrategy: (id: string) => void;
  selectedRange: string;
  onSelectRange: (range: string, days: number) => void;
  creditsRemaining: number;
  totalCredits: number;
  totalPnl: number | null;
  maxDrawdown: number | null;
  equityCurve: EquityPoint[];
  loading: boolean;
  onRunBacktest: () => void;
  onExportTrades: (format: 'csv' | 'json') => void;
  onBack?: () => void;
}

export const BacktestControls: React.FC<BacktestControlsProps> = ({
  strategyName,
  strategiesList,
  selectedStrategyId,
  onSelectStrategy,
  selectedRange,
  onSelectRange,
  creditsRemaining,
  totalCredits,
  totalPnl,
  maxDrawdown,
  equityCurve,
  loading,
  onRunBacktest,
  onExportTrades,
  onBack
}) => {
  const [downloadAnchor, setDownloadAnchor] = useState<null | HTMLElement>(null);
  const [strategyMenuAnchor, setStrategyMenuAnchor] = useState<null | HTMLElement>(null);

  const ranges = [
    { label: '1 Month', days: 23 },
    { label: '3 Months', days: 65 },
    { label: '6 Months', days: 130 },
    { label: '1 Year', days: 250 },
    { label: '2 Years', days: 500 },
    { label: 'Custom Range', days: 45 }
  ];

  const formatYAxis = (val: number) => {
    if (val === 0) return '0k';
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return `${(abs / 1000).toFixed(0)}k`;
    }
    return `${abs}`;
  };

  const CustomEquityTooltip = ({ active, payload }: any) => {
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
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#38bdf8' }}>
            Equity: ₹{data.equity.toLocaleString('en-IN')}
          </Typography>
          <Typography variant="caption" sx={{ color: data.pnl >= 0 ? '#4ade80' : '#f87171' }}>
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
        p: { xs: 2.5, sm: 3.5 },
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        mb: 4
      }}
    >
      {/* Top Header with Back Arrow and Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        {onBack && (
          <IconButton
            size="small"
            onClick={onBack}
            sx={{
              border: '1px solid #e2e8f0',
              borderRadius: 2,
              p: 0.8,
              '&:hover': { bgcolor: '#f8fafc' }
            }}
          >
            <ArrowBack sx={{ fontSize: 18, color: '#475569' }} />
          </IconButton>
        )}
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              fontSize: '1.2rem',
              letterSpacing: '-0.01em'
            }}
          >
            {strategyName || 'NIFTY 0.09% ATM Full-Day Breakout'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
            Select a time range below and run the backtest.
          </Typography>
        </Box>
      </Box>

      {/* Strategy Selector & Period Buttons Bar (Matching Screenshot 3) */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 1.5
        }}
      >
        {/* Strategy Dropdown Button */}
        <Button
          variant="outlined"
          onClick={(e) => setStrategyMenuAnchor(e.currentTarget)}
          endIcon={<KeyboardArrowDown sx={{ color: '#64748b' }} />}
          sx={{
            color: '#0f172a',
            borderColor: '#e2e8f0',
            bgcolor: '#ffffff',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.875rem',
            borderRadius: 2,
            px: 2,
            py: 0.9,
            minWidth: 260,
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }
          }}
        >
          {strategyName} Selected
        </Button>

        {/* Strategy Selection Menu */}
        <Menu
          anchorEl={strategyMenuAnchor}
          open={Boolean(strategyMenuAnchor)}
          onClose={() => setStrategyMenuAnchor(null)}
          PaperProps={{
            elevation: 3,
            sx: { minWidth: 280, borderRadius: 2, mt: 0.5, border: '1px solid #e2e8f0' }
          }}
        >
          {strategiesList.map((strat) => (
            <MenuItem
              key={strat.id}
              onClick={() => {
                onSelectStrategy(strat.id);
                setStrategyMenuAnchor(null);
              }}
              selected={strat.id === selectedStrategyId}
              sx={{
                fontWeight: strat.id === selectedStrategyId ? 700 : 500,
                fontSize: '0.875rem',
                py: 1
              }}
            >
              {strat.name}
            </MenuItem>
          ))}
        </Menu>

        {/* Range Buttons Segmented Group */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
          {ranges.map((r) => {
            const isSelected = selectedRange === r.label;
            return (
              <Button
                key={r.label}
                variant={isSelected ? 'contained' : 'outlined'}
                size="small"
                onClick={() => onSelectRange(r.label, r.days)}
                sx={{
                  textTransform: 'none',
                  fontWeight: isSelected ? 700 : 600,
                  fontSize: '0.8125rem',
                  borderRadius: 2,
                  px: 1.8,
                  py: 0.7,
                  boxShadow: 'none',
                  bgcolor: isSelected ? '#2563eb' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                  '&:hover': {
                    bgcolor: isSelected ? '#1d4ed8' : '#f8fafc',
                    borderColor: isSelected ? '#1d4ed8' : '#cbd5e1',
                    boxShadow: 'none'
                  }
                }}
              >
                {r.label}
              </Button>
            );
          })}
        </Box>
      </Box>

      {/* Selected Tag Chip */}
      <Box sx={{ mb: 2 }}>
        <Chip
          label={`${strategyName} ×`}
          size="small"
          sx={{
            bgcolor: '#eff6ff',
            color: '#2563eb',
            fontWeight: 700,
            fontSize: '0.75rem',
            border: '1px solid #bfdbfe',
            borderRadius: 1.5,
            cursor: 'pointer'
          }}
        />
      </Box>

      {/* Actions & Credits Row (Matching Screenshot 3) */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          py: 1.5,
          borderTop: '1px solid #f1f5f9',
          borderBottom: '1px solid #f1f5f9',
          mb: 3
        }}
      >
        <Typography variant="body2" sx={{ color: '#334155', fontWeight: 600, fontSize: '0.85rem' }}>
          Backtest Credit:{' '}
          <span style={{ fontWeight: 800, color: '#0f172a' }}>
            {creditsRemaining}/{totalCredits}
          </span>
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {/* Download Trades Dropdown Button */}
          <Button
            variant="outlined"
            size="small"
            endIcon={<KeyboardArrowDown />}
            onClick={(e) => setDownloadAnchor(e.currentTarget)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: '#2563eb',
              borderColor: '#93c5fd',
              borderRadius: 2,
              px: 2,
              '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff' }
            }}
          >
            Download Trades
          </Button>

          <Menu
            anchorEl={downloadAnchor}
            open={Boolean(downloadAnchor)}
            onClose={() => setDownloadAnchor(null)}
          >
            <MenuItem
              onClick={() => {
                onExportTrades('csv');
                setDownloadAnchor(null);
              }}
            >
              Export as CSV
            </MenuItem>
            <MenuItem
              onClick={() => {
                onExportTrades('json');
                setDownloadAnchor(null);
              }}
            >
              Export as JSON
            </MenuItem>
          </Menu>

          {/* Run Backtest Primary Button */}
          <Button
            variant="contained"
            size="small"
            disabled={loading}
            onClick={onRunBacktest}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
            sx={{
              bgcolor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'none',
              borderRadius: 2,
              px: 2.5,
              py: 0.8,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
            }}
          >
            {loading ? 'Simulating Replay...' : 'Run Backtest'}
          </Button>
        </Box>
      </Box>

      {/* P&L and Max Draw Down Stat Badges */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body1" sx={{ fontWeight: 800, color: '#334155', fontSize: '1rem', mb: 0.3 }}>
          P&L:{' '}
          {totalPnl !== null ? (
            <span style={{ color: totalPnl >= 0 ? '#16a34a' : '#dc2626' }}>
              ₹ {totalPnl.toLocaleString('en-IN')}
            </span>
          ) : (
            <span style={{ color: '#94a3b8' }}>—</span>
          )}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 800, color: '#334155', fontSize: '0.9rem' }}>
          Max. Draw down:{' '}
          {maxDrawdown !== null ? (
            <span style={{ color: '#dc2626' }}>
              ₹ -{Math.abs(maxDrawdown).toLocaleString('en-IN')}
            </span>
          ) : (
            <span style={{ color: '#94a3b8' }}>—</span>
          )}
        </Typography>
      </Box>

      {/* Smooth Blue Equity Curve or Clean Empty State */}
      {equityCurve.length === 0 ? (
        <Box
          sx={{
            width: '100%',
            height: 220,
            mt: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#f8fafc',
            borderRadius: 2,
            border: '1px dashed #cbd5e1',
            gap: 1
          }}
        >
          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 700 }}>
            No Backtest Run Yet
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Click <strong>Run Backtest</strong> to simulate strategy and generate the equity trajectory
          </Typography>
        </Box>
      ) : (
        <InteractiveEquitySvgChart
          data={equityCurve.map((item, idx) => {
            const displayPnl = (item as any).cumulativePnl !== undefined
              ? (item as any).cumulativePnl
              : (item.equity >= 50000 ? item.equity - 100000 : item.equity);
            return {
              date: item.date,
              displayPnl: Math.round(displayPnl * 10) / 10,
              pnl: item.pnl,
              equity: item.equity,
              index: idx
            };
          })}
        />
      )}
    </Paper>
  );
};

// High-Fidelity Interactive SVG Equity Curve Component (Matching Screenshot 3)
const InteractiveEquitySvgChart: React.FC<{
  data: Array<{ date: string; displayPnl: number; pnl: number; equity: number; index: number }>;
}> = ({ data }) => {
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  if (!data || data.length === 0) return null;

  const width = 800;
  const height = 260;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const pnlValues = data.map((d) => d.displayPnl);
  let minPnl = Math.min(0, ...pnlValues);
  let maxPnl = Math.max(1000, ...pnlValues);
  const pnlSpan = maxPnl - minPnl || 1;

  // Add 10% vertical padding
  const paddedMin = minPnl - pnlSpan * 0.08;
  const paddedMax = maxPnl + pnlSpan * 0.08;
  const totalRange = paddedMax - paddedMin;

  const coords = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.displayPnl - paddedMin) / totalRange) * chartHeight;
    return { ...d, x, y };
  });

  // Construct smooth bezier path
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 2;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (p1.x - p0.x) / 2;
    const cpY2 = p1.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
  }

  // Area path for gradient fill
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`;

  // Y-axis grid ticks (4 ticks)
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
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <linearGradient id="blueCurveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.01} />
          </linearGradient>
        </defs>

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

        {/* Gradient Filled Area */}
        <path d={areaD} fill="url(#blueCurveGradient)" />

        {/* Smooth Blue Stroke Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#0284c7"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Hover Trigger Zones */}
        {coords.map((pt, idx) => (
          <g
            key={idx}
            onMouseEnter={() => setHoveredPoint(pt)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.index === idx ? 5 : 3.5}
              fill={hoveredPoint?.index === idx ? '#0284c7' : '#38bdf8'}
              stroke="#ffffff"
              strokeWidth={hoveredPoint?.index === idx ? 2 : 1}
            />
            {/* Invisible larger hit circle */}
            <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />
          </g>
        ))}

        {/* Hover Crosshair */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={paddingTop}
            x2={hoveredPoint.x}
            y2={height - paddingBottom}
            stroke="#94a3b8"
            strokeDasharray="2 2"
            strokeWidth="1"
          />
        )}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredPoint && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${Math.max(10, (hoveredPoint.y / height) * 100 - 45)}%`,
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
            Date: {hoveredPoint.date}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.85rem' }}>
            Cumulative P&L: ₹{hoveredPoint.displayPnl.toLocaleString('en-IN')}
          </Typography>
          <Typography variant="caption" sx={{ color: hoveredPoint.pnl >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
            Day P&L: {hoveredPoint.pnl >= 0 ? '+' : ''}₹{hoveredPoint.pnl.toLocaleString('en-IN')}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};
