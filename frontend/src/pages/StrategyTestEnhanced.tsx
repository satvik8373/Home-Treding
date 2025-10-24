import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  PlayArrow, 
  Assessment, 
  TrendingUp, 
  TrendingDown, 
  Refresh,
  ShowChart,
  Business,
  Public,
  AttachMoney
} from '@mui/icons-material';
import Layout from '../components/Layout';
import TradingViewChart from '../components/TradingViewChart';
import marketDataService, { MarketData } from '../services/marketDataService';
import apiService from '../services/apiService';

interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  maxDrawdown: number;
  profitFactor: number;
  trades: TradeResult[];
  dailyResults: DailyResult[];
}

interface TradeResult {
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  type: 'call' | 'put';
  profit: number;
  reason: string;
}

interface DailyResult {
  date: string;
  trades: number;
  profit: number;
  gapFilterPassed: boolean;
  firstCandleClose: number | null;
  upperTrigger: number | null;
  lowerTrigger: number | null;
}

const StrategyTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [error, setError] = useState('');
  const [days, setDays] = useState(5);
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY 50');
  const [livePrice, setLivePrice] = useState<MarketData | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [useLiveData, setUseLiveData] = useState(false);

  // Popular symbols for strategy testing
  const symbolOptions = [
    'NIFTY 50',
    'BANKNIFTY', 
    'FINNIFTY',
    'RELIANCE',
    'TCS',
    'INFY',
    'HDFC',
    'ICICIBANK'
  ];

  // Fetch live price for selected symbol
  const fetchLivePrice = async () => {
    try {
      const data = await marketDataService.getNSEPrice(selectedSymbol);
      setLivePrice(data);
    } catch (err) {
      console.error('Failed to fetch live price:', err);
    }
  };

  useEffect(() => {
    fetchLivePrice();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLivePrice, 30000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const runQuickBacktest = async () => {
    try {
      setLoading(true);
      setError('');
      setResults(null);

      const response = await apiService.get<{
        success: boolean;
        results?: BacktestResult;
        message?: string;
      }>(
        `/api/strategy-test/quick-backtest?days=${days}&symbol=${selectedSymbol}&useLiveData=${useLiveData}`
      );

      if (response.success) {
        setResults(response.results!);
      } else {
        setError(response.message || 'Backtest failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to run backtest');
      console.error('Backtest error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getSymbolForChart = (symbol: string) => {
    const chartSymbols: { [key: string]: string } = {
      'NIFTY 50': 'NSE:NIFTY50',
      'BANKNIFTY': 'NSE:BANKNIFTY',
      'FINNIFTY': 'NSE:FINNIFTY',
      'RELIANCE': 'NSE:RELIANCE',
      'TCS': 'NSE:TCS',
      'INFY': 'NSE:INFY',
      'HDFC': 'NSE:HDFC',
      'ICICIBANK': 'NSE:ICICIBANK'
    };
    return chartSymbols[symbol] || 'NSE:NIFTY50';
  };

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          🧪 Strategy Testing with Live Data
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Test your First Candle Breakout 0.09% strategy with live market data and historical analysis
        </Typography>

        {/* Live Market Data Section */}
        <Card sx={{ mt: 3, mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                📊 Live Market Data
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Tooltip title="Refresh Live Price">
                  <IconButton onClick={fetchLivePrice} size="small">
                    <Refresh />
                  </IconButton>
                </Tooltip>
                <FormControlLabel
                  control={
                    <Switch
                      checked={useLiveData}
                      onChange={(e) => setUseLiveData(e.target.checked)}
                    />
                  }
                  label="Use Live Data"
                />
              </Box>
            </Box>

            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Symbol</InputLabel>
                  <Select
                    value={selectedSymbol}
                    label="Symbol"
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                  >
                    {symbolOptions.map((symbol) => (
                      <MenuItem key={symbol} value={symbol}>
                        {symbol}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {livePrice && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined" sx={{ p: 1 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Business color="primary" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          {livePrice.symbol}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          ₹{livePrice.price.toFixed(2)}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: livePrice.change >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: 'bold'
                          }}
                        >
                          {livePrice.change >= 0 ? '+' : ''}{livePrice.change.toFixed(2)} 
                          ({livePrice.changePercent >= 0 ? '+' : ''}{livePrice.changePercent.toFixed(2)}%)
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              )}

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<ShowChart />}
                  onClick={() => setShowChart(!showChart)}
                  fullWidth
                >
                  {showChart ? 'Hide Chart' : 'Show Chart'}
                </Button>
              </Grid>
            </Grid>

            {/* Live Chart */}
            {showChart && (
              <Box mt={2}>
                <TradingViewChart 
                  symbol={getSymbolForChart(selectedSymbol)}
                  height={400}
                  theme="dark"
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🚀 Strategy Backtest
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Run backtest with {useLiveData ? 'live' : 'historical'} data
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Number of Days"
                type="number"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                inputProps={{ min: 1, max: 30 }}
                sx={{ width: 150 }}
                size="small"
              />
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                onClick={runQuickBacktest}
                disabled={loading}
                size="large"
              >
                {loading ? 'Running...' : 'Run Backtest'}
              </Button>
            </Box>

            {useLiveData && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Live Data Mode:</strong> Strategy will use current market conditions 
                  and live price data for more accurate testing.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Results */}
        {results && (
          <>
            {/* Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">
                    Total Trades
                  </Typography>
                  <Typography variant="h4">
                    {results.totalTrades}
                  </Typography>
                  <Typography variant="caption">
                    {useLiveData ? 'Live Data' : 'Historical Data'}
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">
                    Win Rate
                  </Typography>
                  <Typography variant="h4" color={results.winRate >= 60 ? 'success.main' : 'error.main'}>
                    {formatPercentage(results.winRate)}
                  </Typography>
                  <Typography variant="caption">
                    {results.winningTrades}W / {results.losingTrades}L
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">
                    Net Profit
                  </Typography>
                  <Typography 
                    variant="h4" 
                    color={results.netProfit >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(results.netProfit)}
                  </Typography>
                  <Typography variant="caption">
                    {useLiveData ? 'Live Simulation' : 'Historical'}
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">
                    Profit Factor
                  </Typography>
                  <Typography variant="h4">
                    {results.profitFactor.toFixed(2)}
                  </Typography>
                  <Typography variant="caption">
                    {results.profitFactor >= 1.5 ? '✅ Good' : '⚠️ Needs Improvement'}
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Live Data Integration Info */}
            {useLiveData && livePrice && (
              <Card sx={{ mb: 3, bgcolor: 'success.50' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="success.main">
                    🎯 Live Data Integration
                  </Typography>
                  <Typography variant="body2">
                    Strategy tested with current market price: <strong>₹{livePrice.price.toFixed(2)}</strong> 
                    ({livePrice.change >= 0 ? '+' : ''}{livePrice.changePercent.toFixed(2)}% change)
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Last updated: {new Date(livePrice.timestamp).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Detailed Stats */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 Detailed Statistics
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Total Profit
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {formatCurrency(results.totalProfit)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Total Loss
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {formatCurrency(results.totalLoss)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Max Drawdown
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(results.maxDrawdown)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Avg Profit/Trade
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(results.netProfit / results.totalTrades)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Daily Results */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📅 Daily Breakdown
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Gap Filter</TableCell>
                        <TableCell align="right">First Candle</TableCell>
                        <TableCell align="right">Upper Trigger</TableCell>
                        <TableCell align="right">Lower Trigger</TableCell>
                        <TableCell align="right">Trades</TableCell>
                        <TableCell align="right">Profit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.dailyResults.map((daily, index) => (
                        <TableRow key={index}>
                          <TableCell>{daily.date}</TableCell>
                          <TableCell>
                            {daily.gapFilterPassed ? (
                              <Chip label="✅ Passed" size="small" color="success" />
                            ) : (
                              <Chip label="❌ Failed" size="small" color="error" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {daily.firstCandleClose?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell align="right">
                            {daily.upperTrigger?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell align="right">
                            {daily.lowerTrigger?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell align="right">{daily.trades}</TableCell>
                          <TableCell 
                            align="right"
                            sx={{ color: daily.profit >= 0 ? 'success.main' : 'error.main' }}
                          >
                            {formatCurrency(daily.profit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Trade Details */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📋 Trade Details
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Entry Time</TableCell>
                        <TableCell align="right">Entry Price</TableCell>
                        <TableCell>Exit Time</TableCell>
                        <TableCell align="right">Exit Price</TableCell>
                        <TableCell align="right">Profit</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.trades.map((trade, index) => (
                        <TableRow key={index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Chip 
                              label={trade.type.toUpperCase()} 
                              size="small"
                              color={trade.type === 'call' ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(trade.entryTime).toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            {trade.entryPrice.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {new Date(trade.exitTime).toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            {trade.exitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell 
                            align="right"
                            sx={{ 
                              color: trade.profit >= 0 ? 'success.main' : 'error.main',
                              fontWeight: 'bold'
                            }}
                          >
                            {trade.profit >= 0 ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
                            {formatCurrency(trade.profit)}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {trade.reason}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </Layout>
  );
};

export default StrategyTest;
