import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Paper,
  Switch,
  Avatar
} from '@mui/material';
import {
  Refresh,
  ShowChart,
  AccountBalanceWallet,
  TrendingUp,
  Bolt,
  ArrowForward,
  NotificationsNone
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import authService, { UserProfile } from '../services/authService';
import Layout from '../components/Layout';
import { brokerApi, BrokerSummary, PaperPortfolio, BrokerFunds } from '../services/brokerApi';
import { PageHeader, StatCard, SectionCard, StatusBadge, EmptyState } from '../components/ui';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { useTradingMode } from '../context/TradingModeContext';
import { io, Socket } from 'socket.io-client';
import { Nifty009Status } from '../components/NiftyIndependentBreakoutMonitor';
import { StrategyLevels } from '../components/TradingViewLiveChart';

interface DeployedStrategy {
  deploymentId: string;
  strategyId: string;
  name: string;
  symbol: string;
  mode: 'paper' | 'live';
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  qtyMultiplier: number;
  tradesExecuted: number;
  pnl?: number;
}

interface OrderRecord {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: string;
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isLive, toggleMode } = useTradingMode();
  const [engineToggling, setEngineToggling] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [brokers, setBrokers] = useState<BrokerSummary[]>([]);
  const [paperPortfolio, setPaperPortfolio] = useState<PaperPortfolio | null>(null);
  const [liveFunds, setLiveFunds] = useState<BrokerFunds | null>(null);
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [activeDeployments, setActiveDeployments] = useState<DeployedStrategy[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRecord[]>([]);
  const [niftyStatus, setNiftyStatus] = useState<Nifty009Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (isLive) {
        const [brokerList, fundsData, positionsData, stratRes, ordersRes, engineRes] = await Promise.all([
          brokerApi.getBrokers().catch(() => []),
          brokerApi.getFunds().catch(() => null),
          brokerApi.getPositions().catch(() => []),
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies/active`).catch(() => ({ data: { deployments: [] } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/trading/orders`).catch(() => ({ data: { orders: [] } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies/nifty009/status`).catch(() => ({ data: { success: false } }))
        ]);
        setBrokers(brokerList || []);
        setLiveFunds(fundsData);
        setActivePositions(positionsData || []);
        if (stratRes.data?.deployments) setActiveDeployments(stratRes.data.deployments);
        if (ordersRes.data?.orders) setRecentOrders(ordersRes.data.orders.slice(0, 8));
        if (engineRes.data?.success && engineRes.data?.data) setNiftyStatus(engineRes.data.data);
      } else {
        const [brokerList, portfolioData, positionsData, stratRes, ordersRes, engineRes] = await Promise.all([
          brokerApi.getBrokers().catch(() => []),
          brokerApi.getPaperPortfolio().catch(() => null),
          brokerApi.getPaperPositions().catch(() => []),
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies/active`).catch(() => ({ data: { deployments: [] } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/paper/orders`).catch(() => ({ data: { orders: [] } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies/nifty009/status`).catch(() => ({ data: { success: false } }))
        ]);
        setBrokers(brokerList || []);
        setPaperPortfolio(portfolioData);
        setActivePositions(positionsData || []);
        if (stratRes.data?.deployments) setActiveDeployments(stratRes.data.deployments);
        if (ordersRes.data?.orders) setRecentOrders(ordersRes.data.orders.slice(0, 8));
        if (engineRes.data?.success && engineRes.data?.data) setNiftyStatus(engineRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }, [isLive]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        try {
          const profile = await authService.getUserProfile(currentUser.uid);
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
  }, [navigate, loadData]);

  // WebSocket real-time updates
  useEffect(() => {
    let socket: Socket | null = null;
    if (API_CONFIG.ENABLE_WEBSOCKETS) {
      try {
        socket = io(API_CONFIG.WS_URL, {
          transports: ['websocket'],
          timeout: 5000,
          reconnectionAttempts: 5
        });
        socketRef.current = socket;

        socket.on('nifty009:status', (status: Nifty009Status) => {
          if (status) setNiftyStatus(status);
        });

        socket.on('paper_order_filled', (order: any) => {
          if (order?.orderId || order?.symbol) {
            setRecentOrders(prev => [order, ...prev.slice(0, 7)]);
          }
        });

        socket.on('portfolioUpdated', (portfolio: PaperPortfolio) => {
          if (portfolio) setPaperPortfolio(portfolio);
        });
      } catch (err) {
        console.warn('Socket.IO connection warning:', err);
      }
    }

    pollingRef.current = setInterval(() => { loadData(); }, 15000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f1f5f9' }}>
        <CircularProgress size={28} sx={{ color: '#2563eb' }} />
      </Box>
    );
  }

  const dhanBroker = brokers.find(b => b.broker?.toUpperCase() === 'DHAN') || brokers[0];
  const isDhanConnected = Boolean(dhanBroker && (dhanBroker.status === 'Connected' || dhanBroker.terminalEnabled));
  const brokerDisplayName = dhanBroker ? `${dhanBroker.broker} (${dhanBroker.maskedClientId || dhanBroker.clientId})` : 'Dhan (Not Connected)';
  const brokerStatusText = isDhanConnected ? 'Connected' : 'Disconnected';
  const userDisplayName = user?.name || dhanBroker?.accountName || user?.email || 'Mavrix Trader';

  const isEngineRunning = niftyStatus?.isRunning;
  const enginePnl = niftyStatus?.sessionPnl ?? 0;

  const runningStrategies = activeDeployments.filter(d => d.status === 'RUNNING');
  const openPositions = activePositions.filter(p => p.quantity !== 0);

  const liveRealizedPnl = activePositions.reduce((acc, p) => acc + (p.realizedPnl || 0), 0);
  const liveUnrealizedPnl = activePositions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  const dayPnl = isLive
    ? (liveRealizedPnl + liveUnrealizedPnl)
    : ((paperPortfolio?.dayPnl ?? 0) + (enginePnl || 0));

  const totalCapital = isLive
    ? (liveFunds?.totalAccountBalance || ((liveFunds?.availableMargin || 0) + (liveFunds?.usedMargin || 0)))
    : (paperPortfolio?.totalPortfolioValue ?? 100000);

  const formatPrice = (val?: number | null) =>
    (val ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const spotBase = niftyStatus?.firstCandleClose || niftyStatus?.niftyLtp || 0;
  const upperLvl = (niftyStatus as any)?.spotUpperLevel || niftyStatus?.upperLevel || (spotBase > 0 ? Number((spotBase * 1.0009).toFixed(2)) : 0);
  const lowerLvl = (niftyStatus as any)?.spotLowerLevel || niftyStatus?.lowerLevel || (spotBase > 0 ? Number((spotBase * 0.9991).toFixed(2)) : 0);
  const strategyLevels: StrategyLevels = {
    spotBase: spotBase,
    upperLevel: upperLvl,
    lowerLevel: lowerLvl,
    liveLtp: niftyStatus?.niftyLtp || spotBase
  };

  const handleToggleTerminal = async () => {
    const res = await toggleMode();
    if (!res.success && res.requiresBroker) {
      alert(res.message || 'Please connect Dhan broker to enable Live mode.');
    }
  };

  const handleToggleEngine = async () => {
    try {
      setEngineToggling(true);
      if (isEngineRunning) {
        const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/nifty009/stop`);
        if (res.data?.status) {
          setNiftyStatus(res.data.status);
        } else {
          setNiftyStatus(prev => prev ? { ...prev, isRunning: false } : null);
        }
      } else {
        const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/nifty009/start`, { capitalAllocation: 100000 });
        if (res.data?.status) {
          setNiftyStatus(res.data.status);
        } else {
          setNiftyStatus(prev => prev ? { ...prev, isRunning: true } : null);
        }
      }
    } catch (err: any) {
      console.error('Failed to toggle trading engine:', err);
      alert('Trading engine error: ' + (err.response?.data?.error || err.message));
    } finally {
      setEngineToggling(false);
      loadData();
    }
  };

  const allStrategiesWithPnl = [
    ...activeDeployments.map(d => ({ name: d.name, pnl: d.pnl ?? 0 })),
    ...(isEngineRunning ? [{ name: niftyStatus?.strategyName || 'NIFTY 0.09% ATM Breakout', pnl: enginePnl }] : [])
  ];
  const topGainer = allStrategiesWithPnl.filter(s => s.pnl > 0).sort((a, b) => b.pnl - a.pnl)[0];
  const topLoss = allStrategiesWithPnl.filter(s => s.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];

  const realDeployments: DeployedStrategy[] = [
    ...activeDeployments,
    ...(isEngineRunning && !activeDeployments.some(d => d.strategyId === 'nifty009' || d.strategyId === 'nifty-009-atm-breakout')
      ? [{
          deploymentId: 'nifty009-live-engine',
          strategyId: 'nifty-009-atm-breakout',
          name: niftyStatus?.strategyName || 'NIFTY 0.09% ATM Breakout',
          symbol: 'NIFTY 50',
          mode: (niftyStatus?.mode || (isLive ? 'live' : 'paper')) as 'paper' | 'live',
          status: (niftyStatus?.isPaused ? 'PAUSED' : 'RUNNING') as 'RUNNING' | 'PAUSED' | 'STOPPED',
          qtyMultiplier: 1,
          tradesExecuted: niftyStatus?.combined?.totalTrades || 0,
          pnl: enginePnl
        }]
      : [])
  ];

  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        {/* Page Header */}
        <PageHeader
          title="My Dashboard"
          subtitle={user?.email ? `Connected: ${user.name || user.email}` : undefined}
          badge={
            <StatusBadge
              status={isLive ? (isDhanConnected ? 'live' : 'warning') : 'paper'}
              label={isLive ? (isDhanConnected ? 'DHAN LIVE' : 'BROKER OFFLINE') : 'PAPER MODE'}
            />
          }
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Refresh">
                <IconButton
                  onClick={handleRefresh}
                  disabled={refreshing}
                  size="small"
                  sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', p: 0.7, borderRadius: 1.5 }}
                >
                  <Refresh fontSize="small" sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', color: '#64748b', fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                size="small"
                startIcon={<Bolt sx={{ fontSize: 14 }} />}
                onClick={() => navigate('/strategies')}
                sx={{
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  borderRadius: 1.5,
                  px: 1.8,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                }}
              >
                Strategies
              </Button>
            </Box>
          }
        />

        {/* 3 Top Cards matching Reference Design */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr 1.35fr' },
          gap: 2.5,
          mb: 3
        }}>
          {/* Card 1: Total P&L Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              bgcolor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 185,
              border: '1px solid #1d4ed8',
              boxShadow: 'none'
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' }}>
                Total P&L
              </Typography>
              <Typography sx={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', mt: 0.5, letterSpacing: '-0.02em', color: '#ffffff' }}>
                {dayPnl > 0 ? '+' : ''}₹{formatPrice(dayPnl)}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600, display: 'block' }}>
                    Top Gainer Strategy
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 145 }}>
                    {topGainer ? topGainer.name : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600, display: 'block' }}>
                    Top Loss Strategy
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 145 }}>
                    {topLoss ? topLoss.name : '—'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 1.5,
              mt: 2,
              borderTop: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
                {userDisplayName}
              </Typography>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(255, 255, 255, 0.4)' }}>
                {userDisplayName.charAt(0).toUpperCase()}
              </Avatar>
            </Box>
          </Paper>

          {/* Card 2: Broker & Engine Status */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 185
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                Broker
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.4 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: isDhanConnected ? '#16a34a' : '#94a3b8' }} />
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                  {brokerDisplayName}
                </Typography>
              </Box>

              <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, mt: 2 }}>
                Broker Login Status
              </Typography>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: isDhanConnected ? '#16a34a' : '#64748b', mt: 0.2 }}>
                {brokerStatusText}
              </Typography>
            </Box>

            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 2,
              mt: 1.5,
              borderTop: '1px solid #f1f5f9'
            }}>
              {/* Terminal Switch */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                    Terminal
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: isLive ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                    {isLive ? 'Live' : 'Paper'}
                  </Typography>
                </Box>
                <Switch
                  size="small"
                  checked={isLive}
                  onChange={handleToggleTerminal}
                  color="primary"
                />
              </Box>

              {/* Trading Engine Switch */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                    Trading Engine
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: isEngineRunning ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                    {isEngineRunning ? 'Running' : 'Stopped'}
                  </Typography>
                </Box>
                <Switch
                  size="small"
                  checked={Boolean(isEngineRunning)}
                  onChange={handleToggleEngine}
                  disabled={engineToggling}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#16a34a'
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#16a34a'
                    }
                  }}
                />
              </Box>
            </Box>
          </Paper>

          {/* Card 3: Strategy Deployed */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 185
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                Strategy Deployed
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                  {brokerDisplayName}
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/strategies')}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: '#2563eb', p: 0, minWidth: 'auto' }}
                >
                  See All
                </Button>
              </Box>
            </Box>

            {/* List of Strategies */}
            {realDeployments.length === 0 ? (
              <Box sx={{ py: 2.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mb: 1.2, fontWeight: 500 }}>
                  No strategies actively deployed
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/strategies')}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderColor: '#cbd5e1',
                    color: '#2563eb',
                    '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff' }
                  }}
                >
                  Deploy Strategy
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {realDeployments.slice(0, 3).map((strat, idx) => {
                  const avatarColors = [
                    { bg: '#fef3c7', text: '#b45309' },
                    { bg: '#ede9fe', text: '#6d28d9' },
                    { bg: '#ccfbf1', text: '#0f766e' }
                  ];
                  const colorScheme = avatarColors[idx % avatarColors.length];
                  const stratPnl = strat.pnl ?? 0;

                  return (
                    <Box
                      key={strat.deploymentId || idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 0.5,
                        borderBottom: idx < realDeployments.length - 1 ? '1px solid #f8fafc' : 'none'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                        <Box sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: colorScheme.bg,
                          color: colorScheme.text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {idx === 0 ? <AccountBalanceWallet sx={{ fontSize: 15 }} /> : idx === 1 ? <ShowChart sx={{ fontSize: 15 }} /> : <Bolt sx={{ fontSize: 15 }} />}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: { xs: 140, md: 170 }
                          }}>
                            {strat.name}
                          </Typography>
                          <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
                            • {strat.status === 'RUNNING' ? 'Running' : strat.status === 'PAUSED' ? 'Paused' : 'Stopped'} • {strat.mode === 'live' ? 'Live' : 'Paper'}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography sx={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: stratPnl > 0 ? '#16a34a' : stratPnl < 0 ? '#dc2626' : '#64748b',
                        flexShrink: 0,
                        pl: 1
                      }}>
                        {stratPnl > 0 ? '+' : ''}₹{formatPrice(stratPnl)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Box>

        {/* Live Market Values Strip */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: 2.5,
            border: '1px solid #cbd5e1',
            bgcolor: '#ffffff',
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 1.5
          }}
        >
          {/* 1: NIFTY 50 Spot */}
          <Box sx={{ borderRight: { md: '1px solid #f1f5f9' }, pr: 1.5 }}>
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              NIFTY 50 Spot
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', mt: 0.2 }}>
              ₹{formatPrice(niftyStatus?.niftyLtp || spotBase)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 600 }}>
              Live Index Tick
            </Typography>
          </Box>

          {/* 2: ATM Strike */}
          <Box sx={{ borderRight: { md: '1px solid #f1f5f9' }, pr: 1.5 }}>
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Locked ATM Strike
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace', mt: 0.2 }}>
              {niftyStatus?.lockedAtm?.atmStrike || 26200}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
              {niftyStatus?.lockedAtm?.expiry || 'Weekly Expiry'}
            </Typography>
          </Box>

          {/* 3: CE Strike & LTP */}
          <Box sx={{ borderRight: { md: '1px solid #f1f5f9' }, pr: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                ATM CE Premium
              </Typography>
              <Chip
                label={niftyStatus?.ce?.state || 'FLAT'}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: niftyStatus?.ce?.state === 'LONG' ? '#f0fdf4' : '#f8fafc',
                  color: niftyStatus?.ce?.state === 'LONG' ? '#16a34a' : '#64748b'
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', mt: 0.2 }}>
              ₹{formatPrice(niftyStatus?.ce?.currentLtp || niftyStatus?.ceLtp || 0)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
              Trigger: <strong style={{ color: '#16a34a' }}>₹{formatPrice(niftyStatus?.ce?.upperLevel || 0)}</strong>
            </Typography>
          </Box>

          {/* 4: PE Strike & LTP */}
          <Box sx={{ borderRight: { md: '1px solid #f1f5f9' }, pr: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                ATM PE Premium
              </Typography>
              <Chip
                label={niftyStatus?.pe?.state || 'FLAT'}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: niftyStatus?.pe?.state === 'LONG' ? '#f0fdf4' : '#f8fafc',
                  color: niftyStatus?.pe?.state === 'LONG' ? '#16a34a' : '#64748b'
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', mt: 0.2 }}>
              ₹{formatPrice(niftyStatus?.pe?.currentLtp || niftyStatus?.peLtp || 0)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
              Trigger: <strong style={{ color: '#dc2626' }}>₹{formatPrice(niftyStatus?.pe?.upperLevel || 0)}</strong>
            </Typography>
          </Box>

          {/* 5: Upper Breakout Level */}
          <Box sx={{ borderRight: { md: '1px solid #f1f5f9' }, pr: 1.5 }}>
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
              Spot Buy Call (+0.09%)
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace', mt: 0.2 }}>
              ₹{formatPrice(strategyLevels.upperLevel)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
              Base: ₹{formatPrice(spotBase)}
            </Typography>
          </Box>

          {/* 6: Lower Breakout Level */}
          <Box>
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              Spot Buy Put (-0.09%)
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', mt: 0.2 }}>
              ₹{formatPrice(strategyLevels.lowerLevel)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
              Window: 09:20–15:10
            </Typography>
          </Box>
        </Paper>

        {/* Main 2-column grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, gap: 2.5 }}>
          {/* Left: Recent Orders */}
          <SectionCard
            title="Recent Executions"
            action={
              <Button
                size="small"
                endIcon={<ArrowForward sx={{ fontSize: 12 }} />}
                onClick={() => navigate('/portfolio')}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', color: '#2563eb', p: 0 }}
              >
                All Orders
              </Button>
            }
            noPadding
          >
            {recentOrders.length === 0 ? (
              <EmptyState
                title="No orders today"
                description="Trade executions from your strategies will appear here."
                compact
              />
            ) : (
              <TableContainer sx={{ borderRadius: 0, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', py: 1, pl: 2.5, letterSpacing: '0.04em' }}>Time</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', py: 1, letterSpacing: '0.04em' }}>Symbol</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', py: 1, letterSpacing: '0.04em' }}>Side</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', py: 1, letterSpacing: '0.04em' }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', py: 1, letterSpacing: '0.04em' }}>Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', py: 1, pr: 2.5, letterSpacing: '0.04em' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOrders.map((ord) => (
                      <TableRow key={ord.orderId} hover sx={{ borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 0 } }}>
                        <TableCell sx={{ color: '#64748b', fontSize: '0.75rem', py: 1.1, pl: 2.5 }}>
                          {ord.timestamp ? new Date(ord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', py: 1.1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ord.symbol}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.1 }}>
                          <StatusBadge status={ord.side === 'BUY' ? 'success' : 'error'} label={ord.side} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, py: 1.1 }}>{ord.quantity}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', py: 1.1 }}>₹{formatPrice(ord.price)}</TableCell>
                        <TableCell align="right" sx={{ py: 1.1, pr: 2.5 }}>
                          <StatusBadge
                            status={ord.status === 'FILLED' ? 'filled' : ord.status === 'CANCELLED' ? 'cancelled' : 'pending'}
                            label={ord.status || 'FILLED'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>

          {/* Right column: Strategy Status + Positions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* NIFTY 0.09% Strategy Status — compact card */}
            <SectionCard
              title="NIFTY Breakout Strategy"
              badge={
                <StatusBadge
                  status={isEngineRunning ? (niftyStatus?.isPaused ? 'warning' : 'success') : 'offline'}
                  label={isEngineRunning ? (niftyStatus?.isPaused ? 'PAUSED' : 'RUNNING') : 'OFFLINE'}
                />
              }
              action={
                <Button
                  size="small"
                  endIcon={<ArrowForward sx={{ fontSize: 12 }} />}
                  onClick={() => navigate('/strategies')}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', color: '#2563eb', p: 0 }}
                >
                  Manage
                </Button>
              }
            >
              {isEngineRunning ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {/* Key stats row */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
                    <Box sx={{ p: 1.2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Session P&L</Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace', color: enginePnl >= 0 ? '#16a34a' : '#dc2626', mt: 0.2 }}>
                        {enginePnl >= 0 ? '+' : ''}₹{formatPrice(enginePnl)}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Trades</Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', mt: 0.2 }}>
                        {niftyStatus?.combined?.totalTrades ?? 0}
                      </Typography>
                    </Box>
                  </Box>
                  {/* CE/PE leg state */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {[
                      { label: 'CE', state: niftyStatus?.ce?.state, ltp: niftyStatus?.ce?.currentLtp },
                      { label: 'PE', state: niftyStatus?.pe?.state, ltp: niftyStatus?.pe?.currentLtp }
                    ].map(leg => (
                      <Box key={leg.label} sx={{ flex: 1, p: 1, bgcolor: leg.state === 'LONG' ? '#f0fdf4' : '#f8fafc', border: `1px solid ${leg.state === 'LONG' ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 1.5, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{leg.label}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: leg.state === 'LONG' ? '#16a34a' : '#64748b', mt: 0.2 }}>{leg.state ?? 'FLAT'}</Typography>
                        <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#0f172a' }}>₹{formatPrice(leg.ltp)}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center' }}>
                    ATM {niftyStatus?.lockedAtm?.atmStrike ?? '—'} · Window 09:20–15:10
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 1.5 }}>
                    Strategy not running
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => navigate('/strategies')}
                    sx={{ bgcolor: '#2563eb', color: '#fff', textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', borderRadius: 1.5, boxShadow: 'none', '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' } }}
                  >
                    Go to Strategies
                  </Button>
                </Box>
              )}
            </SectionCard>

            {/* Open Positions compact */}
            <SectionCard
              title="Open Positions"
              badge={openPositions.length > 0 ? <Chip label={openPositions.length} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#e0e7ff', color: '#3730a3' }} /> : undefined}
              action={
                <Button
                  size="small"
                  endIcon={<ArrowForward sx={{ fontSize: 12 }} />}
                  onClick={() => navigate('/portfolio')}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', color: '#2563eb', p: 0 }}
                >
                  Portfolio
                </Button>
              }
              noPadding
            >
              {openPositions.length === 0 ? (
                <Box sx={{ py: 2.5, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8' }}>No open positions</Typography>
                </Box>
              ) : (
                <Box>
                  {openPositions.slice(0, 4).map((pos) => {
                    const pnl = pos.totalPnl ?? (pos.quantity * ((pos.ltp || 0) - (pos.netAvgPrice || 0)));
                    const isPos = pnl >= 0;
                    return (
                      <Box key={pos.symbol} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 0 } }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.symbol}</Typography>
                          <Typography sx={{ fontSize: '0.67rem', color: '#64748b' }}>Qty: {pos.quantity} · Avg: ₹{formatPrice(pos.netAvgPrice)}</Typography>
                        </Box>
                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: isPos ? '#16a34a' : '#dc2626', flexShrink: 0, ml: 1 }}>
                          {isPos ? '+' : ''}₹{formatPrice(pnl)}
                        </Typography>
                      </Box>
                    );
                  })}
                  {openPositions.length > 4 && (
                    <Box sx={{ py: 1, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>{openPositions.length - 4} more in portfolio</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </SectionCard>

            {/* Quick Links */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
              {[
                { label: 'Backtest', sub: 'Test your strategies', path: '/backtest', icon: <TrendingUp sx={{ fontSize: 15, color: '#2563eb' }} /> },
                { label: 'Reports', sub: 'P&L & analytics', path: '/reports', icon: <NotificationsNone sx={{ fontSize: 15, color: '#16a34a' }} /> }
              ].map(item => (
                <Box
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }, transition: 'all 0.15s ease' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
                    {item.icon}
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{item.label}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>{item.sub}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default Dashboard;
