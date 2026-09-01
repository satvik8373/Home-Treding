import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  AccountBalance,
  Refresh,
  ShowChart,
  AccountBalanceWallet,
  TrendingUp,
  Assessment,
  Bolt,
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import authService, { UserProfile } from '../services/authService';
import Layout from '../components/Layout';
import { brokerApi, BrokerSummary, PaperPortfolio } from '../services/brokerApi';
import { PageHeader, StatCard, SectionCard, StatusBadge } from '../components/ui';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

interface DeployedStrategy {
  deploymentId: string;
  strategyId: string;
  name: string;
  symbol: string;
  mode: 'paper' | 'live';
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  qtyMultiplier: number;
  tradesExecuted: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [brokers, setBrokers] = useState<BrokerSummary[]>([]);
  const [paperPortfolio, setPaperPortfolio] = useState<PaperPortfolio | null>(null);
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [activeDeployments, setActiveDeployments] = useState<DeployedStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [brokerList, portfolioRes, posRes, stratRes] = await Promise.all([
        brokerApi.getBrokers().catch(() => []),
        axios.get(`${API_CONFIG.BASE_URL}/api/paper/portfolio`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/paper/positions`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/strategies/active`).catch(() => ({ data: { success: false } }))
      ]);

      setBrokers(brokerList || []);
      if (portfolioRes.data?.success && portfolioRes.data?.portfolio) {
        setPaperPortfolio(portfolioRes.data.portfolio);
      }
      if (posRes.data?.success && posRes.data?.positions) {
        setActivePositions(posRes.data.positions);
      }
      if (stratRes.data?.success && stratRes.data?.deployments) {
        setActiveDeployments(stratRes.data.deployments);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await authService.getUserProfile(firebaseUser.uid);
          setUser(profile);
          await loadData();
        } catch (error) {
          console.error('Failed to load user profile:', error);
        }
      } else {
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f8fafc' }}>
        <CircularProgress size={32} sx={{ color: '#0f172a' }} />
      </Box>
    );
  }

  const dhanBroker = brokers.find(b => b.broker.toLowerCase() === 'dhan');
  const isDhanConnected = dhanBroker?.status === 'Connected';
  const runningStrategies = activeDeployments.filter(d => d.status === 'RUNNING');
  const openPositions = activePositions.filter(p => p.quantity !== 0);

  const dayPnl = paperPortfolio?.dayPnl ?? 0;
  const isPnlPositive = dayPnl >= 0;

  const formatPrice = (val: number = 0) => {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: '100%' }}>
        {/* Simple & Clean Welcome Header */}
        <PageHeader
          title={`Welcome back, ${user?.name || 'Trader'}`}
          subtitle={
            isDhanConnected
              ? `Dhan Live (${dhanBroker?.maskedClientId || 'Connected'}) • ${runningStrategies.length} automated strategies active`
              : 'Trading Terminal • Paper mode active'
          }
          badge={
            <StatusBadge
              status={isDhanConnected ? 'live' : 'paper'}
              dot
              pulse
              label={isDhanConnected ? 'DHAN CONNECTED' : 'PAPER TRADING'}
            />
          }
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Refresh Dashboard">
                <IconButton
                  onClick={handleRefresh}
                  disabled={refreshing}
                  size="small"
                  sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', p: 0.8, borderRadius: 2 }}
                >
                  <Refresh fontSize="small" sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', color: '#64748b' }} />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                size="small"
                startIcon={<Bolt sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/trading-dashboard')}
                sx={{
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  borderRadius: 2,
                  px: 2,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#1e293b' }
                }}
              >
                Trade Terminal
              </Button>
            </Box>
          }
        />

        {/* 4 Core KPI Metric Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <StatCard
            label="Total Portfolio Value"
            value={paperPortfolio ? `₹${formatPrice(paperPortfolio.totalPortfolioValue)}` : (isDhanConnected ? 'Syncing...' : '₹0.00')}
            subtext={isDhanConnected ? 'Dhan Live Balance' : 'Connect broker to view funds'}
            icon={<AccountBalanceWallet sx={{ fontSize: 18 }} />}
            onClick={() => navigate(isDhanConnected ? '/portfolio' : '/brokers')}
          />

          <StatCard
            label="Net Realized P&L"
            value={`${isPnlPositive ? '+' : ''}₹${formatPrice(dayPnl)}`}
            subtext={dayPnl === 0 ? 'No executed trades today' : 'After Brokerage & Taxes'}
            trend={isPnlPositive ? 'up' : 'down'}
            icon={<TrendingUp sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/reports')}
          />

          <StatCard
            label="Active Positions"
            value={`${openPositions.length} Open`}
            subtext={openPositions.length === 0 ? 'No active positions' : `Margin: ₹${formatPrice(paperPortfolio?.utilizedMargin ?? 0)}`}
            icon={<ShowChart sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/portfolio')}
          />

          <StatCard
            label="Active Strategies"
            value={`${runningStrategies.length} Running`}
            subtext={runningStrategies.length > 0 ? runningStrategies[0].name : 'No strategies running'}
            icon={<Bolt sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/strategies')}
          />
        </Box>

        {/* Quick Access Control Bar */}
        <Paper
          sx={{
            p: 1.5,
            mb: 3,
            borderRadius: 2.5,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem', px: 1 }}>
              Quick Navigation:
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ShowChart sx={{ fontSize: 14 }} />}
              onClick={() => navigate('/trading-dashboard')}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: 2, borderColor: '#e2e8f0', color: '#0f172a' }}
            >
              Live Terminal
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TrendingUp sx={{ fontSize: 14 }} />}
              onClick={() => navigate('/option-chain')}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: 2, borderColor: '#e2e8f0', color: '#0f172a' }}
            >
              Option Chain & Greeks
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Bolt sx={{ fontSize: 14 }} />}
              onClick={() => navigate('/strategies')}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: 2, borderColor: '#e2e8f0', color: '#0f172a' }}
            >
              Strategy Engine
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Assessment sx={{ fontSize: 14 }} />}
              onClick={() => navigate('/reports')}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: 2, borderColor: '#e2e8f0', color: '#0f172a' }}
            >
              Trade Ledger & Reports
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AccountBalance sx={{ fontSize: 14 }} />}
              onClick={() => navigate('/brokers')}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: 2, borderColor: '#e2e8f0', color: '#0f172a' }}
            >
              Dhan Broker Connection
            </Button>
          </Box>
        </Paper>

        {/* Dual Layout: Live Positions & Active Strategies */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          {/* Section 1: Live Positions Snapshot */}
          <SectionCard
            title="Active Holdings & Positions"
            subtitle={`${openPositions.length} active positions in virtual ledger`}
            action={
              <Button
                size="small"
                endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                onClick={() => navigate('/portfolio')}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: '#0f172a' }}
              >
                Full Portfolio
              </Button>
            }
          >
            {openPositions.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                  No open market positions.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/trading-dashboard')}
                  sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, fontSize: '0.78rem', borderColor: '#e2e8f0', color: '#0f172a' }}
                >
                  Place Trade in Terminal
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { color: '#64748b', fontSize: '0.72rem', fontWeight: 600, py: 1 } }}>
                      <TableCell sx={{ pl: 0 }}>Symbol</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Avg Price</TableCell>
                      <TableCell align="right">LTP</TableCell>
                      <TableCell align="right" sx={{ pr: 0 }}>MTM P&L</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {openPositions.map((pos) => {
                      const pnl = pos.totalPnl ?? (pos.quantity * (pos.ltp - pos.netAvgPrice));
                      const isPos = pnl >= 0;

                      return (
                        <TableRow key={pos.symbol} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                          <TableCell sx={{ pl: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                            {pos.symbol}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {pos.quantity}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                            ₹{formatPrice(pos.netAvgPrice)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            ₹{formatPrice(pos.ltp)}
                          </TableCell>
                          <TableCell align="right" sx={{ pr: 0, fontWeight: 700, fontFamily: 'monospace', fontSize: '0.82rem', color: isPos ? '#16a34a' : '#dc2626' }}>
                            {isPos ? '+' : ''}₹{formatPrice(pnl)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>

          {/* Section 2: Active Automated Strategies */}
          <SectionCard
            title="Automated Strategy Deployments"
            subtitle={`${runningStrategies.length} running algorithms`}
            action={
              <Button
                size="small"
                endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                onClick={() => navigate('/strategies')}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: '#0f172a' }}
              >
                Strategy Engine
              </Button>
            }
          >
            {activeDeployments.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                  No strategy templates deployed.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/strategies')}
                  sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, fontSize: '0.78rem', borderColor: '#e2e8f0', color: '#0f172a' }}
                >
                  Deploy Dhokiya 0.09% Strategy
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {activeDeployments.slice(0, 3).map((dep) => {
                  const isRunning = dep.status === 'RUNNING';

                  return (
                    <Box
                      key={dep.deploymentId}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid #f1f5f9',
                        bgcolor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>
                            {dep.name}
                          </Typography>
                          <StatusBadge status={isRunning ? 'live' : 'halted'} label={dep.status} />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.74rem' }}>
                          Target: <strong>{dep.symbol}</strong> • Mode: <strong style={{ color: dep.mode === 'live' ? '#dc2626' : '#16a34a' }}>{dep.mode.toUpperCase()}</strong> • Multiplier: {dep.qtyMultiplier}x
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {dep.tradesExecuted} Trades
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Box>
      </Box>
    </Layout>
  );
};

export default Dashboard;
