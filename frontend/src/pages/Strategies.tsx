import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Menu,
  Grid
} from '@mui/material';
import { BacktestControls } from '../components/backtest/BacktestControls';
import { BacktestSummaryCards } from '../components/backtest/BacktestSummaryCards';
import { MaxProfitLossChart } from '../components/backtest/MaxProfitLossChart';
import { DaywiseBreakdownHeatmap } from '../components/backtest/DaywiseBreakdownHeatmap';
import { TransactionDetailsAccordion } from '../components/backtest/TransactionDetailsAccordion';
import {
  PlayArrow,
  Stop,
  Bolt,
  TrendingUp,
  TrendingDown,
  AccountTree,
  Assessment,
  CheckCircle,
  Refresh,
  Close,
  DeleteOutline,
  Replay,
  Security,
  WarningAmber,
  Timeline,
  ShowChart,
  History,
  Tune,
  Add,
  MoreVert,
  Delete,
  ContentCopy,
  Edit,
  Layers,
  AccessTime,
  AddCircleOutline,
  RemoveCircleOutline
} from '@mui/icons-material';
import Layout from '../components/Layout';
import { PageHeader, StatCard, StatusBadge } from '../components/ui';
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

export interface StrategyTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  timeframe: string;
  symbols: string[];
  margin: string;
  maxDrawdown: string;
  winRate: string;
  rules: string[];
  createdAt?: string;
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
}

const Strategies: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>([]);
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [activeDeployments, setActiveDeployments] = useState<DeployedStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Custom Strategy Menu Anchor
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuStrategy, setMenuStrategy] = useState<CustomStrategy | null>(null);

  // Template Menu Anchor
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuTemplate, setMenuTemplate] = useState<StrategyTemplate | null>(null);

  // Create / Edit Custom Strategy Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    author: string;
    description: string;
    segmentType: 'OPTION' | 'EQUITY' | 'FUTURES';
    strategyType: 'Time Based' | 'Indicator Based' | 'Breakout / Trigger';
    symbol: string;
    startTime: string;
    endTime: string;
    tradingDays: string[];
    legs: StrategyLeg[];
    maxLoss: number;
    maxProfit: number;
  }>({
    name: '',
    author: 'AR427232',
    description: '',
    segmentType: 'OPTION',
    strategyType: 'Time Based',
    symbol: 'NIFTY BANK',
    startTime: '09:16',
    endTime: '15:10',
    tradingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    legs: [],
    maxLoss: 2500,
    maxProfit: 5000
  });

  // Create / Edit Template Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateFormData, setTemplateFormData] = useState<StrategyTemplate>({
    id: '',
    name: '',
    category: 'Intraday Options',
    description: '',
    timeframe: '5m',
    symbols: ['NIFTY 50', 'BANKNIFTY'],
    margin: '₹25,000',
    maxDrawdown: '₹2,500',
    winRate: '65.0%',
    rules: ['']
  });

  // Deploy Dialog State
  const [deployModal, setDeployModal] = useState<{ open: boolean; strategy?: CustomStrategy | null; template?: StrategyTemplate | null }>({
    open: false,
    strategy: null,
    template: null
  });
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY 50');
  const [qtyMultiplier, setQtyMultiplier] = useState(1);
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>('paper');
  const [maxLoss, setMaxLoss] = useState(2500);

  // Backtest State
  const [backtesting, setBacktesting] = useState(false);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [btStrategy, setBtStrategy] = useState('nifty-009-atm-breakout');
  const [btSymbol, setBtSymbol] = useState('NIFTY 50');
  const [btDays, setBtDays] = useState(23);
  const [btCapital, setBtCapital] = useState(100000);
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('1 Month');
  const [creditsRemaining, setCreditsRemaining] = useState(49);
  const location = useLocation();

  useEffect(() => {
    loadData();
    if (location.state?.backtestTemplate) {
      setBtStrategy(location.state.backtestTemplate);
      setTabValue(3);
      runQuickBacktest(location.state.backtestTemplate);
    } else if (location.state?.deployTemplate) {
      setTabValue(1);
    }
  }, [location]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customRes, templatesRes, activeRes] = await Promise.all([
        axios.get(`${API_CONFIG.BASE_URL}/api/strategies`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/strategies/templates`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_CONFIG.BASE_URL}/api/strategies/active`).catch(() => ({ data: { success: false } }))
      ]);

      if (customRes.data?.success && customRes.data?.strategies) {
        setCustomStrategies(customRes.data.strategies);
      }
      if (templatesRes.data?.success && templatesRes.data?.templates) {
        setTemplates(templatesRes.data.templates);
      }
      if (activeRes.data?.success && activeRes.data?.deployments) {
        setActiveDeployments(activeRes.data.deployments);
      }
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // CUSTOM STRATEGY HANDLERS
  // ==========================================

  const handleOpenCreateModal = () => {
    navigate('/strategies/create');
  };

  const handleOpenEditModal = (strat: CustomStrategy) => {
    navigate(`/strategies/edit/${strat.id}`);
    handleCloseMenu();
  };

  const handleSaveStrategy = async () => {
    if (!formData.name.trim()) {
      setStatusMessage({ type: 'warning', text: 'Strategy name is required.' });
      return;
    }

    try {
      setActionLoading(true);
      if (editingStrategyId) {
        const res = await axios.put(`${API_CONFIG.BASE_URL}/api/strategies/${editingStrategyId}`, formData);
        if (res.data?.success) {
          setStatusMessage({ type: 'success', text: `Strategy "${formData.name}" updated successfully!` });
          setCreateModalOpen(false);
          await loadData();
        }
      } else {
        const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies`, formData);
        if (res.data?.success) {
          setStatusMessage({ type: 'success', text: `Strategy "${formData.name}" created successfully!` });
          setCreateModalOpen(false);
          await loadData();
          setTabValue(0);
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save strategy' });
    } finally {
      setActionLoading(false);
    }
  };

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
      handleCloseMenu();
    }
  };

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
      handleCloseMenu();
    }
  };

  const handleAddLeg = () => {
    const newLeg: StrategyLeg = {
      id: `leg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      action: 'SELL',
      symbol: formData.symbol,
      strike: 'ATM 0',
      optionType: formData.legs.length % 2 === 0 ? 'CE' : 'PE',
      quantity: formData.symbol.includes('BANK') ? 35 : 50,
      slType: 'percentage',
      slValue: 1
    };
    setFormData({ ...formData, legs: [...formData.legs, newLeg] });
  };

  const handleRemoveLeg = (idx: number) => {
    const updated = [...formData.legs];
    updated.splice(idx, 1);
    setFormData({ ...formData, legs: updated });
  };

  const handleUpdateLeg = (idx: number, field: keyof StrategyLeg, value: any) => {
    const updated = [...formData.legs];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormData({ ...formData, legs: updated });
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, strategy: CustomStrategy) => {
    setMenuAnchor(event.currentTarget);
    setMenuStrategy(strategy);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setMenuStrategy(null);
  };

  const handleOpenEditStrategy = (strategy: CustomStrategy) => {
    navigate(`/strategies/edit/${strategy.id}`);
    handleCloseMenu();
  };

  // ==========================================
  // TEMPLATE STRATEGY HANDLERS (EDITABLE TEMPLATES)
  // ==========================================

  const handleOpenCreateTemplate = () => {
    navigate('/strategies/create');
  };

  const handleOpenEditTemplate = (template: StrategyTemplate) => {
    navigate(`/strategies/edit/${template.id}`);
    handleCloseTemplateMenu();
  };

  const handleSaveTemplate = async () => {
    if (!templateFormData.name.trim()) {
      setStatusMessage({ type: 'warning', text: 'Template name is required.' });
      return;
    }

    try {
      setActionLoading(true);
      if (editingTemplateId) {
        const res = await axios.put(`${API_CONFIG.BASE_URL}/api/strategies/templates/${editingTemplateId}`, templateFormData);
        if (res.data?.success) {
          setStatusMessage({ type: 'success', text: `Template "${templateFormData.name}" updated successfully!` });
          setTemplateModalOpen(false);
          await loadData();
        }
      } else {
        const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/templates`, templateFormData);
        if (res.data?.success) {
          setStatusMessage({ type: 'success', text: `Template "${templateFormData.name}" created successfully!` });
          setTemplateModalOpen(false);
          await loadData();
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save template' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicateTemplate = async (template: StrategyTemplate) => {
    try {
      setActionLoading(true);
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/templates/duplicate/${template.id}`);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: `Template duplicated as "${res.data.template.name}"` });
        await loadData();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to duplicate template' });
    } finally {
      setActionLoading(false);
      handleCloseTemplateMenu();
    }
  };

  const handleDeleteTemplate = async (template: StrategyTemplate) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) return;

    try {
      setActionLoading(true);
      const res = await axios.delete(`${API_CONFIG.BASE_URL}/api/strategies/templates/${template.id}`);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: `Template "${template.name}" deleted.` });
        await loadData();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to delete template' });
    } finally {
      setActionLoading(false);
      handleCloseTemplateMenu();
    }
  };

  const handleAddTemplateRule = () => {
    setTemplateFormData({
      ...templateFormData,
      rules: [...templateFormData.rules, '']
    });
  };

  const handleRemoveTemplateRule = (idx: number) => {
    const updated = [...templateFormData.rules];
    updated.splice(idx, 1);
    setTemplateFormData({ ...templateFormData, rules: updated });
  };

  const handleUpdateTemplateRule = (idx: number, text: string) => {
    const updated = [...templateFormData.rules];
    updated[idx] = text;
    setTemplateFormData({ ...templateFormData, rules: updated });
  };

  const handleOpenTemplateMenu = (event: React.MouseEvent<HTMLElement>, template: StrategyTemplate) => {
    setTemplateMenuAnchor(event.currentTarget);
    setMenuTemplate(template);
  };

  const handleCloseTemplateMenu = () => {
    setTemplateMenuAnchor(null);
    setMenuTemplate(null);
  };

  // Card Backtest Trigger -> Navigate to dedicated Backtest Screen
  const handleCardBacktest = (strategy: CustomStrategy) => {
    navigate(`/backtest?strategyId=${strategy.id || '1_percent_sl_strangle_bnf'}`);
  };

  // Card Deploy Trigger
  const handleCardDeploy = (strategy: CustomStrategy) => {
    setDeployModal({ open: true, strategy, template: null });
    setSelectedSymbol(strategy.symbol || 'NIFTY BANK');
    setQtyMultiplier(1);
    setMaxLoss(strategy.maxLoss || 2500);
    setTradingMode('paper');
  };

  // Template Backtest Trigger -> Navigate to dedicated Backtest Screen
  const handleTemplateBacktest = (template: StrategyTemplate) => {
    navigate(`/backtest?strategyId=${template.id}`);
  };

  // Template Deploy Trigger
  const handleOpenTemplateDeploy = (template: StrategyTemplate) => {
    const firstSym = template.symbols[0] || 'NIFTY 50';
    setDeployModal({ open: true, template, strategy: null });
    setSelectedSymbol(firstSym);
    setQtyMultiplier(1);
    setMaxLoss(2500);
    setTradingMode('paper');
  };

  // Confirm Deploy
  const handleConfirmDeploy = async () => {
    const name = deployModal.strategy ? deployModal.strategy.name : deployModal.template?.name || 'Strategy';
    const stratId = deployModal.strategy ? deployModal.strategy.id : deployModal.template?.id || 'custom';

    try {
      setActionLoading(true);
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/deploy`, {
        strategyId: stratId,
        name,
        symbol: selectedSymbol,
        templateType: stratId,
        qtyMultiplier,
        maxLoss,
        type: tradingMode
      });

      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: res.data.message });
        setDeployModal({ open: false, strategy: null, template: null });
        await loadData();
        setTabValue(2);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Deployment failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestTrigger = async (deployment: DeployedStrategy) => {
    try {
      setActionLoading(true);
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/test-trigger`, {
        deploymentId: deployment.deploymentId,
        symbol: deployment.symbol,
        side: 'BUY',
        quantity: 5 * deployment.qtyMultiplier
      });

      if (res.data?.success) {
        setStatusMessage({
          type: 'success',
          text: `Verified: ${res.data.message} executed and saved to Trade Ledger!`
        });
        await loadData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to execute trigger test' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopStrategy = async (deploymentId: string) => {
    try {
      setActionLoading(true);
      await axios.post(`${API_CONFIG.BASE_URL}/api/strategies/stop`, { deploymentId });
      setStatusMessage({ type: 'success', text: 'Strategy automation stopped.' });
      await loadData();
    } catch (err) {
      // Handled
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDeployment = async (deploymentId: string) => {
    try {
      setActionLoading(true);
      await axios.delete(`${API_CONFIG.BASE_URL}/api/strategies/deployment/${deploymentId}`);
      setStatusMessage({ type: 'success', text: 'Deployment record removed.' });
      await loadData();
    } catch (err) {
      // Handled
    } finally {
      setActionLoading(false);
    }
  };

  const runQuickBacktest = async (
    strategy = btStrategy || '1_percent_sl_strangle_bnf',
    symbol = btSymbol || 'BANKNIFTY',
    days = btDays || 23,
    capital = btCapital || 100000
  ) => {
    try {
      setBacktesting(true);
      const res = await axios.post(
        `${API_CONFIG.BASE_URL}/api/backtest/run`,
        {
          strategyId: strategy,
          symbol,
          days,
          capital
        }
      );
      if (res.data?.success && res.data?.data) {
        setBacktestResult(res.data.data);
        if (res.data.creditsRemaining !== undefined) {
          setCreditsRemaining(res.data.creditsRemaining);
        }
      }
    } catch (err) {
      console.error('Backtest error:', err);
    } finally {
      setBacktesting(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: '100%' }}>
        {/* Page Header */}
        <PageHeader
          title="Strategy Engine & Builder"
          subtitle="Build, edit, deploy, and backtest automated multi-leg and template strategies on Indian markets"
          badge={<StatusBadge status="live" dot label="ALGO ENGINE ACTIVE" />}
          action={
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={handleOpenCreateModal}
                sx={{
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2,
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                  '&:hover': { bgcolor: '#1d4ed8' }
                }}
              >
                Create New Strategy
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh sx={{ fontSize: 16 }} />}
                onClick={loadData}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderColor: '#e2e8f0',
                  color: '#475569'
                }}
              >
                Refresh
              </Button>
            </Box>
          }
        />

        {/* Notification Banner */}
        {statusMessage && (
          <Alert
            severity={statusMessage.type}
            onClose={() => setStatusMessage(null)}
            sx={{ mb: 3, borderRadius: 2, fontSize: '0.85rem', fontWeight: 600 }}
          >
            {statusMessage.text}
          </Alert>
        )}

        {/* Navigation Tabs */}
        <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{
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
            <Tab icon={<Layers sx={{ fontSize: 16 }} />} iconPosition="start" label={`My Strategies (${customStrategies.length})`} />
            <Tab icon={<AccountTree sx={{ fontSize: 16 }} />} iconPosition="start" label={`Curated Templates (${templates.length})`} />
            <Tab
              icon={<TrendingUp sx={{ fontSize: 16 }} />}
              iconPosition="start"
              label={`Active Deployments (${activeDeployments.filter(d => d.status === 'RUNNING').length})`}
            />
            <Tab icon={<Assessment sx={{ fontSize: 16 }} />} iconPosition="start" label="Backtest Simulator" />
          </Tabs>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} sx={{ color: '#0f172a' }} />
          </Box>
        ) : (
          <>
            {/* TAB 0: MY STRATEGIES (CUSTOM STRATEGY CARDS) */}
            {tabValue === 0 && (
              <Box>
                {customStrategies.length === 0 ? (
                  <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
                    <Layers sx={{ fontSize: 44, color: '#94a3b8', mb: 1.5 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      No Custom Strategies Yet
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 440, mx: 'auto', mt: 0.5, mb: 2.5, fontSize: '0.85rem' }}>
                      Create your first custom options strangle, straddle, or breakout strategy with custom legs and automated time filters.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleOpenCreateModal}
                      sx={{ bgcolor: '#2563eb', color: '#ffffff', fontWeight: 700, borderRadius: 2, textTransform: 'none', px: 3 }}
                    >
                      Create Strategy Now
                    </Button>
                  </Paper>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
                    {customStrategies.map(strategy => (
                      <Paper
                        key={strategy.id}
                        sx={{
                          p: 3,
                          borderRadius: 3.5,
                          border: '1px solid #f1f5f9',
                          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          bgcolor: '#ffffff',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: '0 8px 30px -4px rgba(15, 23, 42, 0.1)',
                            borderColor: '#e2e8f0'
                          }
                        }}
                      >
                        <Box>
                          {/* Card Header */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                                {strategy.name}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.2 }}>
                                By {strategy.author || 'AR427232'}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenMenu(e, strategy)}
                              sx={{ color: '#94a3b8', '&:hover': { color: '#0f172a' } }}
                            >
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </Box>

                          {/* 4-Grid Meta */}
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                                {strategy.startTime || '09:16'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                Start Time
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                                {strategy.endTime || '15:10'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                End Time
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase' }}>
                                {strategy.segmentType || 'OPTION'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                Segment Type
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#475569' }}>
                                {strategy.strategyType || 'Time Based'}
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                Strategy Type
                              </Typography>
                            </Box>
                          </Box>

                          {/* Strategy Legs */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                            {strategy.legs && strategy.legs.length > 0 ? (
                              strategy.legs.map((leg, idx) => (
                                <Box
                                  key={leg.id || idx}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    bgcolor: '#f8fafc',
                                    border: '1px solid #f1f5f9',
                                    py: 1.2,
                                    px: 2,
                                    borderRadius: 2
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
                                    {leg.action} {leg.symbol || strategy.symbol} {leg.strike} {leg.optionType}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                    Qty: {leg.quantity}
                                  </Typography>
                                </Box>
                              ))
                            ) : (
                              <Box
                                sx={{
                                  bgcolor: '#f8fafc',
                                  border: '1px solid #f1f5f9',
                                  py: 1.2,
                                  px: 2,
                                  borderRadius: 2
                                }}
                              >
                                <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  {strategy.description || 'Custom algorithmic strategy'}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>

                        {/* Action Buttons: Backtest & Deploy */}
                        <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
                          <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => handleCardBacktest(strategy)}
                            sx={{
                              borderColor: '#e2e8f0',
                              color: '#0f172a',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              textTransform: 'none',
                              borderRadius: 2.5,
                              py: 1.2,
                              '&:hover': {
                                borderColor: '#cbd5e1',
                                bgcolor: '#f8fafc'
                              }
                            }}
                          >
                            Backtest
                          </Button>
                          <Button
                            variant="contained"
                            fullWidth
                            onClick={() => handleCardDeploy(strategy)}
                            sx={{
                              bgcolor: '#2563eb',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              textTransform: 'none',
                              borderRadius: 2.5,
                              py: 1.2,
                              boxShadow: 'none',
                              '&:hover': {
                                bgcolor: '#1d4ed8',
                                boxShadow: 'none'
                              }
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

            {/* TAB 1: CURATED STRATEGY TEMPLATES (EDITABLE) */}
            {tabValue === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Header Sub-bar */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      Curated Strategy Templates ({templates.length})
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                      Pre-built algorithmic strategies with proven market rules. Click <strong>Edit</strong> on any card to customize rules, timeframe, and risk settings.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={handleOpenCreateTemplate}
                    sx={{
                      borderColor: '#0f172a',
                      color: '#0f172a',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      textTransform: 'none',
                      borderRadius: 2,
                      px: 2,
                      '&:hover': { bgcolor: '#f8fafc', borderColor: '#0f172a' }
                    }}
                  >
                    + Add Strategy Template
                  </Button>
                </Box>

                {templates.length === 0 ? (
                  <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155', mb: 1 }}>
                      No Strategy Templates Available
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 3, maxWidth: 500, mx: 'auto' }}>
                      All pre-configured strategy templates have been cleared. Build and customize your own strategies from the Custom Strategy Builder tab.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => setTabValue(1)}
                      sx={{ bgcolor: '#0f172a', fontWeight: 700, textTransform: 'none' }}
                    >
                      Go to Strategy Builder
                    </Button>
                  </Paper>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
                    {templates.map(template => (
                      <Paper
                        key={template.id}
                        sx={{
                          p: 3,
                          borderRadius: 3.5,
                          border: '1px solid #f1f5f9',
                          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          bgcolor: '#ffffff',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: '0 8px 30px -4px rgba(15, 23, 42, 0.1)',
                            borderColor: '#e2e8f0'
                          }
                        }}
                      >
                        <Box>
                          {/* Card Header */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                                {template.name}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.2 }}>
                                By AR427232
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenTemplateMenu(e, template)}
                              sx={{ color: '#94a3b8', '&:hover': { color: '#0f172a' } }}
                            >
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </Box>

                          {/* 4-Grid Meta */}
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                                09:16
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                Start Time
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                                15:10
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                End Time
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase' }}>
                                OPTION
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                Segment Type
                              </Typography>
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#475569' }}>
                                Time Based
                              </Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                Strategy Type
                              </Typography>
                            </Box>
                          </Box>

                          {/* Legs Pills */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                            <Box sx={{
                              bgcolor: '#f8fafc',
                              p: '8px 12px',
                              borderRadius: 2,
                              border: '1px solid #f1f5f9',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                                SELL {template.symbols?.[0] || 'NIFTY BANK'} ATM 0 CE
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                Qty: 35
                              </Typography>
                            </Box>
                            <Box sx={{
                              bgcolor: '#f8fafc',
                              p: '8px 12px',
                              borderRadius: 2,
                              border: '1px solid #f1f5f9',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                                SELL {template.symbols?.[0] || 'NIFTY BANK'} ATM 0 PE
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                Qty: 35
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* Bottom Action Buttons */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                          <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => handleTemplateBacktest(template)}
                            sx={{
                              borderColor: '#e2e8f0',
                              color: '#0f172a',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              textTransform: 'none',
                              borderRadius: 2,
                              py: 1,
                              '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }
                            }}
                          >
                            Backtest
                          </Button>
                          <Button
                            variant="contained"
                            fullWidth
                            onClick={() => handleOpenTemplateDeploy(template)}
                            sx={{
                              bgcolor: '#2563eb',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              textTransform: 'none',
                              borderRadius: 2,
                              py: 1,
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

            {/* TAB 2: ACTIVE DEPLOYMENTS */}
            {tabValue === 2 && (
              <Box>
                {activeDeployments.length === 0 ? (
                  <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
                    <TrendingUp sx={{ fontSize: 44, color: '#94a3b8', mb: 1.5 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      No Active Strategy Deployments
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 440, mx: 'auto', mt: 0.5, mb: 2.5, fontSize: '0.85rem' }}>
                      Select a strategy from the templates or create your own, then deploy it in paper or live mode.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => setTabValue(0)}
                      sx={{ bgcolor: '#0f172a', color: '#ffffff', fontWeight: 700, borderRadius: 2, textTransform: 'none' }}
                    >
                      Browse My Strategies
                    </Button>
                  </Paper>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {activeDeployments.map(deployment => {
                      const isRunning = deployment.status === 'RUNNING';
                      return (
                        <Paper
                          key={deployment.deploymentId}
                          sx={{
                            p: 2.5,
                            borderRadius: 3,
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 2
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                              sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 2.5,
                                bgcolor: isRunning ? '#ecfdf5' : '#f1f5f9',
                                color: isRunning ? '#10b981' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Bolt sx={{ fontSize: 24 }} />
                            </Box>
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                  {deployment.name}
                                </Typography>
                                <StatusBadge
                                  status={isRunning ? (deployment.mode === 'live' ? 'live' : 'paper') : 'paper'}
                                  dot={isRunning}
                                  label={deployment.status}
                                />
                                <Chip
                                  label={deployment.symbol}
                                  size="small"
                                  sx={{ fontWeight: 700, fontSize: '0.72rem', height: 20, bgcolor: '#f1f5f9', color: '#334155' }}
                                />
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Deployed at: {new Date(deployment.deployedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Lot Multiplier: {deployment.qtyMultiplier}x • Max Loss: ₹{deployment.maxLoss}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {isRunning ? (
                              <>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<Bolt sx={{ color: '#eab308' }} />}
                                  disabled={actionLoading}
                                  onClick={() => handleTestTrigger(deployment)}
                                  sx={{
                                    borderColor: '#e2e8f0',
                                    color: '#0f172a',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    textTransform: 'none',
                                    borderRadius: 2
                                  }}
                                >
                                  Test Trigger
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<Stop />}
                                  disabled={actionLoading}
                                  onClick={() => handleStopStrategy(deployment.deploymentId)}
                                  sx={{
                                    bgcolor: '#ef4444',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    '&:hover': { bgcolor: '#dc2626' }
                                  }}
                                >
                                  Stop Strategy
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<DeleteOutline />}
                                onClick={() => handleDeleteDeployment(deployment.deploymentId)}
                                sx={{
                                  borderColor: '#cbd5e1',
                                  color: '#64748b',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  borderRadius: 2,
                                  textTransform: 'none'
                                }}
                              >
                                Remove
                              </Button>
                            )}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}

            {/* TAB 3: BACKTEST ANALYTICS & SIMULATOR */}
            {tabValue === 3 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <BacktestControls
                  strategyName={
                    templates.find(t => t.id === btStrategy)?.name ||
                    customStrategies.find(c => c.id === btStrategy)?.name ||
                    'NIFTY 0.09% ATM Full-Day Breakout'
                  }
                  strategiesList={[
                    ...templates.map(t => ({ id: t.id, name: t.name })),
                    ...customStrategies.map(c => ({ id: c.id, name: c.name }))
                  ]}
                  selectedStrategyId={btStrategy || 'nifty-009-atm-breakout'}
                  onSelectStrategy={(id) => {
                    setBtStrategy(id);
                    const targetSymbol = id.toLowerCase().includes('bnf') || id.toLowerCase().includes('bank') ? 'BANKNIFTY' : 'NIFTY 50';
                    setBtSymbol(targetSymbol);
                    runQuickBacktest(id, targetSymbol, btDays, btCapital);
                  }}
                  selectedRange={selectedRangeLabel}
                  onSelectRange={(range, days) => {
                    setSelectedRangeLabel(range);
                    setBtDays(days);
                    runQuickBacktest(btStrategy, btSymbol, days, btCapital);
                  }}
                  creditsRemaining={creditsRemaining}
                  totalCredits={50}
                  totalPnl={backtestResult ? backtestResult.totalNetPnl : 15702.4}
                  maxDrawdown={backtestResult ? backtestResult.maxDrawdown : -6600.3}
                  equityCurve={backtestResult?.equityCurve || []}
                  loading={backtesting}
                  onRunBacktest={() => runQuickBacktest(btStrategy, btSymbol, btDays, btCapital)}
                  onExportTrades={(format) => {
                    window.open(`${API_CONFIG.BASE_URL}/api/backtest/export?strategyId=${btStrategy}&format=${format}`);
                  }}
                />

                {backtestResult && backtestResult.summary && (
                  <>
                    <BacktestSummaryCards summary={backtestResult.summary} />
                    <MaxProfitLossChart
                      dailyBars={backtestResult.dailyPnlBars || []}
                      avgProfit={backtestResult.summary.avgProfitPerDay}
                      avgLoss={backtestResult.summary.avgLossPerDay}
                    />
                    <DaywiseBreakdownHeatmap
                      monthlyBreakdown={backtestResult.monthlyBreakdown || []}
                    />
                    <TransactionDetailsAccordion
                      daywiseTransactions={backtestResult.daywiseTransactions || []}
                    />
                  </>
                )}
              </Box>
            )}
          </>
        )}

        {/* CUSTOM STRATEGY CARD CONTEXT MENU */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleCloseMenu}
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
              minWidth: 160
            }
          }}
        >
          {menuStrategy && (
            <>
              <MenuItem onClick={() => handleOpenEditStrategy(menuStrategy)}>
                <Edit fontSize="small" sx={{ mr: 1.5, color: '#475569' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>Edit</Typography>
              </MenuItem>
              <MenuItem onClick={() => handleDuplicateStrategy(menuStrategy)}>
                <ContentCopy fontSize="small" sx={{ mr: 1.5, color: '#475569' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>Duplicate</Typography>
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={() => handleDeleteStrategy(menuStrategy)} sx={{ color: '#dc2626' }}>
                <Delete fontSize="small" sx={{ mr: 1.5, color: '#dc2626' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc2626' }}>Delete</Typography>
              </MenuItem>
            </>
          )}
        </Menu>

        {/* TEMPLATE STRATEGY CONTEXT MENU */}
        <Menu
          anchorEl={templateMenuAnchor}
          open={Boolean(templateMenuAnchor)}
          onClose={handleCloseTemplateMenu}
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
              minWidth: 160
            }
          }}
        >
          {menuTemplate && (
            <>
              <MenuItem onClick={() => handleOpenEditTemplate(menuTemplate)}>
                <Edit fontSize="small" sx={{ mr: 1.5, color: '#475569' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>Edit Template</Typography>
              </MenuItem>
              <MenuItem onClick={() => handleDuplicateTemplate(menuTemplate)}>
                <ContentCopy fontSize="small" sx={{ mr: 1.5, color: '#475569' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>Duplicate Template</Typography>
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={() => handleDeleteTemplate(menuTemplate)} sx={{ color: '#dc2626' }}>
                <Delete fontSize="small" sx={{ mr: 1.5, color: '#dc2626' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc2626' }}>Delete</Typography>
              </MenuItem>
            </>
          )}
        </Menu>

        {/* DEPLOY MODAL */}
        <Dialog
          open={deployModal.open}
          onClose={() => setDeployModal({ open: false, strategy: null, template: null })}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3.5,
              p: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }
          }}
        >
          <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Deploy Strategy: {deployModal.strategy?.name || deployModal.template?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                Select execution mode, symbol, and daily risk protection parameters.
              </Typography>
            </Box>
            <IconButton onClick={() => setDeployModal({ open: false, strategy: null, template: null })} size="small" sx={{ color: '#94a3b8' }}>
              <Close />
            </IconButton>
          </Box>

          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Trading Instrument</InputLabel>
                <Select
                  value={selectedSymbol}
                  label="Trading Instrument"
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                >
                  <MenuItem value="NIFTY BANK">NIFTY BANK</MenuItem>
                  <MenuItem value="NIFTY 50">NIFTY 50</MenuItem>
                  <MenuItem value="FINNIFTY">FINNIFTY</MenuItem>
                  <MenuItem value="RELIANCE">RELIANCE</MenuItem>
                  <MenuItem value="TCS">TCS</MenuItem>
                  <MenuItem value="HDFCBANK">HDFCBANK</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  size="small"
                  label="Lot Multiplier (1-10)"
                  type="number"
                  value={qtyMultiplier}
                  onChange={(e) => setQtyMultiplier(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Max Loss Limit (₹)"
                  type="number"
                  value={maxLoss}
                  onChange={(e) => setMaxLoss(Number(e.target.value))}
                  fullWidth
                />
              </Box>

              <FormControl size="small" fullWidth>
                <InputLabel>Execution Mode</InputLabel>
                <Select
                  value={tradingMode}
                  label="Execution Mode"
                  onChange={(e) => setTradingMode(e.target.value as 'paper' | 'live')}
                >
                  <MenuItem value="paper">Paper Trading (Simulated Ledger)</MenuItem>
                  <MenuItem value="live">Live Broker (Dhan HQ API)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={() => setDeployModal({ open: false, strategy: null, template: null })} sx={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmDeploy}
              disabled={actionLoading}
              sx={{
                bgcolor: '#0f172a',
                color: '#ffffff',
                fontWeight: 700,
                px: 3,
                borderRadius: 2,
                textTransform: 'none',
                '&:hover': { bgcolor: '#1e293b' }
              }}
            >
              {actionLoading ? 'Deploying...' : `Confirm & Deploy (${tradingMode.toUpperCase()})`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Strategies;
