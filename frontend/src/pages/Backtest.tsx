import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import { PlayArrow, Download } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import Layout from '../components/Layout';
import { auth } from '../config/firebase';
import firestoreService from '../services/firestoreService';

const Backtest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    strategyId: '',
    fromDate: '',
    toDate: '',
    initialCapital: 100000
  });
  const [results, setResults] = useState<any>(null);

  React.useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    const user = auth.currentUser;
    if (user) {
      const data = await firestoreService.getStrategies(user.uid);
      setStrategies(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const runBacktest = async () => {
    setLoading(true);
    
    // Simulate backtest results
    setTimeout(() => {
      const mockResults = {
        totalTrades: 45,
        winningTrades: 28,
        losingTrades: 17,
        winRate: 62.22,
        totalProfit: 45000,
        totalLoss: 18000,
        netProfit: 27000,
        profitFactor: 2.5,
        maxDrawdown: 8.5,
        sharpeRatio: 1.85,
        avgTradeProfit: 600,
        equityCurve: Array.from({ length: 30 }, (_, i) => ({
          date: `Day ${i + 1}`,
          value: 100000 + (i * 900) + (Math.random() * 2000 - 1000)
        })),
        monthlyReturns: [
          { month: 'Jan', return: 5.2 },
          { month: 'Feb', return: 3.8 },
          { month: 'Mar', return: -2.1 },
          { month: 'Apr', return: 7.5 },
          { month: 'May', return: 4.3 },
          { month: 'Jun', return: 6.1 }
        ]
      };
      
      setResults(mockResults);
      setLoading(false);
    }, 2000);
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Backtest Strategy
        </Typography>

        {/* Configuration */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Backtest Configuration
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mt: 2 }}>
            <TextField
              select
              fullWidth
              label="Select Strategy"
              name="strategyId"
              value={formData.strategyId}
              onChange={handleChange}
            >
              {strategies.map((strategy) => (
                <MenuItem key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Initial Capital"
              name="initialCapital"
              type="number"
              value={formData.initialCapital}
              onChange={handleChange}
            />

            <TextField
              fullWidth
              label="From Date"
              name="fromDate"
              type="date"
              value={formData.fromDate}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="To Date"
              name="toDate"
              type="date"
              value={formData.toDate}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
            onClick={runBacktest}
            disabled={loading || !formData.strategyId}
            sx={{ mt: 3 }}
          >
            {loading ? 'Running Backtest...' : 'Run Backtest'}
          </Button>
        </Paper>

        {/* Results */}
        {results && (
          <>
            {/* Summary Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Net Profit
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    ₹{results.netProfit.toLocaleString()}
                  </Typography>
                  <Chip label={`${((results.netProfit / formData.initialCapital) * 100).toFixed(2)}%`} color="success" size="small" sx={{ mt: 1 }} />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Win Rate
                  </Typography>
                  <Typography variant="h5">
                    {results.winRate}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {results.winningTrades}/{results.totalTrades} trades
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Profit Factor
                  </Typography>
                  <Typography variant="h5">
                    {results.profitFactor}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Avg: ₹{results.avgTradeProfit}
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Max Drawdown
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {results.maxDrawdown}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sharpe: {results.sharpeRatio}
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Equity Curve */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Equity Curve
                </Typography>
                <Button startIcon={<Download />} size="small">
                  Export
                </Button>
              </Box>
              
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={results.equityCurve}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#1a73e8" fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>

            {/* Monthly Returns */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Monthly Returns
              </Typography>
              
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={results.monthlyReturns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="return" stroke="#34a853" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </>
        )}

        {!results && !loading && (
          <Alert severity="info">
            Select a strategy and date range to run a backtest
          </Alert>
        )}
      </Box>
    </Layout>
  );
};

export default Backtest;
