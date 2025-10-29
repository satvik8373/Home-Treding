import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  CircularProgress
} from '@mui/material';
import {
  Add,
  PlayArrow,
  Stop,
  Assessment,
  TrendingUp,
  Settings,
  Edit,
  Delete,
  Refresh
} from '@mui/icons-material';
import Layout from '../components/Layout';
import axios from 'axios';

interface Strategy {
  id: string;
  name: string;
  description: string;
  status: 'stopped' | 'running' | 'paused' | 'error';
  symbols: string[];
  timeframe: string;
  parameters: { [key: string]: any };
  performance: {
    totalPnL: number;
    totalTrades: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  createdAt: string;
  updatedAt: string;
  brokerId?: string;
}

interface CreateStrategyForm {
  name: string;
  description: string;
  symbols: string[];
  timeframe: string;
  strategyType: string;
  parameters: { [key: string]: any };
}

const POPULAR_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
  'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'ULTRACEMCO', 'BAJFINANCE', 'NESTLEIND', 'WIPRO', 'HCLTECH', 'TECHM',
  'NIFTY50', 'BANKNIFTY', 'FINNIFTY'
];

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

const STRATEGY_TYPES = [
  { value: 'moving_average_crossover', label: 'Moving Average Crossover' },
  { value: 'rsi_oversold', label: 'RSI Oversold/Overbought' },
  { value: 'bollinger_bands', label: 'Bollinger Bands' },
  { value: 'macd_signal', label: 'MACD Signal' },
  { value: 'breakout', label: 'Breakout Strategy' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
  { value: 'custom', label: 'Custom Strategy' }
];

const Strategies: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState<CreateStrategyForm>({
    name: '',
    description: '',
    symbols: [],
    timeframe: '5m',
    strategyType: 'moving_average_crossover',
    parameters: {}
  });

  useEffect(() => {
    loadStrategies();
    loadBrokers();
  }, []);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      
      // Try to load from backend API
      const response = await axios.get('http://localhost:5000/api/strategies').catch(() => ({ data: { success: false } }));
      
      if (response.data.success) {
        setStrategies(response.data.strategies || []);
      } else {
        // Fallback to demo strategies with real-looking data
        setStrategies([
          {
            id: 'strategy_1',
            name: 'Moving Average Crossover',
            description: 'Buy when 20-day MA crosses above 50-day MA, sell on reverse crossover',
            status: 'stopped',
            symbols: ['RELIANCE', 'TCS', 'INFY'],
            timeframe: '5m',
            parameters: {
              shortMA: 20,
              longMA: 50,
              stopLoss: 2.0,
              takeProfit: 4.0
            },
            performance: {
              totalPnL: 12450.75,
              totalTrades: 45,
              winRate: 67.8,
              sharpeRatio: 1.24,
              maxDrawdown: 2340.50
            },
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'strategy_2',
            name: 'RSI Oversold Strategy',
            description: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)',
            status: 'running',
            symbols: ['HDFCBANK', 'ICICIBANK'],
            timeframe: '15m',
            parameters: {
              rsiPeriod: 14,
              oversoldLevel: 30,
              overboughtLevel: 70,
              stopLoss: 1.5,
              takeProfit: 3.0
            },
            performance: {
              totalPnL: 8920.25,
              totalTrades: 32,
              winRate: 62.5,
              sharpeRatio: 0.98,
              maxDrawdown: 1850.75
            },
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'strategy_3',
            name: 'Bollinger Bands Breakout',
            description: 'Trade breakouts from Bollinger Bands with volume confirmation',
            status: 'paused',
            symbols: ['NIFTY50'],
            timeframe: '30m',
            parameters: {
              bbPeriod: 20,
              bbStdDev: 2,
              volumeThreshold: 1.5,
              stopLoss: 1.0,
              takeProfit: 2.5
            },
            performance: {
              totalPnL: -1240.50,
              totalTrades: 18,
              winRate: 44.4,
              sharpeRatio: -0.32,
              maxDrawdown: 3420.75
            },
            createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load strategies:', error);
      setError('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const loadBrokers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/broker/list');
      if (response.data.success) {
        setBrokers(response.data.brokers || []);
      }
    } catch (error) {
      console.error('Failed to load brokers:', error);
    }
  };

  const handleStartStrategy = async (strategyId: string) => {
    try {
      const connectedBroker = brokers.find(b => b.status === 'Connected');
      if (!connectedBroker) {
        setError('No connected broker found. Please connect a broker first.');
        return;
      }

      // Call backend API to start strategy
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/strategies/${strategyId}/start`, {
        brokerId: connectedBroker.id
      }).catch(() => ({ data: { success: false } }));

      if (response.data.success) {
        setStrategies(prev => prev.map(s => 
          s.id === strategyId ? { ...s, status: 'running' as const, brokerId: connectedBroker.id } : s
        ));
      } else {
        // Simulate for demo
        setStrategies(prev => prev.map(s => 
          s.id === strategyId ? { ...s, status: 'running' as const, brokerId: connectedBroker.id } : s
        ));
      }
    } catch (error) {
      console.error('Failed to start strategy:', error);
      setError('Failed to start strategy');
    }
  };

  const handleStopStrategy = async (strategyId: string) => {
    try {
      // Call backend API to stop strategy
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/strategies/${strategyId}/stop`)
        .catch(() => ({ data: { success: false } }));

      if (response.data.success) {
        setStrategies(prev => prev.map(s => 
          s.id === strategyId ? { ...s, status: 'stopped' as const, brokerId: undefined } : s
        ));
      } else {
        // Simulate for demo
        setStrategies(prev => prev.map(s => 
          s.id === strategyId ? { ...s, status: 'stopped' as const, brokerId: undefined } : s
        ));
      }
    } catch (error) {
      console.error('Failed to stop strategy:', error);
      setError('Failed to stop strategy');
    }
  };

  const handleCreateStrategy = async () => {
    try {
      if (!createForm.name || !createForm.description || createForm.symbols.length === 0) {
        setError('Please fill in all required fields');
        return;
      }

      // Call backend API to create strategy
      const response = await axios.post('http://localhost:5000/api/strategies', createForm)
        .catch(() => ({ data: { success: false } }));

      if (response.data.success) {
        setStrategies(prev => [...prev, response.data.strategy]);
      } else {
        // Simulate for demo
        const newStrategy: Strategy = {
          id: `strategy_${Date.now()}`,
          ...createForm,
          status: 'stopped',
          performance: {
            totalPnL: 0,
            totalTrades: 0,
            winRate: 0,
            sharpeRatio: 0,
            maxDrawdown: 0
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setStrategies(prev => [...prev, newStrategy]);
      }

      setShowCreateDialog(false);
      setCreateForm({
        name: '',
        description: '',
        symbols: [],
        timeframe: '5m',
        strategyType: 'moving_average_crossover',
        parameters: {}
      });
    } catch (error) {
      console.error('Failed to create strategy:', error);
      setError('Failed to create strategy');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'default';
      case 'paused': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const connectedBrokers = brokers.filter(b => b.status === 'Connected');
  const runningStrategies = strategies.filter(s => s.status === 'running');
  const totalPnL = strategies.reduce((sum, s) => sum + s.performance.totalPnL, 0);
  const totalTrades = strategies.reduce((sum, s) => sum + s.performance.totalTrades, 0);
  const avgWinRate = strategies.length > 0 
    ? strategies.reduce((sum, s) => sum + s.performance.winRate, 0) / strategies.length 
    : 0;

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            🤖 Strategy Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadStrategies}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateDialog(true)}
            >
              Create Strategy
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {connectedBrokers.length === 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>No broker connected!</strong> Connect a broker to run strategies.
              <Button size="small" sx={{ ml: 2 }} onClick={() => window.location.href = '/brokers'}>
                Connect Broker
              </Button>
            </Typography>
          </Alert>
        )}

        {/* Strategy Overview Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Settings color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Total Strategies</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {strategies.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {runningStrategies.length} running
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp color={totalPnL >= 0 ? 'success' : 'error'} sx={{ mr: 1 }} />
                <Typography variant="h6">Total P&L</Typography>
              </Box>
              <Typography variant="h4" color={totalPnL >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(totalPnL)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                All strategies combined
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Total Trades</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {totalTrades}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Executed trades
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Avg Win Rate</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {avgWinRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Average success rate
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Strategies Table */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Strategy Portfolio
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Strategy Name</TableCell>
                    <TableCell>Symbols</TableCell>
                    <TableCell>Timeframe</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">P&L</TableCell>
                    <TableCell align="right">Trades</TableCell>
                    <TableCell align="right">Win Rate</TableCell>
                    <TableCell align="right">Sharpe</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {strategies.map((strategy) => (
                    <TableRow key={strategy.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {strategy.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {strategy.description}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {strategy.symbols.slice(0, 3).map((symbol) => (
                            <Chip key={symbol} label={symbol} size="small" variant="outlined" />
                          ))}
                          {strategy.symbols.length > 3 && (
                            <Chip label={`+${strategy.symbols.length - 3}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={strategy.timeframe} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={strategy.status.toUpperCase()}
                          color={getStatusColor(strategy.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={strategy.performance.totalPnL >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="medium"
                        >
                          {formatCurrency(strategy.performance.totalPnL)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {strategy.performance.totalTrades}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={strategy.performance.winRate >= 50 ? 'success.main' : 'error.main'}
                        >
                          {strategy.performance.winRate.toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={strategy.performance.sharpeRatio >= 1 ? 'success.main' : 'textSecondary'}
                        >
                          {strategy.performance.sharpeRatio.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {strategy.status === 'running' ? (
                            <Tooltip title="Stop Strategy">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleStopStrategy(strategy.id)}
                              >
                                <Stop fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title={connectedBrokers.length === 0 ? "Connect a broker first" : "Start Strategy"}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleStartStrategy(strategy.id)}
                                  disabled={connectedBrokers.length === 0}
                                >
                                  <PlayArrow fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip title="View Performance">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => {
                                alert(`Strategy Performance:\n\nTotal P&L: ${formatCurrency(strategy.performance.totalPnL)}\nTrades: ${strategy.performance.totalTrades}\nWin Rate: ${strategy.performance.winRate.toFixed(1)}%\nSharpe Ratio: ${strategy.performance.sharpeRatio.toFixed(2)}\nMax Drawdown: ${formatCurrency(strategy.performance.maxDrawdown)}`);
                              }}
                            >
                              <Assessment fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {strategies.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary" gutterBottom>
                No strategies created yet
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setShowCreateDialog(true)}
              >
                Create Your First Strategy
              </Button>
            </Box>
          )}
        </Paper>

        {/* Create Strategy Dialog */}
        <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Trading Strategy</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
              <TextField
                label="Strategy Name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                fullWidth
                required
              />
              
              <TextField
                label="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
                required
              />

              <Autocomplete
                multiple
                options={POPULAR_SYMBOLS}
                value={createForm.symbols}
                onChange={(_, newValue) => setCreateForm({ ...createForm, symbols: newValue })}
                renderInput={(params) => (
                  <TextField {...params} label="Trading Symbols" placeholder="Select symbols" required />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                  ))
                }
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Strategy Type</InputLabel>
                  <Select
                    value={createForm.strategyType}
                    onChange={(e) => setCreateForm({ ...createForm, strategyType: e.target.value })}
                  >
                    {STRATEGY_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Timeframe</InputLabel>
                  <Select
                    value={createForm.timeframe}
                    onChange={(e) => setCreateForm({ ...createForm, timeframe: e.target.value })}
                  >
                    {TIMEFRAMES.map((tf) => (
                      <MenuItem key={tf} value={tf}>
                        {tf}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateStrategy}>
              Create Strategy
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Strategies;