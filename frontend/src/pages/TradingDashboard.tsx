import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Chip,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  AccountBalance,
  ShowChart,
  Settings,
  PlayArrow,
  Stop
} from '@mui/icons-material';
import Layout from '../components/Layout';
import RealTimeMarketData from '../components/RealTimeMarketData';
import OrderManagement from '../components/OrderManagement';
import PortfolioDashboard from '../components/PortfolioDashboard';
import axios from 'axios';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`trading-tabpanel-${index}`}
      aria-labelledby={`trading-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface TradingEngineStatus {
  isRunning: boolean;
  connectedBrokers: number;
  activeOrders: number;
  positions: number;
  marketDataFeeds: number;
}

const TradingDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [engineStatus, setEngineStatus] = useState<TradingEngineStatus | null>(null);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [engineResponse, brokersResponse] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/engine/status`).catch(() => ({ data: { success: false } })),
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/list`)
      ]);

      if (engineResponse.data.success) {
        setEngineStatus(engineResponse.data.status);
      }

      if (brokersResponse.data.success) {
        setBrokers(brokersResponse.data.brokers || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const handleEngineToggle = async () => {
    try {
      const action = engineStatus?.isRunning ? 'stop' : 'start';
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/engine/${action}`);
      
      if (response.data.success) {
        await loadDashboardData();
      }
    } catch (error: any) {
      console.error('Failed to toggle trading engine:', error);
      setError(error.response?.data?.message || 'Failed to toggle trading engine');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const connectedBrokers = brokers.filter(b => b.status === 'Connected');
  const activeBroker = connectedBrokers.length > 0 ? connectedBrokers[0] : null;

  return (
    <Layout>
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1">
              🎯 Trading Dashboard
            </Typography>
            
            {engineStatus && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={engineStatus.isRunning ? 'Engine Running' : 'Engine Stopped'}
                  color={engineStatus.isRunning ? 'success' : 'default'}
                  icon={engineStatus.isRunning ? <PlayArrow /> : <Stop />}
                />
                <Button
                  variant={engineStatus.isRunning ? 'outlined' : 'contained'}
                  color={engineStatus.isRunning ? 'error' : 'success'}
                  startIcon={engineStatus.isRunning ? <Stop /> : <PlayArrow />}
                  onClick={handleEngineToggle}
                >
                  {engineStatus.isRunning ? 'Stop Engine' : 'Start Engine'}
                </Button>
              </Box>
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Status Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AccountBalance color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Brokers</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {connectedBrokers.length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Connected & Ready
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ShowChart color="info" sx={{ mr: 1 }} />
                  <Typography variant="h6">Active Orders</Typography>
                </Box>
                <Typography variant="h4" color="info.main">
                  {engineStatus?.activeOrders || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  In the market
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUp color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6">Positions</Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  {engineStatus?.positions || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Open positions
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Settings color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">Data Feeds</Typography>
                </Box>
                <Typography variant="h4" color="warning.main">
                  {engineStatus?.marketDataFeeds || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Live streams
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Main Content Tabs */}
          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="trading dashboard tabs">
                <Tab label="Market Data" />
                <Tab label="Orders" />
                <Tab label="Portfolio" />
                <Tab label="Strategies" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <RealTimeMarketData />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <OrderManagement brokerId={activeBroker?.id} />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <PortfolioDashboard />
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Strategy Management
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Advanced strategy management features coming soon
                </Typography>
                <Button variant="outlined" disabled>
                  Create Strategy
                </Button>
              </Box>
            </TabPanel>
          </Paper>

          {/* Connection Status */}
          {connectedBrokers.length === 0 && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              <Typography variant="body2">
                <strong>No brokers connected!</strong> Please connect your broker account to start trading.
                <Button 
                  size="small" 
                  sx={{ ml: 2 }} 
                  onClick={() => window.location.href = '/brokers'}
                >
                  Connect Broker
                </Button>
              </Typography>
            </Alert>
          )}
        </Box>
      </Container>
    </Layout>
  );
};

export default TradingDashboard;