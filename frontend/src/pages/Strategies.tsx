import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import Layout from '../components/Layout';
import apiService from '../services/apiService';
import firestoreService, { Strategy as DbStrategy } from '../services/firestoreService';
import { auth } from '../config/firebase';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Select,
  MenuItem as MuiMenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  Paper
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const Strategies: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  interface MyStrategyCard {
    id: string;
    name: string;
    author: string;
    startTime: string;
    endTime: string;
    segmentType: string;
    strategyType: string;
    instruments: string[];
    status: 'active' | 'draft';
  }

  const [strategies, setStrategies] = useState<MyStrategyCard[]>([]);

  interface StrategyTemplate {
    id: number;
    name: string;
    category: 'Basic' | 'HNI' | 'Retail';
    maxDD: string;
    margin: string;
    chart: string;
    description?: string;
  }

  const templates: StrategyTemplate[] = [
    {
      id: 1,
      name: 'MX Strategies - 5-Minute Trigger Candle',
      category: 'HNI',
      maxDD: '2500.00',
      margin: '50000.00',
      chart: '',
      description: 'Professional 5-minute trigger candle strategy for Index Options with automatic Dhan API integration. Market opens within ±150 points, waits for 9:20 AM candle, calculates triggers, and executes trades with intelligent averaging and dynamic stop loss.'
    }
  ];

  const [templateFilter, setTemplateFilter] = useState<'All' | 'Basic' | 'HNI' | 'Retail'>('All');
  // Only MX Strategies template - no filtering needed
  const filteredTemplates = templates;

  // State for template charts
  const [templateCharts, setTemplateCharts] = useState<Record<number, { equity: { x: string; y: number }[] }>>({});

  useEffect(() => {
    let isMounted = true;
    // Only load charts when viewing the Strategy Template tab (tabValue === 3)
    if (tabValue !== 3) return;

    // Load quick backtest once per template to render real graphs
    const loadCharts = async () => {
      try {
        const results = await apiService.get<{ success: boolean; results: { dailyResults: { date: string; profit: number }[] } }>(
          '/api/strategy-test/quick-backtest?days=60'
        );
        if (!isMounted || !results) return;
        // Build equity curve from daily profits
        const equity: { x: string; y: number }[] = [];
        let run = 0;
        results.results.dailyResults.forEach(d => {
          run += d.profit || 0;
          equity.push({ x: d.date, y: Number(run.toFixed(2)) });
        });
        const charts: Record<number, { equity: { x: string; y: number }[] }> = {};
        templates.forEach(t => { charts[t.id] = { equity }; });
        setTemplateCharts(charts);
      } catch (e) {
        // Ignore errors; UI will still render without charts
      }
    };
    loadCharts();
    return () => { isMounted = false; };
  }, [tabValue]);

  // Duplicate modal state
  const [dupOpen, setDupOpen] = useState<{ open: boolean; template?: StrategyTemplate }>(() => ({ open: false }));
  const [dupName, setDupName] = useState('');

  // Deploy modal state - now supports both strategies and templates
  const [deployOpen, setDeployOpen] = useState<{ open: boolean; strategy?: MyStrategyCard; template?: StrategyTemplate }>({ open: false });
  const [deployAccept, setDeployAccept] = useState(false);
  const [deployForm, setDeployForm] = useState({
    qtyMultiplier: '1',
    maxProfit: '0',
    maxLoss: '2500',
    broker: '',
    squareOff: '03:11',
    type: 'live',
    acceptTerms: false
  });
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; message: string; onConfirm: () => void }>({ open: false, message: '', onConfirm: () => { } });

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; strategyId: string; currentName: string; newName: string }>({ open: false, strategyId: '', currentName: '', newName: '' });

  // Backtest dialog state
  const [backtestDialog, setBacktestDialog] = useState<{ open: boolean; strategyId: string | null }>({ open: false, strategyId: null });
  const [backtestResults, setBacktestResults] = useState<any>(null);
  const [backtesting, setBacktesting] = useState(false);

  // Load real strategies from Firestore for the logged-in user
  useEffect(() => {
    const load = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const rows = await firestoreService.getStrategies(uid);
      const mapped: MyStrategyCard[] = rows.map(r => ({
        id: r.id,
        name: r.name,
        author: uid,
        startTime: '09:22',
        endTime: '16:11',
        segmentType: 'OPTION',
        strategyType: 'Time Based',
        instruments: [r.symbol || 'SELL NIFTY BANK ATM 0 CE', 'SELL NIFTY BANK ATM 0 PE'],
        status: r.status === 'live' ? 'active' : 'draft'
      }));
      setStrategies(mapped);
    };
    load();
  }, []);

  // Create Strategy form state
  const [createForm, setCreateForm] = useState({
    name: '',
    symbol: 'BANKNIFTY',
    timeframe: '5m',
    stopLossPercent: '1',
    targetPercent: '1',
    positionSize: '1',
    description: ''
  });
  const [creating, setCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  // Instrument selection state
  const [instrumentDialogOpen, setInstrumentDialogOpen] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [selectedInstrumentType, setSelectedInstrumentType] = useState('OPTIONS');
  const [instrumentSearch, setInstrumentSearch] = useState('');

  // AlgoRooms style Create Strategy fields
  const [strategyType, setStrategyType] = useState<'time-based' | 'indicator-based'>('time-based');
  const [orderType, setOrderType] = useState('MIS');
  const [startTime, setStartTime] = useState('09:16');
  const [squareOffTime, setSquareOffTime] = useState('03:15');
  const [tradingDays, setTradingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);

  // Available instruments (mock data - can be replaced with API call)
  const availableInstrumentsByType: Record<string, string[]> = {
    OPTIONS: ['BANKNIFTY', 'NIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'],
    EQUITY: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'HDFC', 'BHARTIARTL', 'SBIN', 'BAJFINANCE', 'KOTAKBANK'],
    FUTURES: ['NIFTY FUT', 'BANKNIFTY FUT', 'FINNIFTY FUT', 'MIDCPNIFTY FUT'],
    INDICES: ['NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FIN SERVICE', 'SENSEX'],
    CDS: ['USDINR', 'EURINR', 'GBPINR', 'JPYINR'],
    MCX: ['GOLD', 'SILVER', 'CRUDEOIL', 'NATURALGAS', 'COPPER']
  };

  const availableInstruments = availableInstrumentsByType[selectedInstrumentType] || [];
  const filteredInstruments = instrumentSearch
    ? availableInstruments.filter(i => i.toLowerCase().includes(instrumentSearch.toLowerCase()))
    : availableInstruments;

  const handleSelectInstrument = (instrument: string) => {
    if (!selectedInstruments.includes(instrument)) {
      setSelectedInstruments([...selectedInstruments, instrument]);
    }
  };

  const handleRemoveInstrument = (instrument: string) => {
    setSelectedInstruments(selectedInstruments.filter(i => i !== instrument));
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setCreating(true);
    try {
      // Use selected instruments or fallback to symbol
      const instrumentsList = selectedInstruments.length > 0
        ? selectedInstruments
        : [createForm.symbol || 'BANKNIFTY'];

      const newId = await firestoreService.addStrategy(uid, {
        name: createForm.name.trim(),
        description: createForm.description || createForm.name.trim(),
        instrumentType: selectedInstrumentType === 'OPTIONS' ? 'OPTION' : selectedInstrumentType,
        symbol: instrumentsList[0] || createForm.symbol,
        timeframe: createForm.timeframe,
        entryRule: 'custom',
        exitRule: 'custom',
        stopLossPercent: Number(createForm.stopLossPercent) || 0,
        targetPercent: Number(createForm.targetPercent) || 0,
        positionSize: Number(createForm.positionSize) || 1,
        status: 'draft',
        createdAt: null as any,
        updatedAt: null as any
      } as any);
      // Optimistic add
      setStrategies(prev => [{
        id: newId,
        name: createForm.name.trim(),
        author: uid,
        startTime: '09:22',
        endTime: '16:11',
        segmentType: selectedInstrumentType === 'OPTIONS' ? 'OPTION' : selectedInstrumentType,
        strategyType: 'Time Based',
        instruments: instrumentsList,
        status: 'draft'
      }, ...prev]);
      // Reset and switch tab to My Strategies
      setCreateForm({ name: '', symbol: 'BANKNIFTY', timeframe: '5m', stopLossPercent: '1', targetPercent: '1', positionSize: '1', description: '' });
      setSelectedInstruments([]);
      setWizardStep(0);
      setTabValue(1);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <Box sx={{
        minHeight: '100vh',
        p: { xs: 1.5, sm: 2 },
        pb: { xs: 10, sm: 3 },
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* Compact Header */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1.5
        }}>
          <Box>
            <Typography variant="h5" sx={{
              fontWeight: 700,
              color: '#0f172a',
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
              mb: 0.25
            }}>
              Strategies
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8125rem' }}>
              Create, manage, and deploy your trading strategies
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              placeholder="Search strategies..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: 180, sm: 220 },
                '& .MuiOutlinedInput-root': {
                  height: 36,
                  fontSize: '0.875rem',
                  bgcolor: 'white'
                }
              }}
            />
          </Box>
        </Box>

        {/* Modern Tabs */}
        <Box sx={{
          borderBottom: 1,
          borderColor: '#e2e8f0',
          mb: 2,
          overflowX: 'auto',
          '&::-webkit-scrollbar': {
            height: '3px'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#cbd5e1',
            borderRadius: '3px'
          }
        }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#64748b',
                minHeight: 44,
                minWidth: { xs: 'auto', sm: 100 },
                px: { xs: 2, sm: 3 },
                transition: 'all 0.2s',
                '&.Mui-selected': {
                  color: '#6366f1',
                  fontWeight: 700
                },
                '&:hover': {
                  color: '#6366f1',
                  bgcolor: 'rgba(99, 102, 241, 0.04)'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#6366f1',
                height: 3,
                borderRadius: '3px 3px 0 0'
              }
            }}
          >
            <Tab label="Create" />
            <Tab label="My Strategies" />
            <Tab label="Deployed" />
            <Tab label="Templates" />
            <Tab label="Portfolio" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{
            maxWidth: { xs: '100%', sm: '100%', md: 1200 },
            width: '100%',
            overflowX: 'hidden'
          }}>
            {/* Strategy Type */}
            <Box sx={{ mb: { xs: 3, sm: 4 } }}>
              <Typography variant="h6" sx={{
                mb: 2,
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }}>
                Strategy Type
              </Typography>
              <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                width: { xs: '100%', sm: 'auto' }
              }}>
                <Button
                  variant={strategyType === 'time-based' ? 'contained' : 'outlined'}
                  onClick={() => setStrategyType('time-based')}
                  fullWidth={true}
                  sx={{
                    textTransform: 'none',
                    px: { xs: 2, sm: 4 },
                    py: 1.5,
                    borderRadius: 2,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                    bgcolor: strategyType === 'time-based' ? '#e7f5ff' : 'transparent',
                    color: strategyType === 'time-based' ? '#4c6ef5' : '#666',
                    border: strategyType === 'time-based' ? '1px solid #4c6ef5' : '1px solid #dee2e6',
                    '&:hover': {
                      bgcolor: strategyType === 'time-based' ? '#d0ebff' : '#f8f9fa'
                    }
                  }}
                >
                  Time Based
                </Button>
                <Button
                  variant={strategyType === 'indicator-based' ? 'contained' : 'outlined'}
                  onClick={() => setStrategyType('indicator-based')}
                  fullWidth={true}
                  sx={{
                    textTransform: 'none',
                    px: { xs: 2, sm: 4 },
                    py: 1.5,
                    borderRadius: 2,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                    bgcolor: strategyType === 'indicator-based' ? '#e7f5ff' : 'transparent',
                    color: strategyType === 'indicator-based' ? '#4c6ef5' : '#666',
                    border: strategyType === 'indicator-based' ? '1px solid #4c6ef5' : '1px solid #dee2e6',
                    '&:hover': {
                      bgcolor: strategyType === 'indicator-based' ? '#d0ebff' : '#f8f9fa'
                    }
                  }}
                >
                  Indicator Based
                </Button>
              </Box>
            </Box>

            {/* Select Instruments */}
            <Box sx={{ mb: { xs: 3, sm: 4 } }}>
              <Typography variant="h6" sx={{
                mb: 2,
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }}>
                Select Instruments
              </Typography>

              {/* Selected Instruments */}
              {selectedInstruments.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    {selectedInstruments.map((inst) => (
                      <Chip
                        key={inst}
                        label={inst}
                        onDelete={() => handleRemoveInstrument(inst)}
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Add Instruments Button */}
              <Box
                onClick={() => setInstrumentDialogOpen(true)}
                sx={{
                  border: '2px dashed #4c6ef5',
                  bgcolor: '#f8f9fa',
                  p: { xs: 2, sm: 3 },
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: 2,
                  maxWidth: { xs: '100%', sm: 300 },
                  '&:hover': { bgcolor: '#e7f5ff' },
                  transition: 'all 0.2s'
                }}
              >
                <AddIcon sx={{ fontSize: { xs: 28, sm: 32 }, color: '#4c6ef5', mb: 1 }} />
                <Typography sx={{
                  color: '#4c6ef5',
                  fontWeight: 500,
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }}>
                  Add Instruments.
                </Typography>
              </Box>
            </Box>

            {strategyType === 'time-based' && (
              <Box>
                {/* Order Type, Start Time, Square Off */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'auto 1fr 1fr' },
                  gap: { xs: 2, sm: 3 },
                  mb: { xs: 3, sm: 4 },
                  alignItems: 'flex-start'
                }}>
                  {/* Order Type */}
                  <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1', md: 'auto' } }}>
                    <Typography variant="body2" sx={{
                      mb: 1,
                      fontWeight: 500,
                      color: '#495057',
                      fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}>
                      Order Type
                    </Typography>
                    <ToggleButtonGroup
                      value={orderType}
                      exclusive
                      fullWidth
                      onChange={(e, value) => value && setOrderType(value)}
                      size="small"
                    >
                      <ToggleButton value="MIS" sx={{ px: 2 }}>MIS</ToggleButton>
                      <ToggleButton value="CNC" sx={{ px: 2 }}>CNC</ToggleButton>
                      <ToggleButton value="BTST" sx={{ px: 2 }}>BTST</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {/* Start Time */}
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: '#495057' }}>
                      Start time
                    </Typography>
                    <TextField
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      size="small"
                      sx={{ bgcolor: 'white' }}
                    />
                  </Box>

                  {/* Square Off */}
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: '#495057' }}>
                      Square off
                    </Typography>
                    <TextField
                      type="time"
                      value={squareOffTime}
                      onChange={(e) => setSquareOffTime(e.target.value)}
                      size="small"
                      sx={{ bgcolor: 'white' }}
                    />
                  </Box>
                </Box>

                {/* Trading Days */}
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day) => (
                      <Chip
                        key={day}
                        label={day}
                        onClick={() => {
                          if (tradingDays.includes(day)) {
                            setTradingDays(tradingDays.filter(d => d !== day));
                          } else {
                            setTradingDays([...tradingDays, day]);
                          }
                        }}
                        color={tradingDays.includes(day) ? 'primary' : 'default'}
                        variant={tradingDays.includes(day) ? 'filled' : 'outlined'}
                        sx={{
                          cursor: 'pointer',
                          fontWeight: 500,
                          px: 2
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Readymade Templates Link */}
                <Box sx={{ mb: 4 }}>
                  <Button
                    onClick={() => setTabValue(3)}
                    sx={{ textTransform: 'none', color: '#4c6ef5', fontWeight: 500 }}
                    startIcon={<AssessmentIcon />}
                  >
                    Readymade Templates
                  </Button>
                </Box>

                {/* Order Legs */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Order Legs
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                      label="Strategy Name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="Enter strategy name"
                      size="small"
                    />
                    <TextField
                      label="Stop Loss %"
                      type="number"
                      value={createForm.stopLossPercent}
                      onChange={(e) => setCreateForm({ ...createForm, stopLossPercent: e.target.value })}
                      size="small"
                    />
                    <TextField
                      label="Target Profit %"
                      type="number"
                      value={createForm.targetPercent}
                      onChange={(e) => setCreateForm({ ...createForm, targetPercent: e.target.value })}
                      size="small"
                    />
                    <TextField
                      label="Position Size"
                      type="number"
                      value={createForm.positionSize}
                      onChange={(e) => setCreateForm({ ...createForm, positionSize: e.target.value })}
                      size="small"
                    />
                  </Box>
                </Box>

                {/* Create Button */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    size="large"
                    disabled={!createForm.name || creating}
                    onClick={handleCreate}
                    sx={{
                      bgcolor: '#4c6ef5',
                      textTransform: 'none',
                      px: 4,
                      borderRadius: 2,
                      '&:hover': { bgcolor: '#3b5bdb' }
                    }}
                  >
                    {creating ? 'Creating...' : 'Create Strategy'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => {
                      setCreateForm({ name: '', symbol: 'BANKNIFTY', timeframe: '5m', stopLossPercent: '1', targetPercent: '1', positionSize: '1', description: '' });
                      setSelectedInstruments([]);
                    }}
                    sx={{
                      textTransform: 'none',
                      px: 4,
                      borderRadius: 2
                    }}
                  >
                    Reset
                  </Button>
                </Box>
              </Box>
            )}

            {strategyType === 'indicator-based' && (
              <Card sx={{ p: 3, mb: 3 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>Indicator Based Strategy</Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Configure your indicator-based strategy rules
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                      label="Strategy Name *"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      required
                      size="small"
                    />
                    <TextField
                      label="Symbol"
                      value={createForm.symbol}
                      onChange={(e) => setCreateForm({ ...createForm, symbol: e.target.value })}
                      size="small"
                    />
                    <FormControl size="small">
                      <InputLabel id="tfm-label">Timeframe</InputLabel>
                      <Select labelId="tfm-label" label="Timeframe" value={createForm.timeframe} onChange={(e) => setCreateForm({ ...createForm, timeframe: e.target.value as string })}>
                        <MuiMenuItem value="1m">1 minute</MuiMenuItem>
                        <MuiMenuItem value="5m">5 minutes</MuiMenuItem>
                        <MuiMenuItem value="15m">15 minutes</MuiMenuItem>
                        <MuiMenuItem value="1h">1 hour</MuiMenuItem>
                        <MuiMenuItem value="1d">1 day</MuiMenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Description"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      multiline
                      rows={2}
                      size="small"
                    />
                    <TextField label="Entry Rule" placeholder="e.g., RSI < 30" size="small" />
                    <TextField label="Exit Rule" placeholder="e.g., RSI > 70" size="small" />
                    <TextField
                      label="Stop Loss %"
                      type="number"
                      value={createForm.stopLossPercent}
                      onChange={(e) => setCreateForm({ ...createForm, stopLossPercent: e.target.value })}
                      size="small"
                    />
                    <TextField
                      label="Target Profit %"
                      type="number"
                      value={createForm.targetPercent}
                      onChange={(e) => setCreateForm({ ...createForm, targetPercent: e.target.value })}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      disabled={!createForm.name || creating}
                      onClick={handleCreate}
                      sx={{
                        bgcolor: '#4c6ef5',
                        textTransform: 'none',
                        px: 4,
                        '&:hover': { bgcolor: '#3b5bdb' }
                      }}
                    >
                      {creating ? 'Creating...' : 'Create Strategy'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCreateForm({ name: '', symbol: 'BANKNIFTY', timeframe: '5m', stopLossPercent: '1', targetPercent: '1', positionSize: '1', description: '' });
                        setSelectedInstruments([]);
                      }}
                      sx={{ textTransform: 'none', px: 4 }}
                    >
                      Reset
                    </Button>
                  </Box>
                </Box>
              </Card>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {strategies.length > 0 ? (
            <Box>
              {strategies.map((strategy) => (
                <Card
                  key={strategy.id}
                  sx={{
                    mb: 1.5,
                    p: 2,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#6366f1',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                          {strategy.name}
                        </Typography>
                        <Chip
                          label={strategy.status === 'active' ? 'Active' : 'Draft'}
                          size="small"
                          color={strategy.status === 'active' ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                        {strategy.strategyType} • {strategy.segmentType}
                      </Typography>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={(e) => { setAnchorEl(e.currentTarget); setMenuFor(strategy.id); }}
                      sx={{
                        bgcolor: '#f8fafc',
                        '&:hover': { bgcolor: '#f1f5f9' }
                      }}
                    >
                      <MoreIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                        Start:
                      </Typography>
                      <Chip
                        label={strategy.startTime}
                        size="small"
                        sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#dcfce7', color: '#10b981', fontWeight: 600 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                        End:
                      </Typography>
                      <Chip
                        label={strategy.endTime}
                        size="small"
                        sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#fee2e2', color: '#ef4444', fontWeight: 600 }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                    {strategy.instruments.slice(0, 3).map((inst, idx) => (
                      <Chip
                        key={idx}
                        label={inst}
                        size="small"
                        sx={{
                          bgcolor: '#f1f5f9',
                          color: '#475569',
                          fontSize: '0.7rem',
                          height: 20,
                          fontWeight: 500
                        }}
                      />
                    ))}
                    {strategy.instruments.length > 3 && (
                      <Chip
                        label={`+${strategy.instruments.length - 3} more`}
                        size="small"
                        sx={{
                          bgcolor: '#e0e7ff',
                          color: '#6366f1',
                          fontSize: '0.7rem',
                          height: 20,
                          fontWeight: 600
                        }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AssessmentIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.8125rem',
                        py: 0.5,
                        px: 2,
                        borderColor: '#e2e8f0',
                        color: '#64748b',
                        '&:hover': {
                          borderColor: '#6366f1',
                          color: '#6366f1',
                          bgcolor: 'rgba(99, 102, 241, 0.04)'
                        }
                      }}
                      onClick={async () => {
                        setBacktestDialog({ open: true, strategyId: strategy.id });
                        setBacktesting(true);
                        try {
                          const results = await apiService.get(`/api/strategy-test/quick-backtest?days=30`);
                          setBacktestResults(results);
                        } catch (error) {
                          console.error('Backtest failed:', error);
                          setBacktestResults({ error: 'Failed to run backtest' });
                        } finally {
                          setBacktesting(false);
                        }
                      }}
                    >
                      Backtest
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlayIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.8125rem',
                        py: 0.5,
                        px: 2,
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        }
                      }}
                      onClick={() => { setDeployOpen({ open: true, strategy }); setDeployAccept(false); }}
                    >
                      Deploy
                    </Button>
                  </Box>
                </Card>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
                No Strategies Yet
              </Typography>
              <Typography variant="body2" sx={{ color: '#adb5bd', mb: 3 }}>
                Create your first strategy to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  bgcolor: '#4c6ef5',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3
                }}
              >
                Create Strategy
              </Button>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {strategies.filter(s => s.status === 'active').length > 0 ? (
            <Box>
              <TextField
                placeholder="Search Deployed Strategies"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ mb: 3, maxWidth: 400 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#adb5bd' }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2, bgcolor: '#f8f9fa' }
                }}
              />
              {strategies.filter(s => s.status === 'active').map((strategy) => (
                <Card
                  key={strategy.id}
                  sx={{
                    mb: 2,
                    p: 3,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    border: '1px solid #f1f3f5'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip label="Live" size="small" color="success" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                          {strategy.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#868e96', mb: 2, fontSize: '0.85rem' }}>
                        By {strategy.author}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto', gap: 4, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box component="span" sx={{ fontSize: '1rem' }}>⏰</Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: '#868e96', display: 'block', fontSize: '0.7rem' }}>
                              Start Time
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#51cf66', fontSize: '0.9rem' }}>
                              {strategy.startTime}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box component="span" sx={{ fontSize: '1rem' }}>⏰</Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: '#868e96', display: 'block', fontSize: '0.7rem' }}>
                              End Time
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff6b6b', fontSize: '0.9rem' }}>
                              {strategy.endTime}
                            </Typography>
                          </Box>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block', fontSize: '0.7rem' }}>
                            Segment Type
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {strategy.segmentType}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block', fontSize: '0.7rem' }}>
                            Strategy Type
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {strategy.strategyType}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {strategy.instruments.map((inst, idx) => (
                          <Chip
                            key={idx}
                            label={inst}
                            size="small"
                            sx={{
                              bgcolor: '#f1f3f5',
                              color: '#495057',
                              fontSize: '0.7rem',
                              height: '22px',
                              borderRadius: '4px'
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<StopIcon />}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 2,
                          borderColor: '#ff6b6b',
                          color: '#ff6b6b',
                          '&:hover': { bgcolor: '#ffe0e0', borderColor: '#ff5252' }
                        }}
                        onClick={() => {
                          setConfirmDialog({
                            open: true,
                            message: 'Pause this deployed strategy?',
                            onConfirm: async () => {
                              await firestoreService.updateStrategy(strategy.id, { status: 'paused' } as any);
                              setStrategies(prev => prev.map(p => p.id === strategy.id ? { ...p, status: 'draft' } : p));
                              setConfirmDialog({ open: false, message: '', onConfirm: () => { } });
                            }
                          });
                        }}
                      >
                        Pause
                      </Button>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Box
                component="img"
                src="/empty-state.svg"
                sx={{ width: 200, height: 200, mb: 3, opacity: 0.6 }}
              />
              <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
                No Deployed Strategy
              </Typography>
              <Typography variant="body2" sx={{ color: '#adb5bd', mb: 3 }}>
                Deploy a strategy from My Strategies or Strategy Template to see it here
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  bgcolor: '#4c6ef5',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3,
                  mt: 2
                }}
                onClick={() => setTabValue(3)}
              >
                View Templates
              </Button>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Strategy Templates
            </Typography>
            {/* Category Filters */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
              <Chip
                label="All"
                onClick={() => setTemplateFilter('All')}
                color={templateFilter === 'All' ? 'primary' : 'default'}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Basic"
                onClick={() => setTemplateFilter('Basic')}
                color={templateFilter === 'Basic' ? 'primary' : 'default'}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="HNI & Retail"
                onClick={() => setTemplateFilter('HNI')}
                color={templateFilter === 'HNI' ? 'primary' : 'default'}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Retail"
                onClick={() => setTemplateFilter('Retail')}
                color={templateFilter === 'Retail' ? 'primary' : 'default'}
                sx={{ cursor: 'pointer' }}
              />
            </Box>

            {/* Search */}
            <TextField
              placeholder="Search Templates"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ maxWidth: 400, mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#adb5bd' }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2, bgcolor: '#f8f9fa' }
              }}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            {filteredTemplates
              .filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((template: StrategyTemplate) => (
                <Box key={template.id}>
                  <Card
                    sx={{
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      borderRadius: 3,
                      border: '1px solid #f1f3f5',
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Box sx={{ p: 2, pb: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {template.name}
                        </Typography>
                        <Chip
                          label={template.category}
                          size="small"
                          color={template.category === 'HNI' ? 'primary' : template.category === 'Retail' ? 'secondary' : 'default'}
                          sx={{ ml: 1 }}
                        />
                      </Box>
                      {template.description && (
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                          {template.description}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ height: 180, px: 2 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(templateCharts[template.id]?.equity || []).map(p => ({ date: p.x, value: p.y }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis hide />
                          <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)}`, 'Equity']} />
                          <Line type="monotone" dataKey="value" stroke="#4c6ef5" dot={false} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                            Max DD
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#51cf66' }}>
                            {template.maxDD}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                            Margin
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#51cf66' }}>
                            {template.margin}
                          </Typography>
                        </Box>
                      </Box>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        sx={{
                          textTransform: 'none',
                          borderRadius: 2,
                          borderColor: '#4c6ef5',
                          color: '#4c6ef5',
                          '&:hover': { bgcolor: '#e7f5ff' }
                        }}
                        onClick={() => { setDeployOpen({ open: true, template }); setDeployAccept(false); }}
                      >
                        Add to my strategy
                      </Button>
                    </Box>
                  </Card>
                </Box>
              ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <MyPortfolioSection isActive={tabValue === 4} />
        </TabPanel>

        {/* Duplicate dialog */}
        <DuplicateDialog
          open={dupOpen.open}
          strategyName={dupName}
          setStrategyName={setDupName}
          onClose={() => setDupOpen({ open: false })}
          onDuplicate={async () => {
            const tpl = dupOpen.template as StrategyTemplate | undefined;
            if (tpl) {
              const uid = auth.currentUser?.uid;
              if (!uid) { setDupOpen({ open: false }); return; }
              const newId = await firestoreService.addStrategy(uid, {
                name: dupName || tpl.name,
                description: tpl.name,
                instrumentType: 'OPTION',
                symbol: 'BANKNIFTY',
                timeframe: '5m',
                entryRule: 'template',
                exitRule: 'template',
                stopLossPercent: 1.0,
                targetPercent: 1.0,
                positionSize: 1,
                status: 'draft',
                createdAt: null as any,
                updatedAt: null as any
              } as any);
              setStrategies(prev => [{
                id: newId,
                name: dupName || tpl.name,
                author: uid,
                startTime: '09:22',
                endTime: '16:11',
                segmentType: 'OPTION',
                strategyType: 'Time Based',
                instruments: ['SELL NIFTY BANK ATM 0 CE', 'SELL NIFTY BANK ATM 0 PE'],
                status: 'draft'
              }, ...prev]);
            }
            setDupOpen({ open: false });
          }}
        />

        {/* Deploy dialog */}
        <DeployDialog
          open={deployOpen.open}
          form={deployForm}
          setForm={setDeployForm}
          accept={deployAccept}
          setAccept={setDeployAccept}
          onClose={() => setDeployOpen({ open: false })}
          strategyName={deployOpen.strategy?.name || deployOpen.template?.name}
          onDeploy={async () => {
            try {
              const uid = auth.currentUser?.uid;
              if (!uid) { setDeployOpen({ open: false }); return; }

              let strategyId: string;

              // If deploying from template, create strategy first
              if (deployOpen.template) {
                const newId = await firestoreService.addStrategy(uid, {
                  name: deployOpen.template.name,
                  description: deployOpen.template.name,
                  instrumentType: 'OPTION',
                  symbol: 'BANKNIFTY',
                  timeframe: '5m',
                  entryRule: 'template',
                  exitRule: 'template',
                  stopLossPercent: 1.0,
                  targetPercent: 1.0,
                  positionSize: 1,
                  status: 'draft',
                  createdAt: null as any,
                  updatedAt: null as any
                } as any);
                strategyId = newId;
                // Add to local state
                setStrategies(prev => [{
                  id: newId,
                  name: deployOpen.template!.name,
                  author: uid,
                  startTime: '09:22',
                  endTime: '16:11',
                  segmentType: 'OPTION',
                  strategyType: 'Time Based',
                  instruments: ['SELL NIFTY BANK ATM 0 CE', 'SELL NIFTY BANK ATM 0 PE'],
                  status: 'draft'
                }, ...prev]);
              } else if (deployOpen.strategy) {
                strategyId = deployOpen.strategy.id;
              } else {
                setDeployOpen({ open: false });
                return;
              }

              // Deploy the strategy
              try {
                await apiService.post('/api/strategies/deploy', {
                  strategyId,
                  qtyMultiplier: Number(deployForm.qtyMultiplier) || 1,
                  maxProfit: Number(deployForm.maxProfit) || 0,
                  maxLoss: Number(deployForm.maxLoss) || 0,
                  broker: deployForm.broker,
                  squareOff: deployForm.squareOff,
                  type: deployForm.type
                });
              } catch (error: any) {
                // Log error but continue with Firestore update
                console.warn('Deploy API call failed, but updating Firestore status:', error.message);
                // You might want to show a toast notification here
              }

              // Update status to live in Firestore (always do this even if API fails)
              await firestoreService.updateStrategy(strategyId, { status: 'live' } as any);
              setStrategies(prev => prev.map(p => p.id === strategyId ? { ...p, status: 'active' } : p));

              // Refresh strategies list
              const rows = await firestoreService.getStrategies(uid);
              const mapped: MyStrategyCard[] = rows.map(r => ({
                id: r.id,
                name: r.name,
                author: uid,
                startTime: '09:22',
                endTime: '16:11',
                segmentType: 'OPTION',
                strategyType: 'Time Based',
                instruments: [r.symbol || 'SELL NIFTY BANK ATM 0 CE', 'SELL NIFTY BANK ATM 0 PE'],
                status: r.status === 'live' ? 'active' : 'draft'
              }));
              setStrategies(mapped);
            } finally {
              setDeployOpen({ open: false });
            }
          }}
        />

        {/* Per-card menu for My Strategies */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => { setAnchorEl(null); setMenuFor(null); }}
        >
          <MenuItem onClick={() => {
            const s = strategies.find(x => x.id === menuFor);
            if (!s) { setAnchorEl(null); setMenuFor(null); return; }
            setAnchorEl(null);
            setMenuFor(null);
            // Navigate to edit page or open edit dialog
            navigate(`/strategies/edit/${s.id}`);
          }}>Edit</MenuItem>
          <MenuItem onClick={async () => {
            const s = strategies.find(x => x.id === menuFor);
            if (!s) { setAnchorEl(null); setMenuFor(null); return; }
            setDupName(`${s.name} Copy`);
            setDupOpen({ open: true, template: { id: 0, name: s.name, category: 'Basic', maxDD: '0', margin: '0', chart: '' } });
            setAnchorEl(null); setMenuFor(null);
          }}>Duplicate</MenuItem>
          <MenuItem onClick={() => {
            const s = strategies.find(x => x.id === menuFor);
            if (!s) { setAnchorEl(null); setMenuFor(null); return; }
            setAnchorEl(null);
            setMenuFor(null);
            setRenameDialog({ open: true, strategyId: s.id, currentName: s.name, newName: s.name });
          }}>Rename</MenuItem>
          <MenuItem onClick={() => {
            const s = strategies.find(x => x.id === menuFor);
            if (!s) { setAnchorEl(null); setMenuFor(null); return; }
            setAnchorEl(null);
            setMenuFor(null);
            setConfirmDialog({
              open: true,
              message: 'Delete this strategy?',
              onConfirm: async () => {
                await firestoreService.deleteStrategy(s.id);
                setStrategies(prev => prev.filter(p => p.id !== s.id));
                setConfirmDialog({ open: false, message: '', onConfirm: () => { } });
              }
            });
          }}>Delete</MenuItem>
        </Menu>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, message: '', onConfirm: () => { } })}>
          <DialogTitle>Confirm</DialogTitle>
          <DialogContent>
            <Typography>{confirmDialog.message}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog({ open: false, message: '', onConfirm: () => { } })}>Cancel</Button>
            <Button variant="contained" color="primary" onClick={() => {
              confirmDialog.onConfirm();
            }}>Confirm</Button>
          </DialogActions>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={renameDialog.open} onClose={() => setRenameDialog({ open: false, strategyId: '', currentName: '', newName: '' })}>
          <DialogTitle>Rename Strategy</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Strategy Name"
              value={renameDialog.newName}
              onChange={(e) => setRenameDialog({ ...renameDialog, newName: e.target.value })}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenameDialog({ open: false, strategyId: '', currentName: '', newName: '' })}>Cancel</Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (renameDialog.newName.trim()) {
                  await firestoreService.updateStrategy(renameDialog.strategyId, { name: renameDialog.newName.trim() } as any);
                  setStrategies(prev => prev.map(p => p.id === renameDialog.strategyId ? { ...p, name: renameDialog.newName.trim() } : p));
                }
                setRenameDialog({ open: false, strategyId: '', currentName: '', newName: '' });
              }}
              disabled={!renameDialog.newName.trim()}
            >
              Rename
            </Button>
          </DialogActions>
        </Dialog>

        {/* Backtest Results Dialog */}
        <BacktestResultsDialog
          open={backtestDialog.open}
          results={backtestResults}
          loading={backtesting}
          onClose={() => {
            setBacktestDialog({ open: false, strategyId: null });
            setBacktestResults(null);
          }}
        />

        {/* Instrument Selection Dialog */}
        <Dialog
          open={instrumentDialogOpen}
          onClose={() => setInstrumentDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <TextField
              fullWidth
              placeholder="Search scripts: e.g., State Bank Of India, Banknifty, Crudeoil"
              size="small"
              value={instrumentSearch}
              onChange={(e) => setInstrumentSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </DialogTitle>
          <DialogContent>
            <Box>
              <ToggleButtonGroup
                value={selectedInstrumentType}
                exclusive
                onChange={(e, value) => value && setSelectedInstrumentType(value)}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
              >
                <ToggleButton value="OPTIONS">Options</ToggleButton>
                <ToggleButton value="EQUITY">Equity</ToggleButton>
                <ToggleButton value="FUTURES">Futures</ToggleButton>
                <ToggleButton value="INDICES">Indices</ToggleButton>
                <ToggleButton value="CDS">CDS</ToggleButton>
                <ToggleButton value="MCX">MCX</ToggleButton>
              </ToggleButtonGroup>
              <Stack spacing={1} sx={{ mt: 2, maxHeight: 400, overflowY: 'auto' }}>
                {filteredInstruments.length > 0 ? (
                  filteredInstruments.map((instrument) => (
                    <Button
                      key={instrument}
                      variant={selectedInstruments.includes(instrument) ? "contained" : "outlined"}
                      fullWidth
                      onClick={() => handleSelectInstrument(instrument)}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      disabled={selectedInstruments.includes(instrument)}
                    >
                      {instrument}
                      {selectedInstruments.includes(instrument) && ' ✓'}
                    </Button>
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                    No instruments found
                  </Typography>
                )}
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setInstrumentSearch('');
              setInstrumentDialogOpen(false);
            }}>
              Done
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Strategies;

// Backtest Results Dialog Component
function BacktestResultsDialog({ open, results, loading, onClose }: {
  open: boolean;
  results: any;
  loading: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const r = results?.results || results;
  const equityData = r?.dailyResults?.map((d: any, idx: number) => {
    const running = r.dailyResults.slice(0, idx + 1).reduce((sum: number, day: any) => sum + (day.profit || 0), 0);
    return { date: d.date, value: running };
  }) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Backtest Results</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>Running backtest...</Typography>
          </Box>
        ) : results?.error ? (
          <Alert severity="error">{results.error}</Alert>
        ) : r ? (
          <Box>
            {/* Key Metrics */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
              <Card sx={{ p: 2 }}>
                <Typography variant="caption" color="textSecondary">Total Trades</Typography>
                <Typography variant="h5">{r.totalTrades || 0}</Typography>
              </Card>
              <Card sx={{ p: 2 }}>
                <Typography variant="caption" color="textSecondary">Win Rate</Typography>
                <Typography variant="h5" color={(r.winRate || 0) >= 50 ? 'success.main' : 'error.main'}>
                  {(r.winRate || 0).toFixed(2)}%
                </Typography>
              </Card>
              <Card sx={{ p: 2 }}>
                <Typography variant="caption" color="textSecondary">Net Profit</Typography>
                <Typography variant="h5" color={(r.netProfit || 0) >= 0 ? 'success.main' : 'error.main'}>
                  ₹{(r.netProfit || 0).toFixed(2)}
                </Typography>
              </Card>
              <Card sx={{ p: 2 }}>
                <Typography variant="caption" color="textSecondary">Profit Factor</Typography>
                <Typography variant="h5">{(r.profitFactor || 0).toFixed(2)}</Typography>
              </Card>
            </Box>

            {/* Additional Metrics */}
            {r.maxDrawdown !== undefined && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 3 }}>
                <Card sx={{ p: 2 }}>
                  <Typography variant="caption" color="textSecondary">Max Drawdown</Typography>
                  <Typography variant="h6" color="error.main">₹{(r.maxDrawdown || 0).toFixed(2)}</Typography>
                </Card>
                <Card sx={{ p: 2 }}>
                  <Typography variant="caption" color="textSecondary">Total Profit</Typography>
                  <Typography variant="h6" color="success.main">₹{(r.totalProfit || 0).toFixed(2)}</Typography>
                </Card>
              </Box>
            )}

            {/* Equity Curve */}
            {equityData.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Equity Curve</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)}`, 'Equity']} />
                      <Line type="monotone" dataKey="value" stroke="#4c6ef5" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            )}

            {/* Trade History */}
            {r.trades && r.trades.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>Recent Trades (Last 10)</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Entry Time</TableCell>
                        <TableCell>Exit Time</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Profit</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {r.trades.slice(0, 10).map((t: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{new Date(t.entryTime).toLocaleString()}</TableCell>
                          <TableCell>{new Date(t.exitTime).toLocaleString()}</TableCell>
                          <TableCell>{t.type}</TableCell>
                          <TableCell align="right" sx={{ color: (t.profit || 0) >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                            ₹{(t.profit || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>{t.reason || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {(!r.trades || r.trades.length === 0) && (
              <Alert severity="info">No trades executed during backtest period</Alert>
            )}
          </Box>
        ) : (
          <Alert severity="info">No backtest data available</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// Duplicate Dialog
function DuplicateDialog({ open, strategyName, setStrategyName, onClose, onDuplicate }:
  { open: boolean; strategyName: string; setStrategyName: (name: string) => void; onClose: () => void; onDuplicate: () => void; }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Duplicate MX Strategies</DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Box sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: '#FFA726',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <Typography variant="h3" sx={{ color: 'white', fontWeight: 'bold' }}>!</Typography>
          </Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Are you sure you want to duplicate this Strategy?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This action will create one more strategy of same type.
          </Typography>
        </Box>
        <TextField
          fullWidth
          label="Name Of Duplicate Strategy"
          value={strategyName}
          onChange={(e) => setStrategyName(e.target.value)}
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined" sx={{ px: 4 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onDuplicate}
          disabled={!strategyName.trim()}
          sx={{ px: 4 }}
        >
          Duplicate
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Deploy Dialog
function DeployDialog({ open, form, setForm, accept, setAccept, onClose, onDeploy, strategyName }:
  { open: boolean; form: any; setForm: (f: any) => void; accept: boolean; setAccept: (v: boolean) => void; onClose: () => void; onDeploy: () => void; strategyName?: string; }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Deploy {strategyName || 'Strategy'}</DialogTitle>
      <DialogContent>
        {strategyName && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>Strategy:</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{strategyName}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <TextField fullWidth label="Quantity Multiplied" value={form.qtyMultiplier} onChange={(e) => setForm({ ...form, qtyMultiplier: e.target.value })} />
          <TextField fullWidth label="Broker Name" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} />
          <TextField fullWidth label="Max Profit (Optional)" value={form.maxProfit} onChange={(e) => setForm({ ...form, maxProfit: e.target.value })} />
          <TextField fullWidth label="Square Off Time" value={form.squareOff} onChange={(e) => setForm({ ...form, squareOff: e.target.value })} />
          <TextField fullWidth label="Max Loss (Optional)" value={form.maxLoss} onChange={(e) => setForm({ ...form, maxLoss: e.target.value })} />
          <TextField fullWidth label="Deployment Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          <Checkbox checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <Typography variant="body2">I accept all the <a href="#">terms & conditions</a></Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!accept} onClick={onDeploy}>Deploy</Button>
      </DialogActions>
    </Dialog>
  );
}

// My Portfolio (trades) section
function MyPortfolioSection({ isActive }: { isActive: boolean }) {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // Only load data when tab becomes active and hasn't been loaded yet
    if (!isActive || hasLoaded) return;

    const load = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) { setTrades([]); return; }
        const rows = await firestoreService.getTrades(uid);
        setTrades(rows);
        setHasLoaded(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isActive, hasLoaded]);

  if (loading) {
    return <Box sx={{ textAlign: 'center', py: 6 }}><Typography>Loading portfolio...</Typography></Box>;
  }

  if (trades.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
          No Portfolio summary. Create Bucket!
        </Typography>
      </Box>
    );
  }

  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>My Portfolio</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Card sx={{ p: 2 }}>
          <Typography variant="body2" color="textSecondary">Total Trades</Typography>
          <Typography variant="h5">{trades.length}</Typography>
        </Card>
        <Card sx={{ p: 2 }}>
          <Typography variant="body2" color="textSecondary">Total P&L</Typography>
          <Typography variant="h5" color={totalPnl >= 0 ? 'success.main' : 'error.main'}>₹{totalPnl.toFixed(2)}</Typography>
        </Card>
      </Box>
      {trades.map((t) => (
        <Card key={t.id} sx={{ mb: 1, p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography>{t.symbol} • {t.transactionType} • {t.quantity} @ ₹{t.price}</Typography>
          <Typography color={(t.pnl || 0) >= 0 ? 'success.main' : 'error.main'}>₹{(t.pnl || 0).toFixed(2)}</Typography>
        </Card>
      ))}
    </Box>
  );
}
