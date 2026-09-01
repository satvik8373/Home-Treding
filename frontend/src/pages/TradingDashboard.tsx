import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import {
  AccountBalance,
  ShowChart,
  TrendingUp,
  ReceiptLong,
  PlayArrow,
  Stop
} from '@mui/icons-material';
import Layout from '../components/Layout';
import RealTimeMarketData from '../components/RealTimeMarketData';
import OrderManagement from '../components/OrderManagement';
import PortfolioDashboard from '../components/PortfolioDashboard';
import { PageHeader, StatCard, StatusBadge } from '../components/ui';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const TradingDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [brokers, setBrokers] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [engineRes, brokersRes] = await Promise.all([
        axios.get(`${API_CONFIG.BASE_URL}/api/trading/engine/status`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/brokers/list`).catch(() => ({ data: { success: false, brokers: [] } }))
      ]);

      if (engineRes.data?.success) {
        setEngineStatus(engineRes.data);
      }
      if (brokersRes.data?.success) {
        setBrokers(brokersRes.data.brokers || []);
      }
    } catch (err) {
      // Handled
    }
  };

  const handleEngineToggle = async () => {
    try {
      const action = engineStatus?.isRunning ? 'stop' : 'start';
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/trading/engine/${action}`);
      if (res.data?.success) {
        await loadDashboardData();
      }
    } catch (e) {
      // Handled
    }
  };

  const connectedBrokers = brokers.filter(b => b.status === 'Connected');
  const activeBroker = connectedBrokers.length > 0 ? connectedBrokers[0] : null;

  return (
    <Layout>
      <Box sx={{ maxWidth: '100%' }}>
        {/* Unified Page Header */}
        <PageHeader
          title="Trading Terminal"
          subtitle="Real-time order execution, level 2 market feed, and position monitor"
          badge={
            <StatusBadge
              status={engineStatus?.isRunning ? 'live' : 'stopped'}
              dot
              pulse
              label={engineStatus?.isRunning ? 'ENGINE ACTIVE' : 'ENGINE PAUSED'}
            />
          }
          action={
            <Button
              variant="contained"
              size="small"
              startIcon={engineStatus?.isRunning ? <Stop sx={{ fontSize: 16 }} /> : <PlayArrow sx={{ fontSize: 16 }} />}
              onClick={handleEngineToggle}
              sx={{
                bgcolor: engineStatus?.isRunning ? '#dc2626' : '#16a34a',
                color: '#ffffff',
                borderRadius: 2,
                fontWeight: 700,
                fontSize: '0.8rem',
                textTransform: 'none',
                px: 2,
                '&:hover': { bgcolor: engineStatus?.isRunning ? '#b91c1c' : '#15803d' }
              }}
            >
              {engineStatus?.isRunning ? 'Pause Engine' : 'Resume Engine'}
            </Button>
          }
        />

        {/* Minimalist Metrics Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <StatCard
            label="Trading Mode"
            value="Paper Forward"
            subtext="Zero Capital Risk"
            icon={<ShowChart sx={{ fontSize: 18 }} />}
          />

          <StatCard
            label="Broker Status"
            value={connectedBrokers.length > 0 ? 'Dhan Connected' : 'Paper Only'}
            subtext={activeBroker?.maskedClientId || 'Virtual Ledger'}
            icon={<AccountBalance sx={{ fontSize: 18 }} />}
          />

          <StatCard
            label="Kill Switch"
            value={engineStatus?.killSwitch?.isHalted ? 'HALTED' : 'NORMAL'}
            subtext="Risk Engine Guard"
            color={engineStatus?.killSwitch?.isHalted ? '#dc2626' : '#16a34a'}
            icon={<TrendingUp sx={{ fontSize: 18 }} />}
          />

          <StatCard
            label="Live Data Stream"
            value="800ms Ticks"
            subtext="Sub-Second Latency"
            icon={<ReceiptLong sx={{ fontSize: 18 }} />}
          />
        </Box>

        {/* Main Tabbed Container */}
        <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={(_, val) => setTabValue(val)}
            sx={{
              borderBottom: '1px solid #f1f5f9',
              bgcolor: '#f8fafc',
              px: 2,
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: '0.82rem',
                textTransform: 'none',
                minHeight: 48,
                color: '#64748b',
                '&.Mui-selected': { color: '#0f172a' }
              }
            }}
          >
            <Tab label="Live Market Data" />
            <Tab label="Order Management" />
            <Tab label="Active Positions" />
          </Tabs>

          <Box sx={{ p: tabValue === 0 ? 0 : 2.5 }}>
            {tabValue === 0 && <RealTimeMarketData />}
            {tabValue === 1 && <OrderManagement brokerId={activeBroker?.id} />}
            {tabValue === 2 && <PortfolioDashboard />}
          </Box>
        </Paper>
      </Box>
    </Layout>
  );
};

export default TradingDashboard;