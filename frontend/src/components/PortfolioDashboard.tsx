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
import { brokerApi, BrokerPosition, PaperPortfolio, BrokerFunds } from '../services/brokerApi';
import { StatCard, StatusBadge, EmptyState } from './ui';
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api';
import { useTradingMode } from '../context/TradingModeContext';
import axios from 'axios';

const PortfolioDashboard: React.FC = () => {
  const { isLive } = useTradingMode();
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [paperPortfolio, setPaperPortfolio] = useState<PaperPortfolio | null>(null);
  const [liveFunds, setLiveFunds] = useState<BrokerFunds | null>(null);
  const [loading, setLoading] = useState(true);
  const [squaringOffSymbol, setSquaringOffSymbol] = useState<string | null>(null);

  const loadPortfolioData = React.useCallback(async () => {
    try {
      setLoading(true);
      if (isLive) {
        // Fetch Live DhanHQ positions and funds
        const [positionsData, fundsData] = await Promise.all([
          brokerApi.getPositions(),
          brokerApi.getFunds()
        ]);
        setPositions(positionsData || []);
        setLiveFunds(fundsData);
      } else {
        // Fetch Paper Virtual simulation data
        const [positionsData, portfolioData] = await Promise.all([
          brokerApi.getPaperPositions(),
          brokerApi.getPaperPortfolio()
        ]);
        setPositions(positionsData || []);
        setPaperPortfolio(portfolioData);
      }
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [isLive]);

  const handleSquareOff = async (symbol: string, positionId?: string) => {
    if (!symbol) return;
    try {
      setSquaringOffSymbol(symbol);
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/trading/positions/squareoff`, {
        symbol,
        positionId,
        mode: isLive ? 'live' : 'paper'
      });
      if (res.data?.success) {
        await loadPortfolioData();
      } else {
        alert(res.data?.message || 'Failed to square off position');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Error squaring off position');
    } finally {
      setSquaringOffSymbol(null);
    }
  };

  useEffect(() => {
    loadPortfolioData();
    let socket: Socket | null = null;

    // WebSocket real-time updates (only if enabled)
    if (API_CONFIG.ENABLE_WEBSOCKETS) {
      try {
        socket = io(API_CONFIG.WS_URL, {
          transports: ['websocket'],
          timeout: 5000,
          reconnectionAttempts: 2
        });

        socket.on('paper_position_updated', (updatedPos: BrokerPosition) => {
          if (!isLive) {
            setPositions(prev => {
              const index = prev.findIndex(p => p.symbol === updatedPos.symbol);
              if (index >= 0) {
                const next = [...prev];
                next[index] = updatedPos;
                return next;
              }
              return [...prev, updatedPos];
            });
          }
        });

        socket.on('portfolioUpdated', (updatedPort: PaperPortfolio) => {
          if (!isLive) {
            setPaperPortfolio(updatedPort);
          }
        });
      } catch (_) {}
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadPortfolioData();
    }, 10000);

    return () => {
      if (socket) socket.disconnect();
      clearInterval(interval);
    };
  }, [loadPortfolioData, isLive]);

  // Live Dhan calculations vs Paper Simulation calculations
  const liveRealizedPnl = positions.reduce((acc, p) => acc + (p.realizedPnl || 0), 0);
  const liveUnrealizedPnl = positions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  const liveTotalPnl = liveRealizedPnl + liveUnrealizedPnl;

  const dayPnl = isLive ? liveTotalPnl : (paperPortfolio?.dayPnl ?? 0);
  const realizedPnl = isLive ? liveRealizedPnl : (paperPortfolio?.realizedPnl ?? 0);
  const isPositiveDay = dayPnl >= 0;

  const totalValue = isLive
    ? (liveFunds?.totalAccountBalance || ((liveFunds?.availableMargin || 0) + (liveFunds?.usedMargin || 0)))
    : (paperPortfolio?.totalPortfolioValue ?? 0);

  const availableCash = isLive
    ? (liveFunds?.availableMargin ?? 0)
    : (paperPortfolio?.availableCash ?? 0);

  const utilizedMargin = isLive
    ? (liveFunds?.usedMargin ?? 0)
    : (paperPortfolio?.utilizedMargin ?? 0);

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Portfolio & Margin Ledger
          </Typography>
          <StatusBadge
            status={isLive ? 'live' : 'paper'}
            label={isLive ? 'DHAN LIVE' : 'PAPER'}
          />
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh sx={{ fontSize: 16 }} />}
          onClick={loadPortfolioData}
          size="small"
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: '#cbd5e1', color: '#475569' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard
          label={isLive ? "TOTAL BALANCE" : "PORTFOLIO VALUE"}
          value={`₹${formatPrice(totalValue)}`}
          subtext={utilizedMargin > 0 ? `Used: ₹${formatPrice(utilizedMargin)}` : undefined}
          icon={<AccountBalance sx={{ fontSize: 18 }} />}
        />

        <StatCard
          label={isLive ? "AVAILABLE MARGIN" : "AVAILABLE CASH"}
          value={`₹${formatPrice(availableCash)}`}
          icon={<AccountBalanceWallet sx={{ fontSize: 18 }} />}
        />

        <StatCard
          label="NET P&L (MTM)"
          value={`${isPositiveDay ? '+' : ''}₹${formatPrice(dayPnl)}`}
          subtext={`Realized: ₹${formatPrice(realizedPnl)}`}
          trend={isPositiveDay ? 'up' : 'down'}
          icon={<TrendingUp sx={{ fontSize: 18 }} />}
        />

        <StatCard
          label="ACTIVE POSITIONS"
          value={`${openPositionsCount} Open`}
          icon={<Assessment sx={{ fontSize: 18 }} />}
        />
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #cbd5e1', overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #cbd5e1', bgcolor: '#f8fafc' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Open Positions
          </Typography>
        </Box>

        {loading && <LinearProgress />}

        {positions.length === 0 && !loading ? (
          <EmptyState
            icon={<Assessment sx={{ fontSize: 26 }} />}
            title="No open positions"
            description="Positions appear here when strategies trigger or orders are filled."
            compact
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 2.5 }}>Symbol</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Avg Price (₹)</TableCell>
                  <TableCell align="right">LTP (₹)</TableCell>
                  <TableCell align="right">P&amp;L (₹)</TableCell>
                  <TableCell align="center" sx={{ pr: 2.5 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((pos) => {
                  const pnl = pos.totalPnl ?? (pos.quantity * (pos.ltp - pos.netAvgPrice));
                  const isPos = pnl >= 0;
                  const isClosed = pos.quantity === 0;

                  return (
                    <TableRow key={pos.positionId || pos.symbol} hover>
                      <TableCell sx={{ pl: 2.5, fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{pos.symbol}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={isClosed ? 'paper' : 'live'}
                          label={isClosed ? 'CLOSED' : pos.productType || 'INTRADAY'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{pos.quantity}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569' }}>₹{formatPrice(pos.netAvgPrice)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>₹{formatPrice(pos.ltp)}</TableCell>
                      <TableCell align="right" sx={{ color: isPos ? '#16a34a' : '#dc2626', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.88rem' }}>
                        {isPos ? '+' : ''}₹{formatPrice(pnl)}
                      </TableCell>
                      <TableCell align="center" sx={{ pr: 2.5 }}>
                        {!isClosed ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSquareOff(pos.symbol, pos.positionId)}
                            disabled={squaringOffSymbol === pos.symbol}
                            sx={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              py: 0.2,
                              px: 1.2,
                              borderRadius: 1.5,
                              textTransform: 'none',
                              borderColor: '#fca5a5',
                              color: '#dc2626',
                              bgcolor: '#fef2f2',
                              '&:hover': { bgcolor: '#fee2e2', borderColor: '#ef4444' }
                            }}
                          >
                            {squaringOffSymbol === pos.symbol ? 'Exiting...' : 'Square-Off'}
                          </Button>
                        ) : (
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
                        )}
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