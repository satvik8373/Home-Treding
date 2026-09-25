import React from 'react';
import {
  Box,
  Typography,
  Paper
} from '@mui/material';

interface BacktestSummaryProps {
  summary: {
    tradingDays: number;
    winDays: number;
    winDaysPercent: number;
    lossDays: number;
    lossDaysPercent: number;
    totalTrades: number;
    winTrades: number;
    winTradesPercent: number;
    lossTrades: number;
    lossTradesPercent: number;
    winStreak: number;
    lossStreak: number;
    maxProfit: number;
    maxLoss: number;
    avgProfitPerDay: number;
    avgLossPerDay: number;
    maxDrawdownFromPeak: number;
    ceTrades?: number;
    peTrades?: number;
    target1Hits?: number;
    target2Hits?: number;
    lowerLevelExits?: number;
    forceExits?: number;
    avgWin?: number;
    avgLoss?: number;
    maxConsecutiveLosses?: number;
  };
}

export const BacktestSummaryCards: React.FC<BacktestSummaryProps> = ({ summary }) => {
  const formatK = (num: number) => {
    const abs = Math.abs(num);
    if (abs >= 1000) {
      return `${(abs / 1000).toFixed(2)}K`;
    }
    return abs.toFixed(0);
  };

  const hasStrategyBreakdown = summary.ceTrades !== undefined || summary.target1Hits !== undefined;

  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          color: '#0f172a',
          fontSize: '1.25rem',
          letterSpacing: '-0.01em',
          mb: 2
        }}
      >
        Backtest Summary
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          mb: hasStrategyBreakdown ? 2 : 0
        }}
      >
        {/* CARD 1: TRADING DAYS */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
              Trading Days
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
              {summary.tradingDays}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Win Days
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.875rem' }}>
                {summary.winDaysPercent}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {summary.winDays} vs {summary.tradingDays}
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Loss Days
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.875rem' }}>
                {summary.lossDaysPercent}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {summary.lossDays} vs {summary.tradingDays}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* CARD 2: TOTAL TRADES */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
              Total Trades
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
              {summary.totalTrades}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Win Trades
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.875rem' }}>
                {summary.winTradesPercent}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {summary.winTrades} vs {summary.totalTrades}
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Loss Trades
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.875rem' }}>
                {summary.lossTradesPercent}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {summary.lossTrades} vs {summary.totalTrades}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* CARD 3: STREAK & MAX P&L */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
              Streak
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.85rem' }}>
                Win {summary.winStreak}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem' }}>
                Loss {summary.lossStreak}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Max Profit
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.85rem' }}>
                ₹ {summary.maxProfit.toLocaleString('en-IN')}
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Max Loss
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem' }}>
                ₹ {summary.maxLoss.toLocaleString('en-IN')}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* CARD 4: AVERAGE PER DAY & CIRCULAR DRAWDOWN BADGE */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, mb: 1 }}>
              Average Per Day
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.85rem', mb: 0.5 }}>
              Profit {summary.avgProfitPerDay.toFixed(2)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem', mb: 1 }}>
              Loss {summary.avgLossPerDay.toFixed(2)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
              Max Drawdown
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
              From Peak
            </Typography>
          </Box>

          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#ffffff',
              ml: 1.5
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: 800,
                color: '#ef4444',
                fontSize: '0.95rem',
                letterSpacing: '-0.02em'
              }}
            >
              {formatK(summary.maxDrawdownFromPeak ?? (summary as any).maxDrawdown ?? 0)}
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* INSTITUTIONAL BREAKDOWN ROW (CE/PE Splits, Targets & Exit Reasons) */}
      {hasStrategyBreakdown && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2
          }}
        >
          {/* LEG DISTRIBUTION */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Leg Distribution
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>CE Trades</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#0f172a' }}>{summary.ceTrades ?? '—'}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>PE Trades</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#0f172a' }}>{summary.peTrades ?? '—'}</Typography>
              </Box>
            </Box>
          </Paper>

          {/* TARGET COMPLETION */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Targets Reached
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Target 1 (+₹20)</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#16a34a' }}>{summary.target1Hits ?? 0} hits</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Target 2 (+₹40)</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#16a34a' }}>{summary.target2Hits ?? 0} hits</Typography>
              </Box>
            </Box>
          </Paper>

          {/* STOP & FORCE EXITS */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Risk & Cutoff Exits
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Lower-Level Exits</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#dc2626' }}>{summary.lowerLevelExits ?? 0}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>15:10 Force Exits</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#475569' }}>{summary.forceExits ?? 0}</Typography>
              </Box>
            </Box>
          </Paper>

          {/* AVERAGE TRADE P&L */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Average Trade P&L
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Avg Win</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#16a34a' }}>
                  {summary.avgWin !== undefined ? `₹${summary.avgWin.toLocaleString('en-IN')}` : '—'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Avg Loss</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#dc2626' }}>
                  {summary.avgLoss !== undefined ? `₹${summary.avgLoss.toLocaleString('en-IN')}` : '—'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};
