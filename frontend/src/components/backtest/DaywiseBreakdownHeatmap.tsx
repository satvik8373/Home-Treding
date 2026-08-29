import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Tooltip as MuiTooltip
} from '@mui/material';

export interface DayTile {
  date: string;
  pnl: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  dayOfMonth: number;
  dayOfWeek: number;
  monthYear: string;
}

export interface MonthSummary {
  monthYear: string;
  totalPnl: number;
  tradingDays: number;
  winDays: number;
  lossDays: number;
  days: DayTile[];
}

interface DaywiseBreakdownHeatmapProps {
  monthlyBreakdown: MonthSummary[];
  onSelectDay?: (date: string) => void;
}

export const DaywiseBreakdownHeatmap: React.FC<DaywiseBreakdownHeatmapProps> = ({
  monthlyBreakdown,
  onSelectDay
}) => {
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Helper to build 35-slot or 42-slot monthly calendar grid
  const renderMonthCalendar = (month: MonthSummary) => {
    const isProfitMonth = month.totalPnl >= 0;

    // Determine first day offset
    const firstDay = month.days.length > 0 ? month.days[0] : null;
    const firstDateObj = firstDay ? new Date(firstDay.date) : new Date();
    const startDayOfWeek = new Date(firstDateObj.getFullYear(), firstDateObj.getMonth(), 1).getDay();
    const daysInMonth = new Date(firstDateObj.getFullYear(), firstDateObj.getMonth() + 1, 0).getDate();

    const gridSlots: Array<{
      dayNum?: number;
      dayData?: DayTile;
      isPad?: boolean;
    }> = [];

    // Preceding empty pads
    for (let p = 0; p < startDayOfWeek; p++) {
      gridSlots.push({ isPad: true });
    }

    // Days 1..daysInMonth
    for (let d = 1; d <= daysInMonth; d++) {
      const match = month.days.find((day) => day.dayOfMonth === d);
      gridSlots.push({
        dayNum: d,
        dayData: match
      });
    }

    // Trailing pads to make multiple of 7
    while (gridSlots.length % 7 !== 0 || gridSlots.length < 35) {
      gridSlots.push({ isPad: true });
    }

    return (
      <Paper
        key={month.monthYear}
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          width: { xs: '100%', sm: 280 },
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Day of Week Headers (S M T W T F S) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            mb: 1.5,
            textAlign: 'center'
          }}
        >
          {weekDays.map((w, idx) => (
            <Typography
              key={idx}
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#94a3b8',
                fontSize: '0.75rem'
              }}
            >
              {w}
            </Typography>
          ))}
        </Box>

        {/* Heatmap Tile Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            mb: 2.5
          }}
        >
          {gridSlots.map((slot, index) => {
            if (slot.isPad || !slot.dayData) {
              return (
                <Box
                  key={`pad-${index}`}
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 1,
                    bgcolor: '#f1f5f9',
                    opacity: 0.6
                  }}
                />
              );
            }

            const dayPnl = slot.dayData.pnl;
            const isWin = dayPnl > 0;
            const tileColor = isWin ? '#22c55e' : '#ef4444';

            return (
              <MuiTooltip
                key={`day-${slot.dayNum}`}
                title={
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                      {slot.dayData.date}
                    </Typography>
                    <Typography variant="caption" sx={{ color: isWin ? '#4ade80' : '#f87171' }}>
                      P&L: ₹{dayPnl.toLocaleString('en-IN')}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#cbd5e1' }}>
                      Trades: {slot.dayData.tradesCount} ({slot.dayData.winCount}W / {slot.dayData.lossCount}L)
                    </Typography>
                  </Box>
                }
                arrow
              >
                <Box
                  onClick={() => onSelectDay && onSelectDay(slot.dayData!.date)}
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 1,
                    bgcolor: tileColor,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isWin ? '0 2px 4px rgba(34, 197, 94, 0.25)' : '0 2px 4px rgba(239, 68, 68, 0.25)',
                    '&:hover': {
                      transform: 'scale(1.15)',
                      zIndex: 2
                    }
                  }}
                />
              </MuiTooltip>
            );
          })}
        </Box>

        {/* Month Footer & P&L Badge */}
        <Box sx={{ textAlign: 'center', mt: 'auto' }}>
          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
            {month.monthYear}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 800,
              color: isProfitMonth ? '#16a34a' : '#dc2626',
              fontSize: '0.95rem'
            }}
          >
            {isProfitMonth ? `+₹${month.totalPnl.toLocaleString('en-IN')}` : `-₹${Math.abs(month.totalPnl).toLocaleString('en-IN')}`}
          </Typography>
        </Box>
      </Paper>
    );
  };

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
        Daywise Breakdown
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3
        }}
      >
        {monthlyBreakdown && monthlyBreakdown.length > 0 ? (
          monthlyBreakdown.map((m) => renderMonthCalendar(m))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No calendar data available for this range.
          </Typography>
        )}
      </Box>
    </Box>
  );
};
