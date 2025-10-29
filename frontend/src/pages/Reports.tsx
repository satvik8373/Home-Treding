import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Button
} from '@mui/material';
import { TrendingUp, TrendingDown, Refresh } from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import axios from 'axios';

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  value: number;
  timestamp: string;
  pnl?: number;
}

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load real data from backend APIs
      const [tradesResponse, performanceResponse] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/portfolio/trades?limit=100`).catch(() => ({ data: { success: false, trades: [] } })),
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/portfolio/performance`).catch(() => ({ data: { success: false, performance: {} } }))
      ]);

      if (tradesResponse.data.success) {
        setTrades(tradesResponse.data.trades || []);
      }

      if (performanceResponse.data.success) {
        setPerformance(performanceResponse.data.performance || {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          maxDrawdown: 0
        });
      }

    } catch (error) {
      console.error('Failed to load reports data:', error);
      setError('Failed to load reports data. Using demo data.');
      
      // Fallback to demo data
      setTrades([
        {
          id: '1',
          symbol: 'RELIANCE',
          side: 'BUY',
          quantity: 10,
          price: 2450.50,
          value: 24505,
          timestamp: new Date().toISOString(),
          pnl: 250
        },
        {
          id: '2',
          symbol: 'TCS',
          side: 'SELL',
          quantity: 5,
          price: 3680.75,
          value: 18403.75,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          pnl: -120
        }
      ]);

      setPerformance({
        totalTrades: 25,
        winningTrades: 16,
        losingTrades: 9,
        winRate: 64,
        avgWin: 450.50,
        avgLoss: -280.25,
        profitFactor: 1.6,
        sharpeRatio: 0.85,
        maxDrawdown: 1250
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate daily P&L from trades
  const getDailyPnL = () => {
    const dailyData = new Map();
    
    trades.forEach(trade => {
      const date = new Date(trade.timestamp).toLocaleDateString();
      const currentPnL = dailyData.get(date) || 0;
      dailyData.set(date, currentPnL + (trade.pnl || 0));
    });

    return Array.from(dailyData.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .slice(-7); // Last 7 days
  };

  // Calculate symbol-wise performance
  const getSymbolPerformance = () => {
    const symbolData = new Map();
    
    trades.forEach(trade => {
      const current = symbolData.get(trade.symbol) || { trades: 0, pnl: 0, volume: 0 };
      symbolData.set(trade.symbol, {
        trades: current.trades + 1,
        pnl: current.pnl + (trade.pnl || 0),
        volume: current.volume + trade.value
      });
    });

    return Array.from(symbolData.entries())
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 10);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const totalPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  const totalVolume = trades.reduce((sum, trade) => sum + trade.value, 0);
  const avgPnLPerTrade = trades.length > 0 ? totalPnL / trades.length : 0;

  const winLossData = performance ? [
    { name: 'Winning', value: performance.winRate, color: '#34a853' },
    { name: 'Losing', value: 100 - performance.winRate, color: '#ea4335' }
  ] : [];

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading reports data...</Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            📊 Reports & Analytics
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadReportsData}
          >
            Refresh Data
          </Button>
        </Box>

        {error && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Real-time Summary Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Total P&L
              </Typography>
              <Typography variant="h5" color={totalPnL >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(totalPnL)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {totalPnL >= 0 ? (
                  <TrendingUp fontSize="small" color="success" />
                ) : (
                  <TrendingDown fontSize="small" color="error" />
                )}
                <Typography 
                  variant="body2" 
                  color={totalPnL >= 0 ? 'success.main' : 'error.main'} 
                  sx={{ ml: 0.5 }}
                >
                  {trades.length} trades
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Total Trades
              </Typography>
              <Typography variant="h5">
                {performance?.totalTrades || trades.length}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Volume: {formatCurrency(totalVolume)}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Win Rate
              </Typography>
              <Typography variant="h5" color="success.main">
                {performance?.winRate.toFixed(1) || '0'}%
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {performance?.winningTrades || 0} winning trades
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Avg P&L/Trade
              </Typography>
              <Typography variant="h5" color={avgPnLPerTrade >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(avgPnLPerTrade)}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Per trade average
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Performance Metrics */}
        {performance && (
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Advanced Performance Metrics
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
              <Box>
                <Typography variant="body2" color="textSecondary">Profit Factor</Typography>
                <Typography variant="h6">{performance.profitFactor.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Sharpe Ratio</Typography>
                <Typography variant="h6">{performance.sharpeRatio.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Max Drawdown</Typography>
                <Typography variant="h6" color="error.main">{formatCurrency(performance.maxDrawdown)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Avg Win/Loss</Typography>
                <Typography variant="h6">
                  {formatCurrency(performance.avgWin)} / {formatCurrency(Math.abs(performance.avgLoss))}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Tabs for detailed analysis */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Daily P&L" />
            <Tab label="Symbol Performance" />
            <Tab label="Win/Loss Analysis" />
            <Tab label="Trade History" />
          </Tabs>
        </Paper>

        {/* Daily P&L Tab */}
        {tabValue === 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Daily P&L Trend
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={getDailyPnL()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'P&L']} />
                <Line 
                  type="monotone" 
                  dataKey="pnl" 
                  stroke="#1a73e8" 
                  strokeWidth={2}
                  dot={{ fill: '#1a73e8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Symbol Performance Tab */}
        {tabValue === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Performing Symbols
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={getSymbolPerformance()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis />
                <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'P&L']} />
                <Bar dataKey="pnl" fill="#34a853" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Win/Loss Analysis Tab */}
        {tabValue === 2 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Win/Loss Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }: any) => `${name}: ${value.toFixed(1)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Trade History Tab */}
        {tabValue === 3 && (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Side</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell align="right">P&L</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="textSecondary">
                          No trades found. Start trading to see your trade history here.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    trades.slice(0, 50).map((trade) => (
                      <TableRow key={trade.id} hover>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(trade.timestamp).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {trade.symbol}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={trade.side}
                            color={trade.side === 'BUY' ? 'success' : 'error'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">{trade.quantity.toLocaleString()}</TableCell>
                        <TableCell align="right">{formatCurrency(trade.price)}</TableCell>
                        <TableCell align="right">{formatCurrency(trade.value)}</TableCell>
                        <TableCell align="right">
                          <Typography 
                            color={(trade.pnl || 0) >= 0 ? 'success.main' : 'error.main'}
                            fontWeight="medium"
                          >
                            {formatCurrency(trade.pnl || 0)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    </Layout>
  );
};

export default Reports;