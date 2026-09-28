import React from 'react';
import {
  Box,
  Typography,
  Paper
} from '@mui/material';

interface BacktestSummaryProps {
  summary: {
    tradingDays?: number;
    winDays?: number;
    winDaysPercent?: number;
    winDaysPct?: number;
    lossDays?: number;
    lossDaysPercent?: number;
    lossDaysPct?: number;
    totalTrades?: number;
    winTrades?: number;
    winningTrades?: number;
    winTradesPercent?: number;
    winRatePct?: number;
    lossTrades?: number;
    losingTrades?: number;
    lossTradesPercent?: number;
    winStreak?: number;
    lossStreak?: number;
    maxProfit?: number;
    maxProfitDay?: number;
    maxLoss?: number;
    maxLossDay?: number;
    avgProfitPerDay?: number;
    avgLossPerDay?: number;
    maxDrawdownFromPeak?: number;
    maxDrawdown?: number;
    maxDrawdownPct?: number;
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
  const safeNumber = (val: unknown, fallback = 0): number => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  };

  const formatK = (num: number) => {
    const abs = Math.abs(num);
    if (abs >= 1000) {
      return `${(abs / 1000).toFixed(2)}K`;
    }
    return abs.toFixed(0);
  };

  const formatInr = (val: unknown) => {
    return safeNumber(val).toLocaleString('en-IN');
  };

  const formatDec = (val: unknown, dec = 2) => {
    return safeNumber(val).toFixed(dec);
  };

  const tradingDays = safeNumber(summary?.tradingDays);
  const winDays = safeNumber(summary?.winDays);
  const winDaysPct = safeNumber(summary?.winDaysPercent ?? summary?.winDaysPct);
  const lossDays = safeNumber(summary?.lossDays);
  const lossDaysPct = safeNumber(summary?.lossDaysPercent ?? summary?.lossDaysPct);

  const totalTrades = safeNumber(summary?.totalTrades);
  const winTrades = safeNumber(summary?.winTrades ?? summary?.winningTrades);
  const winTradesPct = safeNumber(summary?.winTradesPercent ?? summary?.winRatePct);
  const lossTrades = safeNumber(summary?.lossTrades ?? summary?.losingTrades);
  const lossTradesPct = safeNumber(
    summary?.lossTradesPercent ??
    (summary?.winRatePct !== undefined ? 100 - summary.winRatePct : 0)
  );

  const winStreak = safeNumber(summary?.winStreak);
  const lossStreak = safeNumber(summary?.lossStreak);
  const maxProfit = safeNumber(summary?.maxProfit ?? summary?.maxProfitDay);
  const maxLoss = safeNumber(summary?.maxLoss ?? summary?.maxLossDay);

  const avgProfitPerDay = safeNumber(summary?.avgProfitPerDay);
  const avgLossPerDay = safeNumber(summary?.avgLossPerDay);
  const maxDrawdown = safeNumber(summary?.maxDrawdownFromPeak ?? summary?.maxDrawdown);

  const hasStrategyBreakdown = summary?.ceTrades !== undefined || summary?.target1Hits !== undefined;

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
              {tradingDays}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Win Days
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.875rem' }}>
                {winDaysPct}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {winDays} vs {tradingDays}
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Loss Days
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.875rem' }}>
                {lossDaysPct}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {lossDays} vs {tradingDays}
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
              {totalTrades}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Win Trades
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.875rem' }}>
                {winTradesPct}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {winTrades} vs {totalTrades}
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Loss Trades
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.875rem' }}>
                {lossTradesPct}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {lossTrades} vs {totalTrades}
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
                Win {winStreak}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem' }}>
                Loss {lossStreak}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Max Profit
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.85rem' }}>
                ₹ {formatInr(maxProfit)}
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>
                Max Loss
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem' }}>
                ₹ {formatInr(maxLoss)}
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
              Profit {formatDec(avgProfitPerDay)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem', mb: 1 }}>
              Loss {formatDec(avgLossPerDay)}
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
              {formatK(maxDrawdown)}
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
                  {summary.avgWin !== undefined ? `₹${formatInr(summary.avgWin)}` : '—'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Avg Loss</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#dc2626' }}>
                  {summary.avgLoss !== undefined ? `₹${formatInr(summary.avgLoss)}` : '—'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};
