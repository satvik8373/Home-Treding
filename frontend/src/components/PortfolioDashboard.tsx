import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Button
} from '@mui/material';
import {
  TrendingUp,
  AccountBalance,
  Refresh,
  AccountBalanceWallet,
  Assessment
} from '@mui/icons-material';
import { brokerApi, BrokerPosition, PaperPortfolio } from '../services/brokerApi';
import { StatCard, StatusBadge } from './ui';
import { io, Socket } from 'socket.io-client';

const PortfolioDashboard: React.FC = () => {
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [portfolio, setPortfolio] = useState<PaperPortfolio | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPortfolioData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [positionsData, portfolioData] = await Promise.all([
        brokerApi.getPaperPositions(),
        brokerApi.getPaperPortfolio()
      ]);

      setPositions(positionsData || []);
      setPortfolio(portfolioData);
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolioData();

    // WebSocket real-time updates
    const wsUrl = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:5000';
    const socket: Socket = io(wsUrl);

    socket.on('paper_position_updated', (updatedPos: BrokerPosition) => {
      setPositions(prev => {
        const index = prev.findIndex(p => p.symbol === updatedPos.symbol);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedPos;
          return next;
        }
        return [...prev, updatedPos];
      });
    });

    socket.on('portfolioUpdated', (updatedPort: PaperPortfolio) => {
      setPortfolio(updatedPort);
    });

    const interval = setInterval(loadPortfolioData, 10000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [loadPortfolioData]);

  const dayPnl = portfolio?.dayPnl ?? 0;
  const isPositiveDay = dayPnl >= 0;
  const totalValue = portfolio?.totalPortfolioValue ?? 0;
  const availableCash = portfolio?.availableCash ?? 0;
  const utilizedMargin = portfolio?.utilizedMargin ?? 0;
  const openPositionsCount = positions.filter(p => p.quantity !== 0).length;

  const formatPrice = (val: number = 0) => {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Portfolio & Margin Ledger
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Real-time Mark-to-Market against Dhan live market ticks
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh sx={{ fontSize: 16 }} />}
          onClick={loadPortfolioData}
          size="small"
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: '#e2e8f0', color: '#475569' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard
          label="Portfolio Value"
          value={`₹${formatPrice(totalValue)}`}
          subtext="Cash + Utilized Margin"
          icon={<AccountBalance sx={{ fontSize: 18 }} />}
        />

        <StatCard
          label="Available Cash"
          value={`₹${formatPrice(availableCash)}`}
          subtext={`Utilized: ₹${formatPrice(utilizedMargin)}`}
          icon={<AccountBalanceWallet sx={{ fontSize: 18 }} />}
        />

        <StatCard
          label="Net P&L"
          value={`${isPositiveDay ? '+' : ''}₹${formatPrice(dayPnl)}`}
          subtext={`Realized: ₹${formatPrice(portfolio?.realizedPnl ?? 0)}`}
          trend={isPositiveDay ? 'up' : 'down'}
          icon={<TrendingUp sx={{ fontSize: 18 }} />}
        />

        <StatCard
          label="Active Positions"
          value={`${openPositionsCount} Open`}
          subtext={`${portfolio?.totalTrades ?? 0} Total Orders`}
          icon={<Assessment sx={{ fontSize: 18 }} />}
        />
      </Box>

      {/* Positions Table */}
      <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 1.8, borderBottom: '1px solid #f1f5f9' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Open Trading Positions
          </Typography>
        </Box>

        {loading && <LinearProgress sx={{ bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: '#0f172a' } }} />}

        {positions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
              No open positions
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Positions will appear here when strategies trigger or manual paper trades are placed.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', py: 1.2, borderBottom: '1px solid #e2e8f0' } }}>
                  <TableCell sx={{ pl: 2.5 }}>Symbol</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Avg Price (₹)</TableCell>
                  <TableCell align="right">LTP (₹)</TableCell>
                  <TableCell align="right" sx={{ pr: 2.5 }}>P&L (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((pos) => {
                  const pnl = pos.totalPnl ?? (pos.quantity * (pos.ltp - pos.netAvgPrice));
                  const isPos = pnl >= 0;
                  const isClosed = pos.quantity === 0;

                  return (
                    <TableRow key={pos.positionId || pos.symbol} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                      <TableCell sx={{ pl: 2.5, fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                        {pos.symbol}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={isClosed ? 'paper' : 'live'}
                          label={isClosed ? 'CLOSED' : pos.productType || 'INTRADAY'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {pos.quantity}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569' }}>
                        ₹{formatPrice(pos.netAvgPrice)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        ₹{formatPrice(pos.ltp)}
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 2.5, color: isPos ? '#16a34a' : '#dc2626', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.88rem' }}>
                        {isPos ? '+' : ''}₹{formatPrice(pnl)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default PortfolioDashboard;