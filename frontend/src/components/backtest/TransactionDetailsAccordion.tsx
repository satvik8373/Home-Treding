import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

export interface BacktestTradeItem {
  id: string;
  date: string;
  entryTime: string;
  exitTime: string;
  symbol: string;
  instrument: string;
  strike: number;
  optionType: 'CE' | 'PE';
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  brokerage: number;
  netPnl: number;
  exitReason: string;
  status: 'WIN' | 'LOSS';
}

export interface DayTransactionGroup {
  date: string;
  pnl: number;
  tradesCount: number;
  trades: BacktestTradeItem[];
}

interface TransactionDetailsAccordionProps {
  daywiseTransactions: DayTransactionGroup[];
  selectedDate?: string | null;
}

export const TransactionDetailsAccordion: React.FC<TransactionDetailsAccordionProps> = ({
  daywiseTransactions,
  selectedDate
}) => {
  const [expandedDate, setExpandedDate] = useState<string | false>(
    selectedDate || (daywiseTransactions.length > 0 ? daywiseTransactions[0].date : false)
  );

  const formatDisplayDate = (dStr: string) => {
    const d = new Date(dStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const handleAccordionChange = (date: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedDate(isExpanded ? date : false);
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
        Transaction Details
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {daywiseTransactions.map((day) => {
          const isDayProfit = day.pnl >= 0;

          return (
            <Accordion
              key={day.date}
              expanded={expandedDate === day.date}
              onChange={handleAccordionChange(day.date)}
              elevation={0}
              sx={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px !important',
                overflow: 'hidden',
                '&:before': { display: 'none' },
                bgcolor: '#ffffff'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore sx={{ color: '#64748b' }} />}
                sx={{
                  px: 3,
                  py: 1.5,
                  '&:hover': { bgcolor: '#f8fafc' }
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    pr: 2
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 700,
                      color: '#1e293b',
                      fontSize: '0.95rem'
                    }}
                  >
                    {formatDisplayDate(day.date)}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      {day.tradesCount} {day.tradesCount === 1 ? 'Trade' : 'Trades'}
                    </Typography>
                    <Chip
                      size="small"
                      label={isDayProfit ? `+₹${day.pnl.toLocaleString('en-IN')}` : `-₹${Math.abs(day.pnl).toLocaleString('en-IN')}`}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        bgcolor: isDayProfit ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isDayProfit ? '#16a34a' : '#dc2626',
                        borderRadius: 1.5
                      }}
                    />
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #f1f5f9', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Time</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Instrument</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Side</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Entry Price</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Exit Price</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Charges</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Net P&L</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {day.trades.map((trade) => {
                        const isWin = trade.netPnl > 0;
                        return (
                          <TableRow key={trade.id} hover>
                            <TableCell sx={{ fontSize: '0.8rem', color: '#334155' }}>
                              {trade.entryTime} → {trade.exitTime}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                              {trade.instrument}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={trade.side}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  bgcolor: trade.side === 'BUY' ? '#dbeafe' : '#fef3c7',
                                  color: trade.side === 'BUY' ? '#1d4ed8' : '#b45309'
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', color: '#334155' }}>{trade.quantity}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', color: '#334155' }}>₹{trade.entryPrice.toFixed(2)}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', color: '#334155' }}>₹{trade.exitPrice.toFixed(2)}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>₹{trade.brokerage}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', fontWeight: 700, color: isWin ? '#16a34a' : '#dc2626' }}>
                              {isWin ? `+₹${trade.netPnl.toLocaleString('en-IN')}` : `-₹${Math.abs(trade.netPnl).toLocaleString('en-IN')}`}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={trade.status}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  bgcolor: isWin ? '#dcfce7' : '#fee2e2',
                                  color: isWin ? '#15803d' : '#b91c1c'
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
};
