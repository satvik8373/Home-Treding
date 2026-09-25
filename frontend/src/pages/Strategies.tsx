import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  IconButton,
  Checkbox,
  FormControlLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Refresh,
  MoreVert,
  Delete,
  ContentCopy,
  Edit,
  KeyboardArrowDown,
  KeyboardArrowUp,
  AccessTime,
  Bolt
} from '@mui/icons-material';
import Layout from '../components/Layout';
import { EmptyState } from '../components/ui';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

export interface StrategyLeg {
  id: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  strike: string;
  optionType: 'CE' | 'PE';
  quantity: number;
  slType?: 'percentage' | 'points';
  slValue?: number;
  targetType?: 'percentage' | 'points';
  targetValue?: number;
}

export interface CustomStrategy {
  id: string;
  name: string;
  author: string;
  description?: string;
  segmentType: 'OPTION' | 'EQUITY' | 'FUTURES';
  strategyType: 'Time Based' | 'Indicator Based' | 'Breakout / Trigger';
  symbol: string;
  startTime: string;
  endTime: string;
  tradingDays: string[];
  legs: StrategyLeg[];
  maxLoss?: number;
  maxProfit?: number;
  trailingSl?: string;
  createdAt: string;
  status: 'draft' | 'active';
}

export interface StrategyPosition {
  id: string;
  script: string;
  transaction: string;
  entryPrice: number;
  sl: number;
  target: number;
  exitPrice: number;
  ltp: number;
  timeStamp: string;
  entryTime: string;
  exitTime: string;
  pnl: number;
  status: 'EXECUTED' | 'OPEN' | 'CLOSED' | 'REJECTED';
}

export interface DeployedStrategy {
  deploymentId: string;
  strategyId: string;
  name: string;
  symbol: string;
  templateType: string;
  mode: 'paper' | 'live';
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  qtyMultiplier: number;
  maxProfit: number;
  maxLoss: number;
  deployedAt: string;
  lastTriggerAt?: string;
  tradesExecuted: number;
  pnl: number;
  positions?: StrategyPosition[];
}

export const Strategies: React.FC = () => {
  const navigate = useNavigate();

  // Tabs: 0 = My Strategies, 1 = Deployed Strategies (Strategy Templates removed per request)
  const [tabValue, setTabValue] = useState(0);

  // Data states
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>([]);
  const [activeDeployments, setActiveDeployments] = useState<DeployedStrategy[]>([]);
  const [connectedBroker, setConnectedBroker] = useState<{ id: string; name: string; clientId: string }>({
    id: 'dhan_primary',
    name: 'DHAN',
    clientId: '1108893841'
  });
  const [isTradeEngineRunning, setIsTradeEngineRunning] = useState(false);
  const [expandedDeployments, setExpandedDeployments] = useState<Record<string, boolean>>({});

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Custom Strategy Context Menu
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuStrategy, setMenuStrategy] = useState<CustomStrategy | null>(null);

  // Deployed Strategy Context Menu
  const [depMenuAnchor, setDepMenuAnchor] = useState<null | HTMLElement>(null);
  const [depMenuSelected, setDepMenuSelected] = useState<DeployedStrategy | null>(null);

  // Deploy Dialog State (Matching Screenshot 2)
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployTargetStrategy, setDeployTargetStrategy] = useState<any | null>(null);
  const [deploymentType, setDeploymentType] = useState<'Live' | 'Forward Test'>('Forward Test');
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>(['dhan_primary']);
  const [deployQtyMultiplier, setDeployQtyMultiplier] = useState<number>(1);
  const [deployMaxProfit, setDeployMaxProfit] = useState<number | string>(0);
  const [deployMaxLoss, setDeployMaxLoss] = useState<number | string>(2500);
  const [autoSquareOffTime, setAutoSquareOffTime] = useState<string>('15:15');
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [customRes, activeRes, engineRes, brokersRes] = await Promise.all([
        axios.get(`${API_CONFIG.BASE_URL}/api/strategies`).catch(() => ({ data: { success: false, strategies: [] } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/strategies/active`).catch(() => ({ data: { success: false, deployments: [] } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/trading/engine/status`).catch(() => ({ data: { success: false, isRunning: false } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/brokers/list`).catch(() => ({ data: { success: false, brokers: [] } }))
      ]);

      if (customRes.data?.success && customRes.data?.strategies) {
        setCustomStrategies(customRes.data.strategies);
      }
      if (activeRes.data?.success && activeRes.data?.deployments) {
        setActiveDeployments(activeRes.data.deployments);
      }
      if (engineRes.data?.success) {
        setIsTradeEngineRunning(Boolean(engineRes.data.isRunning));
      }
      if (brokersRes.data?.success && brokersRes.data?.brokers?.length > 0) {
        const b = brokersRes.data.brokers[0];
        setConnectedBroker({
          id: b.id,
          name: b.broker || 'DHAN',
          clientId: b.clientId || '1108893841'
        });
      } else {
        setConnectedBroker({
          id: 'dhan_primary',
          name: 'DHAN',
          clientId: '1108893841'
        });
      }
    } catch (err) {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Deploy Modal (Screenshot 2)
  const handleOpenDeployModal = (strategy: any) => {
    setDeployTargetStrategy(strategy);
    setDeploymentType('Forward Test');
    setSelectedBrokers(['dhan_primary']);
    setDeployQtyMultiplier(1);
    setDeployMaxProfit(strategy.maxProfit || 0);
    setDeployMaxLoss(strategy.maxLoss || 2500);
    setAutoSquareOffTime(strategy.endTime || '15:15');
    setAcceptTerms(false);
    setDeployModalOpen(true);
  };

  // Submit Deployment
  const handleConfirmDeploy = async () => {
    if (!acceptTerms) return;
    const name = deployTargetStrategy?.name || 'Automated Strategy';
    const stratId = deployTargetStrategy?.id || 'nifty-009-atm-breakout';
    const symbol = deployTargetStrategy?.symbol || 'NIFTY 50';

    try {
      setActionLoading(true);
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/deploy`, {
        strategyId: stratId,
        name,
        symbol,
        templateType: stratId,
        qtyMultiplier: Number(deployQtyMultiplier) || 1,
        maxProfit: Number(deployMaxProfit) || 0,
        maxLoss: Number(deployMaxLoss) || 2500,
        squareOff: autoSquareOffTime,
        type: deploymentType === 'Live' ? 'live' : 'paper'
      });

      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: res.data.message });
        setDeployModalOpen(false);
        setDeployTargetStrategy(null);
        await loadData();
        // Immediately switch to "Deployed Strategies" tab to view deployed strategy!
        setTabValue(1);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Deployment failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Trade Engine (Started / Stopped)
  const handleToggleTradeEngine = async () => {
    const next = !isTradeEngineRunning;
    setIsTradeEngineRunning(next);
    try {
      if (next) {
        await axios.post(`${API_CONFIG.BASE_URL}/api/trading/engine/start`);
        setStatusMessage({ type: 'success', text: 'Trade Engine activated and running.' });
      } else {
        await axios.post(`${API_CONFIG.BASE_URL}/api/trading/engine/stop`);
        setStatusMessage({ type: 'success', text: 'Trade Engine stopped.' });
      }
    } catch (e: any) {
      setIsTradeEngineRunning(!next);
      setStatusMessage({ type: 'error', text: 'Failed to update Trade Engine state.' });
    }
  };

  // Toggle Deployment Mode: Paper <-> Live
  const handleToggleDeploymentMode = async (deploymentId: string, currentMode: 'paper' | 'live') => {
    const nextMode = currentMode === 'live' ? 'paper' : 'live';
    try {
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/deployment/${deploymentId}/mode`, { mode: nextMode });
      if (res.data?.success) {
        setActiveDeployments(prev => prev.map(d => d.deploymentId === deploymentId ? { ...d, mode: nextMode } : d));
      }
    } catch (e) {
      // Ignored
    }
  };

  // Toggle Deployment Status: RUNNING <-> PAUSED
  const handleToggleDeploymentStatus = async (deploymentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    try {
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/deployment/${deploymentId}/status`, { status: nextStatus });
      if (res.data?.success) {
        setActiveDeployments(prev => prev.map(d => d.deploymentId === deploymentId ? { ...d, status: nextStatus as any } : d));
      }
    } catch (e) {
      // Ignored
    }
  };

  // Square Off Deployment
  const handleSquareOffDeployment = async (deploymentId: string) => {
    try {
      setActionLoading(true);
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/deployment/${deploymentId}/squareoff`);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: res.data.message });
        await loadData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Square Off failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Deployment
  const handleDeleteDeployment = async (deploymentId: string) => {
    if (!window.confirm('Are you sure you want to remove this deployment?')) return;
    try {
      setActionLoading(true);
      await axios.delete(`${API_CONFIG.BASE_URL}/api/strategies/deployment/${deploymentId}`);
      setStatusMessage({ type: 'success', text: 'Deployment removed successfully.' });
      await loadData();
    } catch (err) {
      // Ignored
    } finally {
      setActionLoading(false);
      setDepMenuAnchor(null);
    }
  };

  // Toggle row expand for Positions table
  const toggleExpandDeployment = (deploymentId: string) => {
    setExpandedDeployments(prev => ({
      ...prev,
      [deploymentId]: !prev[deploymentId]
    }));
  };

  // Duplicate Strategy
  const handleDuplicateStrategy = async (strat: CustomStrategy) => {
    try {
      setActionLoading(true);
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/duplicate/${strat.id}`);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: `Duplicated "${strat.name}" as "${res.data.strategy.name}"` });
        await loadData();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to duplicate strategy' });
    } finally {
      setActionLoading(false);
      setMenuAnchor(null);
    }
  };

  // Delete Strategy
  const handleDeleteStrategy = async (strat: CustomStrategy) => {
    if (!window.confirm(`Are you sure you want to delete strategy "${strat.name}"?`)) return;
    try {
      setActionLoading(true);
      const res = await axios.delete(`${API_CONFIG.BASE_URL}/api/strategies/${strat.id}`);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: `Strategy "${strat.name}" deleted.` });
        await loadData();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to delete strategy' });
    } finally {
      setActionLoading(false);
      setMenuAnchor(null);
    }
  };

  // Broker Aggregated Stats
  const runningCount = activeDeployments.filter(d => d.status === 'RUNNING').length;
  const deployedCount = activeDeployments.length;
  const totalPnL = activeDeployments.reduce((acc, d) => acc + (d.pnl || 0), 0);

  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        {/* Notification Banner */}
        {statusMessage && (
          <Alert
            severity={statusMessage.type}
            onClose={() => setStatusMessage(null)}
            sx={{ mb: 2.5, borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            {statusMessage.text}
          </Alert>
        )}

        {/* Top Navigation Tabs Header: My Strategies & Deployed Strategies */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
            borderBottom: '1px solid #e2e8f0',
            pb: 0.5
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(_, val) => setTabValue(val)}
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': {
                backgroundColor: '#2563eb',
                height: 2.5
              }
            }}
          >
            <Tab
              disableRipple
              label="My Strategies"
              sx={{
                textTransform: 'none',
                fontWeight: tabValue === 0 ? 700 : 500,
                fontSize: '0.9rem',
                color: tabValue === 0 ? '#2563eb' : '#64748b',
                minWidth: 'auto',
                px: 2,
                py: 1
              }}
            />
            <Tab
              disableRipple
              label="Deployed Strategies"
              sx={{
                textTransform: 'none',
                fontWeight: tabValue === 1 ? 700 : 500,
                fontSize: '0.9rem',
                color: tabValue === 1 ? '#2563eb' : '#64748b',
                minWidth: 'auto',
                px: 2,
                py: 1
              }}
            />
          </Tabs>

          <Button
            size="small"
            startIcon={<Refresh sx={{ fontSize: 16 }} />}
            onClick={loadData}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.82rem',
              color: '#2563eb',
              '&:hover': { bgcolor: '#eff6ff' }
            }}
          >
            Refresh
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={30} sx={{ color: '#2563eb' }} />
          </Box>
        ) : (
          <>
            {/* ======================================================== */}
            {/* TAB 0: MY STRATEGIES                                      */}
            {/* ======================================================== */}
            {tabValue === 0 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                    Available Strategies ({customStrategies.length})
                  </Typography>

                  <Button
                    variant="contained"
                    onClick={() => navigate('/strategies/create')}
                    sx={{
                      bgcolor: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      textTransform: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none',
                      px: 2,
                      py: 0.8,
                      '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                    }}
                  >
                    + Create Strategy
                  </Button>
                </Box>

                {customStrategies.length === 0 ? (
                  <EmptyState
                    title="No Custom Strategies Yet"
                    description="Build your algorithmic trading logic and deploy it directly."
                    actionLabel="Create Strategy"
                    onAction={() => navigate('/strategies/create')}
                  />
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                    {customStrategies.map(strat => (
                      <Paper
                        key={strat.id}
                        sx={{
                          p: 2.5,
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          bgcolor: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'border-color 0.2s ease',
                          '&:hover': { borderColor: '#cbd5e1' }
                        }}
                      >
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                            <Box>
                              <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', lineHeight: 1.2 }}>
                                {strat.name}
                              </Typography>
                              <Typography sx={{ color: '#64748b', fontSize: '0.78rem', mt: 0.3 }}>
                                By {strat.author || 'User'}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setMenuAnchor(e.currentTarget);
                                setMenuStrategy(strat);
                              }}
                              sx={{ color: '#94a3b8', '&:hover': { color: '#0f172a' } }}
                            >
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </Box>

                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, my: 2, bgcolor: '#f8fafc', p: 1.5, borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                                {strat.startTime || '09:20'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                                Start Time
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                                {strat.endTime || '15:15'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                                End Time
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                                {strat.symbol || 'NIFTY 50'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                                Symbol
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                                {strat.segmentType || 'OPTION'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                                Segment
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                          <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate(`/backtest?strategyId=${strat.id}`)}
                            sx={{
                              borderColor: '#e2e8f0',
                              color: '#0f172a',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              textTransform: 'none',
                              borderRadius: '8px',
                              py: 0.8,
                              '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }
                            }}
                          >
                            Backtest
                          </Button>
                          <Button
                            variant="contained"
                            fullWidth
                            onClick={() => handleOpenDeployModal(strat)}
                            sx={{
                              bgcolor: '#2563eb',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              textTransform: 'none',
                              borderRadius: '8px',
                              py: 0.8,
                              boxShadow: 'none',
                              '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                            }}
                          >
                            Deploy
                          </Button>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* ======================================================== */}
            {/* TAB 1: DEPLOYED STRATEGIES (Screenshots 3 & 4)            */}
            {/* ======================================================== */}
            {tabValue === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Top Broker Banner Card with Dhan Branding (Screenshot 3) */}
                <Box
                  sx={{
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    p: { xs: 2, sm: 2.5 },
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    gap: 2
                  }}
                >
                  {/* Left: Dhan Logo + DHAN (1108893841) + Badges */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: '10px',
                        bgcolor: '#00A25B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '1.25rem',
                        fontFamily: 'serif',
                        flexShrink: 0
                      }}
                    >
                      ध
                    </Box>

                    <Box>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>
                        Broker
                      </Typography>
                      <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                        {connectedBroker.name} ({connectedBroker.clientId})
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
                      <Box
                        sx={{
                          px: 1.2,
                          py: 0.3,
                          borderRadius: '6px',
                          bgcolor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          color: '#475569',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}
                      >
                        Running {runningCount}
                      </Box>
                      <Box
                        sx={{
                          px: 1.2,
                          py: 0.3,
                          borderRadius: '6px',
                          bgcolor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          color: '#475569',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}
                      >
                        Deployed {deployedCount}
                      </Box>
                    </Box>
                  </Box>

                  {/* Center: TRADE ENGINE Segmented Switch */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                      TRADE ENGINE
                    </Typography>
                    <Box
                      onClick={handleToggleTradeEngine}
                      sx={{
                        display: 'flex',
                        bgcolor: '#e2e8f0',
                        borderRadius: '20px',
                        p: '3px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Box
                        sx={{
                          px: 1.8,
                          py: 0.4,
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          bgcolor: !isTradeEngineRunning ? '#ffffff' : 'transparent',
                          color: !isTradeEngineRunning ? '#0f172a' : '#64748b',
                          boxShadow: !isTradeEngineRunning ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Stopped
                      </Box>
                      <Box
                        sx={{
                          px: 1.8,
                          py: 0.4,
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          bgcolor: isTradeEngineRunning ? '#ffffff' : 'transparent',
                          color: isTradeEngineRunning ? '#16a34a' : '#64748b',
                          boxShadow: isTradeEngineRunning ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Running
                      </Box>
                    </Box>
                  </Box>

                  {/* Right: PnL, Expand Arrow, 3 dots */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                        PnL
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: totalPnL >= 0 ? '#16a34a' : '#dc2626'
                        }}
                      >
                        ₹{totalPnL.toFixed(2)}
                      </Typography>
                    </Box>

                    <IconButton size="small" sx={{ color: '#64748b' }}>
                      <KeyboardArrowUp fontSize="small" />
                    </IconButton>

                    <IconButton size="small" sx={{ color: '#94a3b8' }}>
                      <MoreVert fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {/* Deployed Strategies List */}
                {activeDeployments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, bgcolor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <Typography sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem', mb: 1 }}>
                      No active strategy deployments.
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mb: 2 }}>
                      Click on "My Strategies" and deploy your strategy in paper or live mode.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => setTabValue(0)}
                      sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Browse My Strategies
                    </Button>
                  </Box>
                ) : (
                  activeDeployments.map(dep => {
                    const isExpanded = expandedDeployments[dep.deploymentId] ?? true;
                    const isRunning = dep.status === 'RUNNING';
                    const isLive = dep.mode === 'live';

                    return (
                      <Box
                        key={dep.deploymentId}
                        sx={{
                          bgcolor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          transition: 'border-color 0.2s ease',
                          '&:hover': { borderColor: '#cbd5e1' }
                        }}
                      >
                        {/* Strategy Row Header (Matching Screenshot 3) */}
                        <Box
                          sx={{
                            p: { xs: 2, sm: 2.5 },
                            display: 'flex',
                            flexDirection: { xs: 'column', lg: 'row' },
                            alignItems: { xs: 'flex-start', lg: 'center' },
                            justifyContent: 'space-between',
                            gap: 2
                          }}
                        >
                          {/* Name + Paper/Live Tag */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 240 }}>
                            <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                              {dep.name}
                            </Typography>
                            <Box
                              sx={{
                                px: 1,
                                py: 0.2,
                                borderRadius: '4px',
                                bgcolor: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}
                            >
                              {isLive ? 'Live' : 'Paper'}
                            </Box>
                          </Box>

                          {/* Max Profit */}
                          <Box sx={{ textAlign: { xs: 'left', lg: 'center' } }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                              Max Profit
                            </Typography>
                            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                              {dep.maxProfit || 0}
                            </Typography>
                          </Box>

                          {/* Max Loss */}
                          <Box sx={{ textAlign: { xs: 'left', lg: 'center' } }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                              Max Loss
                            </Typography>
                            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                              {dep.maxLoss || 2500}
                            </Typography>
                          </Box>

                          {/* MODE Pill Toggle */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em' }}>
                              MODE
                            </Typography>
                            <Box
                              onClick={() => handleToggleDeploymentMode(dep.deploymentId, dep.mode)}
                              sx={{
                                display: 'flex',
                                bgcolor: '#f1f5f9',
                                borderRadius: '16px',
                                p: '2px',
                                cursor: 'pointer',
                                userSelect: 'none'
                              }}
                            >
                              <Box
                                sx={{
                                  px: 1.4,
                                  py: 0.3,
                                  borderRadius: '14px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  bgcolor: !isLive ? '#ffffff' : 'transparent',
                                  color: !isLive ? '#0f172a' : '#94a3b8',
                                  boxShadow: !isLive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                                }}
                              >
                                Paper
                              </Box>
                              <Box
                                sx={{
                                  px: 1.4,
                                  py: 0.3,
                                  borderRadius: '14px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  bgcolor: isLive ? '#ffffff' : 'transparent',
                                  color: isLive ? '#2563eb' : '#94a3b8',
                                  boxShadow: isLive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                                }}
                              >
                                Live
                              </Box>
                            </Box>
                          </Box>

                          {/* STATUS Pill Toggle */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em' }}>
                              STATUS
                            </Typography>
                            <Box
                              onClick={() => handleToggleDeploymentStatus(dep.deploymentId, dep.status)}
                              sx={{
                                display: 'flex',
                                bgcolor: '#f1f5f9',
                                borderRadius: '16px',
                                p: '2px',
                                cursor: 'pointer',
                                userSelect: 'none'
                              }}
                            >
                              <Box
                                sx={{
                                  px: 1.4,
                                  py: 0.3,
                                  borderRadius: '14px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  bgcolor: !isRunning ? '#ffffff' : 'transparent',
                                  color: !isRunning ? '#dc2626' : '#94a3b8',
                                  boxShadow: !isRunning ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                                }}
                              >
                                Paused
                              </Box>
                              <Box
                                sx={{
                                  px: 1.4,
                                  py: 0.3,
                                  borderRadius: '14px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  bgcolor: isRunning ? '#ffffff' : 'transparent',
                                  color: isRunning ? '#16a34a' : '#94a3b8',
                                  boxShadow: isRunning ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                                }}
                              >
                                Running
                              </Box>
                            </Box>
                          </Box>

                          {/* Square Off Button (Soft salmon with red text) */}
                          <Button
                            size="small"
                            onClick={() => handleSquareOffDeployment(dep.deploymentId)}
                            disabled={actionLoading}
                            sx={{
                              bgcolor: '#fee2e2',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'none',
                              borderRadius: '6px',
                              px: 1.8,
                              py: 0.6,
                              boxShadow: 'none',
                              '&:hover': { bgcolor: '#fecaca', boxShadow: 'none' }
                            }}
                          >
                            Square Off
                          </Button>

                          {/* PnL Value */}
                          <Box sx={{ textAlign: { xs: 'left', lg: 'right' }, minWidth: 70 }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                              PnL
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                color: (dep.pnl ?? 0) >= 0 ? '#16a34a' : '#dc2626'
                              }}
                            >
                              ₹{dep.pnl !== undefined ? dep.pnl.toFixed(2) : '0.00'}
                            </Typography>
                          </Box>

                          {/* Action icons: Chevron expand & 3-dots */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => toggleExpandDeployment(dep.deploymentId)}
                              sx={{ color: '#64748b' }}
                            >
                              {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setDepMenuAnchor(e.currentTarget);
                                setDepMenuSelected(dep);
                              }}
                              sx={{ color: '#94a3b8', '&:hover': { color: '#0f172a' } }}
                            >
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>

                        {/* Expanded Positions Table (Screenshot 4) */}
                        {isExpanded && (
                          <Box sx={{ p: { xs: 2, sm: 2.5 }, pt: 1, borderTop: '1px solid #f1f5f9' }}>
                            <Typography sx={{ color: '#ea580c', fontWeight: 700, fontSize: '0.85rem', mb: 1.5 }}>
                              Positions
                            </Typography>

                            {dep.positions && dep.positions.length > 0 ? (
                              <Box sx={{ overflowX: 'auto' }}>
                                <Table size="small" sx={{ minWidth: 850 }}>
                                  <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, py: 1 } }}>
                                      <TableCell>Script</TableCell>
                                      <TableCell>Transaction</TableCell>
                                      <TableCell>Entry Price</TableCell>
                                      <TableCell>SL</TableCell>
                                      <TableCell>Target</TableCell>
                                      <TableCell>Exit Price</TableCell>
                                      <TableCell>LTP</TableCell>
                                      <TableCell>Time Stamp</TableCell>
                                      <TableCell>Entry Time</TableCell>
                                      <TableCell>Exit Time</TableCell>
                                      <TableCell>PNL</TableCell>
                                      <TableCell>Status</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {dep.positions.map(pos => {
                                      const isSell = pos.transaction.toUpperCase().includes('SELL');
                                      const isProfit = pos.pnl >= 0;

                                      return (
                                        <TableRow key={pos.id} sx={{ '& td': { borderBottom: '1px solid #f8fafc', py: 1.2, fontSize: '0.78rem' } }}>
                                          <TableCell sx={{ fontWeight: 600, color: '#0f172a' }}>
                                            {pos.script}
                                          </TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: isSell ? '#dc2626' : '#16a34a' }}>
                                            {pos.transaction}
                                          </TableCell>
                                          <TableCell sx={{ color: '#334155' }}>{pos.entryPrice.toFixed(2)}</TableCell>
                                          <TableCell sx={{ color: '#64748b' }}>{pos.sl.toFixed(2)}</TableCell>
                                          <TableCell sx={{ color: '#64748b' }}>{pos.target.toFixed(2)}</TableCell>
                                          <TableCell sx={{ color: '#64748b' }}>{pos.exitPrice.toFixed(2)}</TableCell>
                                          <TableCell sx={{ color: '#0f172a', fontWeight: 600 }}>{pos.ltp.toFixed(2)}</TableCell>
                                          <TableCell sx={{ color: '#64748b' }}>{pos.timeStamp}</TableCell>
                                          <TableCell sx={{ color: '#64748b' }}>{pos.entryTime}</TableCell>
                                          <TableCell sx={{ color: '#64748b' }}>{pos.exitTime}</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: isProfit ? '#16a34a' : '#dc2626' }}>
                                            {pos.pnl.toFixed(2)}
                                          </TableCell>
                                          <TableCell>
                                            <Box
                                              component="span"
                                              sx={{
                                                fontWeight: 700,
                                                fontSize: '0.7rem',
                                                color: pos.status === 'EXECUTED' ? '#475569' : '#94a3b8'
                                              }}
                                            >
                                              {pos.status}
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </Box>
                            ) : (
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', py: 1 }}>
                                No open positions today. Strategy engine is active and monitoring market signals.
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })
                )}
              </Box>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* DEPLOY STRATEGY POPUP MODAL (Matching Screenshot 2)      */}
        {/* ======================================================== */}
        <Dialog
          open={deployModalOpen}
          onClose={() => setDeployModalOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '16px',
              p: { xs: 2.5, sm: 3.5 },
              maxWidth: 520,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)'
            }
          }}
        >
          {/* Header: Title + Close Button */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.25rem' }}>
              Deploy Strategy
            </Typography>
            <Button
              onClick={() => setDeployModalOpen(false)}
              sx={{
                color: '#64748b',
                fontWeight: 600,
                fontSize: '0.85rem',
                textTransform: 'none',
                minWidth: 'auto',
                p: 0,
                '&:hover': { bgcolor: 'transparent', color: '#0f172a' }
              }}
            >
              Close
            </Button>
          </Box>

          <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Top Row: Deployment Type (Left) & Brokers (Right) */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              {/* Deployment Type Toggle */}
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', mb: 1 }}>
                  Deployment Type
                </Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}
                >
                  <Typography
                    onClick={() => setDeploymentType('Live')}
                    sx={{
                      fontSize: '0.85rem',
                      fontWeight: deploymentType === 'Live' ? 700 : 500,
                      color: deploymentType === 'Live' ? '#0f172a' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    Live
                  </Typography>

                  {/* Segmented switch toggle */}
                  <Box
                    onClick={() => setDeploymentType(prev => prev === 'Live' ? 'Forward Test' : 'Live')}
                    sx={{
                      width: 44,
                      height: 24,
                      bgcolor: '#0f295e',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      px: '3px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        bgcolor: '#ffffff',
                        transform: deploymentType === 'Forward Test' ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  </Box>

                  <Typography
                    onClick={() => setDeploymentType('Forward Test')}
                    sx={{
                      fontSize: '0.85rem',
                      fontWeight: deploymentType === 'Forward Test' ? 700 : 500,
                      color: deploymentType === 'Forward Test' ? '#0f172a' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    Forward Test
                  </Typography>
                </Box>
              </Box>

              {/* Brokers Checkbox Card with DHAN (1108893841) */}
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', mb: 1 }}>
                  Brokers
                </Typography>
                <Box
                  sx={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    p: 1.2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedBrokers.length > 0}
                        onChange={(e) => setSelectedBrokers(e.target.checked ? ['dhan_primary'] : [])}
                        sx={{ p: 0.5, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                    }
                    label={<Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>Select All</Typography>}
                    sx={{ m: 0 }}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedBrokers.includes('dhan_primary')}
                        onChange={(e) => setSelectedBrokers(e.target.checked ? ['dhan_primary'] : [])}
                        sx={{ p: 0.5, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                        {connectedBroker.name} ({connectedBroker.clientId})
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Inputs 2-Column: Qty Multiplier & Max Profit */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Qty Multiplier
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={deployQtyMultiplier}
                  onChange={(e) => setDeployQtyMultiplier(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  fullWidth
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      '& fieldset': { borderColor: '#e2e8f0' }
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Max Profit (optional)
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={deployMaxProfit}
                  onChange={(e) => setDeployMaxProfit(e.target.value)}
                  fullWidth
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      '& fieldset': { borderColor: '#e2e8f0' }
                    }
                  }}
                />
              </Box>
            </Box>

            {/* Inputs 2-Column: Max Loss & Auto Square Off Time */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Max Loss (optional)
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={deployMaxLoss}
                  onChange={(e) => setDeployMaxLoss(e.target.value)}
                  fullWidth
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      '& fieldset': { borderColor: '#e2e8f0' }
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Auto Square Off Time
                </Typography>
                <TextField
                  size="small"
                  value={autoSquareOffTime}
                  onChange={(e) => setAutoSquareOffTime(e.target.value)}
                  fullWidth
                  InputProps={{
                    endAdornment: <AccessTime sx={{ color: '#94a3b8', fontSize: 18 }} />,
                    sx: {
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      '& fieldset': { borderColor: '#e2e8f0' }
                    }
                  }}
                />
              </Box>
            </Box>

            {/* Terms and Conditions Checkbox */}
            <Box sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    sx={{ p: 0.5, color: '#94a3b8', '&.Mui-checked': { color: '#2563eb' } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: '0.82rem', color: '#475569' }}>
                    I accept all the{' '}
                    <span style={{ color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>
                      terms & conditions
                    </span>
                  </Typography>
                }
                sx={{ m: 0 }}
              />
            </Box>
          </DialogContent>

          {/* Modal Actions */}
          <DialogActions sx={{ p: 0, pt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
            <Button
              onClick={() => setDeployModalOpen(false)}
              sx={{
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'none',
                px: 2.5,
                py: 0.9,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={!acceptTerms || actionLoading}
              onClick={handleConfirmDeploy}
              sx={{
                bgcolor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'none',
                px: 3,
                py: 0.9,
                borderRadius: '8px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' },
                '&.Mui-disabled': { bgcolor: '#93c5fd', color: '#ffffff' }
              }}
            >
              {actionLoading ? 'Deploying...' : 'Deploy'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Custom Strategy Context Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          PaperProps={{
            sx: { borderRadius: '8px', minWidth: 150, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }
          }}
        >
          {menuStrategy && (
            <>
              <MenuItem
                onClick={() => {
                  navigate(`/strategies/edit/${menuStrategy.id}`);
                  setMenuAnchor(null);
                }}
                sx={{ fontSize: '0.82rem', fontWeight: 600, gap: 1.5 }}
              >
                <Edit fontSize="small" sx={{ color: '#64748b' }} /> Edit
              </MenuItem>
              <MenuItem
                onClick={() => handleDuplicateStrategy(menuStrategy)}
                sx={{ fontSize: '0.82rem', fontWeight: 600, gap: 1.5 }}
              >
                <ContentCopy fontSize="small" sx={{ color: '#64748b' }} /> Duplicate
              </MenuItem>
              <MenuItem
                onClick={() => handleDeleteStrategy(menuStrategy)}
                sx={{ fontSize: '0.82rem', fontWeight: 600, gap: 1.5, color: '#dc2626' }}
              >
                <Delete fontSize="small" sx={{ color: '#dc2626' }} /> Delete
              </MenuItem>
            </>
          )}
        </Menu>

        {/* Deployed Strategy Context Menu */}
        <Menu
          anchorEl={depMenuAnchor}
          open={Boolean(depMenuAnchor)}
          onClose={() => setDepMenuAnchor(null)}
          PaperProps={{
            sx: { borderRadius: '8px', minWidth: 150, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }
          }}
        >
          {depMenuSelected && (
            <>
              <MenuItem
                onClick={async () => {
                  setDepMenuAnchor(null);
                  try {
                    await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/test-trigger`, {
                      deploymentId: depMenuSelected.deploymentId,
                      symbol: depMenuSelected.symbol
                    });
                    setStatusMessage({ type: 'success', text: `Test trigger executed for ${depMenuSelected.name}` });
                    await loadData();
                  } catch (e) {
                    setStatusMessage({ type: 'error', text: 'Test trigger failed' });
                  }
                }}
                sx={{ fontSize: '0.82rem', fontWeight: 600, gap: 1.5 }}
              >
                <Bolt fontSize="small" sx={{ color: '#2563eb' }} /> Test Trigger
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setDepMenuAnchor(null);
                  handleSquareOffDeployment(depMenuSelected.deploymentId);
                }}
                sx={{ fontSize: '0.82rem', fontWeight: 600, gap: 1.5, color: '#dc2626' }}
              >
                Square Off
              </MenuItem>
              <MenuItem
                onClick={() => handleDeleteDeployment(depMenuSelected.deploymentId)}
                sx={{ fontSize: '0.82rem', fontWeight: 600, gap: 1.5, color: '#dc2626' }}
              >
                <Delete fontSize="small" sx={{ color: '#dc2626' }} /> Remove
              </MenuItem>
            </>
          )}
        </Menu>
      </Box>
    </Layout>
  );
};

export default Strategies;
