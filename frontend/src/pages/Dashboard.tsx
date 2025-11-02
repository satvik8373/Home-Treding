import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
  Assessment,
  Refresh,
  ArrowUpward,
  PlayArrow,
  Stop
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import authService, { UserProfile } from '../services/authService';
import firestoreService, { Strategy } from '../services/firestoreService';
import axios from 'axios';
import Layout from '../components/Layout';
import apiService from '../services/apiService';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [algoRoomsBrokers, setAlgoRoomsBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marketData, setMarketData] = useState<Stock[]>([]);

  const loadAlgoRoomsBrokers = async () => {
    try {
      const userId = auth.currentUser?.uid;
      const brokersResponse = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/list${userId ? `?userId=${userId}` : ''}`);
      if (brokersResponse.data.success) {
        setAlgoRoomsBrokers(brokersResponse.data.brokers);
      }
    } catch (error) {
      console.error('Failed to load AlgoRooms brokers:', error);
      setAlgoRoomsBrokers([]);
    }
  };

  const loadMarketData = async () => {
    try {
      const response = await apiService.get<{ success: boolean; data: { stocks: Stock[]; indices: Stock[] } }>('/api/market/all');
      if (response.success) {
        const allData = [...(response.data.indices || []), ...(response.data.stocks || [])];
        setMarketData(allData.slice(0, 4)); // Top 4 for 2x2 grid
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAlgoRoomsBrokers(), loadMarketData()]);
    setRefreshing(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await authService.getUserProfile(firebaseUser.uid);
          setUser(profile);

          const strategiesData = await firestoreService.getStrategies(firebaseUser.uid);
          setStrategies(strategiesData);
          await Promise.all([loadAlgoRoomsBrokers(), loadMarketData()]);
        } catch (error) {
          console.error('Failed to load data:', error);
        }
      } else {
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!loading && user) {
      const interval = setInterval(() => {
        loadAlgoRoomsBrokers();
        loadMarketData();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [loading, user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f8fafc' }}>
        <CircularProgress />
      </Box>
    );
  }

  const liveStrategies = strategies.filter(s => s.status === 'live').length;
  const hasAlgoRoomsBroker = algoRoomsBrokers.length > 0;
  const connectedBrokers = algoRoomsBrokers.filter(b => b.status === 'Connected').length;
  const hasBrokerConnected = hasAlgoRoomsBroker && connectedBrokers > 0;

  return (
    <Layout>
      <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
        {/* Compact Header */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                Welcome, {user?.name || 'Trader'}! 👋
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
                {hasBrokerConnected 
                  ? `${connectedBrokers} broker${connectedBrokers > 1 ? 's' : ''} • ${liveStrategies} live strategies`
                  : 'Connect broker to start'}
              </Typography>
            </Box>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={handleRefresh} 
                disabled={refreshing}
                size="small"
                sx={{ bgcolor: 'white', boxShadow: 1, '&:hover': { bgcolor: '#f8fafc' } }}
              >
                <Refresh fontSize="small" sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </IconButton>
            </Tooltip>
          </Box>

          {!hasBrokerConnected && (
            <Alert 
              severity="warning" 
              sx={{ py: 0.5, px: 1.5, borderRadius: 1.5, fontSize: '0.8125rem' }}
              action={
                <Button size="small" onClick={() => navigate('/brokers')} sx={{ fontSize: '0.75rem', py: 0.25 }}>
                  Connect
                </Button>
              }
            >
              No broker connected
            </Alert>
          )}
        </Box>

        {/* Live Market Data - 2x2 Grid in One Row */}
        <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ShowChart sx={{ color: 'white', fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'white', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                LIVE MARKET
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#10b981', animation: 'pulse 2s infinite' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.65rem' }}>
                Real-time
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1 }}>
            {marketData.length > 0 ? marketData.map((stock) => (
              <Card 
                key={stock.symbol}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s',
                  '&:hover': { 
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 12px rgba(0,0,0,0.15)'
                  }
                }}
              >
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  {/* Name on Top */}
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#64748b', 
                      fontSize: '0.65rem',
                      display: 'block',
                      mb: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {stock.name}
                  </Typography>
                  
                  {/* Symbol and Trend Icon */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.8125rem' }}>
                      {stock.symbol}
                    </Typography>
                    {stock.change >= 0 ? (
                      <TrendingUp sx={{ fontSize: 16, color: '#10b981' }} />
                    ) : (
                      <TrendingDown sx={{ fontSize: 16, color: '#ef4444' }} />
                    )}
                  </Box>
                  
                  {/* Price */}
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.125rem', mb: 0.5, lineHeight: 1 }}>
                    ₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  
                  {/* Change Chip */}
                  <Chip
                    label={`${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} (${stock.changePercent.toFixed(2)}%)`}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: stock.change >= 0 ? '#dcfce7' : '#fee2e2',
                      color: stock.change >= 0 ? '#10b981' : '#ef4444',
                      border: 'none',
                      '& .MuiChip-label': {
                        px: 0.75
                      }
                    }}
                  />
                </CardContent>
              </Card>
            )) : (
              <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 2 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>
                  No market data available
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Compact Stats Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 1.5, p: 1 }}>
                  <AccountBalance sx={{ fontSize: 20 }} />
                </Box>
                <Chip label={hasBrokerConnected ? 'Active' : 'Off'} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.5 }}>Broker</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: '1.5rem' }}>{hasBrokerConnected ? connectedBrokers : 0}</Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ bgcolor: '#ede9fe', borderRadius: 1.5, p: 1, color: '#8b5cf6' }}>
                  <TrendingUp sx={{ fontSize: 20 }} />
                </Box>
                <Chip label={`${liveStrategies} Live`} size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>Strategies</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.5rem' }}>{strategies.length}</Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ bgcolor: '#dcfce7', borderRadius: 1.5, p: 1, color: '#10b981' }}>
                  <ArrowUpward sx={{ fontSize: 20 }} />
                </Box>
                <Chip label="+0%" size="small" sx={{ bgcolor: '#dcfce7', color: '#10b981', height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>Today P&L</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#10b981', fontSize: '1.5rem' }}>₹0</Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ bgcolor: '#fef3c7', borderRadius: 1.5, p: 1, color: '#f59e0b' }}>
                  <Assessment sx={{ fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>Win Rate</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.5rem' }}>0%</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Compact Quick Actions */}
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mb: 1.5 }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              size="small"
              startIcon={<ShowChart sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/trading-dashboard')}
              disabled={!hasBrokerConnected}
              sx={{ py: 1, fontSize: '0.8125rem', justifyContent: 'flex-start' }}
            >
              Trading
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<Add sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/strategies')}
              sx={{ py: 1, fontSize: '0.8125rem', justifyContent: 'flex-start' }}
            >
              Strategy
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<AccountBalance sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/brokers')}
              sx={{ py: 1, fontSize: '0.8125rem', justifyContent: 'flex-start' }}
            >
              Brokers
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<Assessment sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/portfolio')}
              sx={{ py: 1, fontSize: '0.8125rem', justifyContent: 'flex-start' }}
            >
              Portfolio
            </Button>
          </Box>
        </Paper>

        {/* Compact Strategies */}
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
              Deployed Strategies
            </Typography>
            <Button size="small" onClick={() => navigate('/strategies')} sx={{ fontSize: '0.75rem', py: 0.25 }}>
              View All
            </Button>
          </Box>

          {strategies.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <TrendingUp sx={{ fontSize: 24, color: '#94a3b8' }} />
              </Box>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>No strategies yet</Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 2 }}>Create your first strategy</Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/strategies')} size="small">
                Create Strategy
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
              {strategies.slice(0, 4).map((strategy) => (
                <Card key={strategy.id} variant="outlined" sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#6366f1', boxShadow: 2 } }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
                        {strategy.name}
                      </Typography>
                      <Chip
                        icon={strategy.status === 'live' ? <PlayArrow sx={{ fontSize: 12 }} /> : <Stop sx={{ fontSize: 12 }} />}
                        label={strategy.status}
                        color={strategy.status === 'live' ? 'success' : 'default'}
                        size="small"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1 }}>
                      {strategy.symbol} • {strategy.timeframe}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      <Chip label={`SL: ${strategy.stopLossPercent}%`} size="small" sx={{ bgcolor: '#fee2e2', color: '#dc2626', height: 20, fontSize: '0.7rem' }} />
                      <Chip label={`Target: ${strategy.targetPercent}%`} size="small" sx={{ bgcolor: '#dcfce7', color: '#10b981', height: 20, fontSize: '0.7rem' }} />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Paper>
      </Box>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Layout>
  );
};

export default Dashboard;
