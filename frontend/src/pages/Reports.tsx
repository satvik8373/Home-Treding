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
  Chip
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import { auth } from '../config/firebase';
import firestoreService from '../services/firestoreService';

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [trades, setTrades] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const user = auth.currentUser;
    if (user) {
      const [tradesData, strategiesData] = await Promise.all([
        firestoreService.getTrades(user.uid),
        firestoreService.getStrategies(user.uid)
      ]);
      setTrades(tradesData);
      setStrategies(strategiesData);
    }
  };

  // Mock data for charts
  const performanceData = [
    { date: 'Mon', profit: 2400 },
    { date: 'Tue', profit: 1398 },
    { date: 'Wed', profit: 9800 },
    { date: 'Thu', profit: 3908 },
    { date: 'Fri', profit: 4800 },
    { date: 'Sat', profit: 3800 },
    { date: 'Sun', profit: 4300 }
  ];

  const strategyPerformance = strategies.map(s => ({
    name: s.name,
    profit: Math.random() * 10000,
    trades: Math.floor(Math.random() * 50)
  }));

  const winLossData = [
    { name: 'Winning', value: 65, color: '#34a853' },
    { name: 'Losing', value: 35, color: '#ea4335' }
  ];

  const topStocks = [
    { symbol: 'RELIANCE', trades: 45, profit: 12500, change: 5.2 },
    { symbol: 'TCS', trades: 38, profit: 9800, change: 3.8 },
    { symbol: 'INFY', trades: 32, profit: 8200, change: 4.1 },
    { symbol: 'HDFC', trades: 28, profit: 7500, change: 2.9 },
    { symbol: 'ICICI', trades: 25, profit: 6800, change: 3.5 }
  ];

  return (
    <Layout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Reports & Analytics
        </Typography>

        {/* Summary Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Total P&L
              </Typography>
              <Typography variant="h5" color="success.main">
                ₹45,230
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUp fontSize="small" color="success" />
                <Typography variant="body2" color="success.main" sx={{ ml: 0.5 }}>
                  +12.5%
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
                156
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                This month
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Win Rate
              </Typography>
              <Typography variant="h5">
                65%
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                101 winning trades
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Avg Profit/Trade
              </Typography>
              <Typography variant="h5">
                ₹290
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Per trade
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Performance" />
            <Tab label="Strategies" />
            <Tab label="Top Stocks" />
            <Tab label="Trade History" />
          </Tabs>
        </Paper>

        {/* Performance Tab */}
        {tabValue === 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Daily P&L
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="profit" fill="#1a73e8" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Win/Loss Ratio
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
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
          </Box>
        )}

        {/* Strategies Tab */}
        {tabValue === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Strategy Performance
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={strategyPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="profit" fill="#34a853" name="Profit (₹)" />
                <Bar yAxisId="right" dataKey="trades" fill="#1a73e8" name="Trades" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Top Stocks Tab */}
        {tabValue === 2 && (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell align="right">Trades</TableCell>
                    <TableCell align="right">Profit</TableCell>
                    <TableCell align="right">Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topStocks.map((stock) => (
                    <TableRow key={stock.symbol}>
                      <TableCell>
                        <Typography variant="body1" fontWeight={500}>
                          {stock.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{stock.trades}</TableCell>
                      <TableCell align="right">
                        <Typography color="success.main">
                          ₹{stock.profit.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          icon={<TrendingUp />}
                          label={`${stock.change}%`}
                          color="success"
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Trade History Tab */}
        {tabValue === 3 && (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">P&L</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No trades yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    trades.slice(0, 20).map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>{new Date(trade.createdAt?.toDate()).toLocaleDateString()}</TableCell>
                        <TableCell>{trade.symbol}</TableCell>
                        <TableCell>
                          <Chip
                            label={trade.transactionType}
                            color={trade.transactionType === 'BUY' ? 'primary' : 'secondary'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">{trade.quantity}</TableCell>
                        <TableCell align="right">₹{trade.price}</TableCell>
                        <TableCell align="right">
                          <Typography color={trade.pnl >= 0 ? 'success.main' : 'error.main'}>
                            ₹{trade.pnl || 0}
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
