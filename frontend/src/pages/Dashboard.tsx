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
  Divider
} from '@mui/material';
import { Add, TrendingUp, AccountBalance, ShowChart, Assessment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import authService, { UserProfile } from '../services/authService';
import firestoreService, { Strategy, Brokerage } from '../services/firestoreService';
import Layout from '../components/Layout';
import MarketData from '../components/MarketData';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await authService.getUserProfile(firebaseUser.uid);
          setUser(profile);
          
          // Load strategies and brokerages
          const [strategiesData, brokeragesData] = await Promise.all([
            firestoreService.getStrategies(firebaseUser.uid),
            firestoreService.getBrokerages(firebaseUser.uid)
          ]);
          
          setStrategies(strategiesData);
          setBrokerages(brokeragesData);
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const liveStrategies = strategies.filter(s => s.status === 'live').length;
  const hasBrokerage = brokerages.length > 0;

  return (
    <Layout>
      <Box>
        {/* Live Market Data - ONE Simple Component */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <ShowChart sx={{ mr: 1 }} />
            Live Market Data
          </Typography>
          <MarketData />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Welcome Banner */}
        <Paper
          sx={{
            p: 4,
            mb: 3,
            background: 'linear-gradient(135deg, #1a237e 0%, #1976d2 100%)',
            color: 'white',
            borderRadius: 2
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Hello {user?.name}!
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                {hasBrokerage 
                  ? 'Your account is connected and ready to trade'
                  : 'Connect your broker to start trading'}
              </Typography>
            </Box>
            {!hasBrokerage && (
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/brokerage')}
                sx={{
                  bgcolor: 'white',
                  color: '#1976d2',
                  '&:hover': { bgcolor: '#f5f5f5' }
                }}
                startIcon={<Add />}
              >
                Add Broker
              </Button>
            )}
          </Box>
        </Paper>

        {/* Alert if no brokerage */}
        {!hasBrokerage && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>No broker connected!</strong> Please link your Dhan account to start trading.
            </Typography>
          </Alert>
        )}

        {/* Stats Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mb: 3 }}>
          <Card sx={{ borderLeft: '4px solid #4caf50' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" variant="body2" gutterBottom>
                    Broker Status
                  </Typography>
                  <Typography variant="h5">
                    {hasBrokerage ? 'Connected' : 'Not Connected'}
                  </Typography>
                  <Chip
                    label={hasBrokerage ? 'Active' : 'Inactive'}
                    color={hasBrokerage ? 'success' : 'default'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <AccountBalance sx={{ fontSize: 48, color: hasBrokerage ? '#4caf50' : '#ccc' }} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ borderLeft: '4px solid #2196f3' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" variant="body2" gutterBottom>
                    Active Strategies
                  </Typography>
                  <Typography variant="h5">
                    {liveStrategies}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    {strategies.length} total strategies
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 48, color: '#2196f3' }} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ borderLeft: '4px solid #ff9800' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography color="textSecondary" variant="body2" gutterBottom>
                    Today's P&L
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    ₹0.00
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    {hasBrokerage ? 'No trades today' : 'Connect broker to see P&L'}
                  </Typography>
                </Box>
                <Assessment sx={{ fontSize: 48, color: '#ff9800' }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Quick Actions */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => navigate('/strategies')}
            >
              Create Strategy
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/brokerage')}
            >
              {hasBrokerage ? 'Manage Brokers' : 'Link Broker'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/portfolio')}
            >
              View Portfolio
            </Button>
          </Box>
        </Paper>

        {/* Deployed Strategies */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Deployed Strategies
            </Typography>
            <Button
              size="small"
              onClick={() => navigate('/strategies')}
            >
              View All
            </Button>
          </Box>

          {strategies.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary" gutterBottom>
                No strategies deployed yet
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/strategies')}
                sx={{ mt: 2 }}
              >
                Create Strategy
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              {strategies.slice(0, 4).map((strategy) => (
                <Card key={strategy.id} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                        {strategy.name}
                      </Typography>
                      <Chip
                        label={strategy.status}
                        color={strategy.status === 'live' ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {strategy.symbol} • {strategy.timeframe}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Chip label={`SL: ${strategy.stopLossPercent}%`} size="small" />
                      <Chip label={`Target: ${strategy.targetPercent}%`} size="small" />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Layout>
  );
};

export default Dashboard;
