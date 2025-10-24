import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  CircularProgress,
  Alert
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import dhanService, { DhanPosition } from '../services/dhanService';
import firestoreService from '../services/firestoreService';
import Layout from '../components/Layout';

const Portfolio: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<DhanPosition[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [fundLimit, setFundLimit] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      // Get linked brokerage
      const brokerages = await firestoreService.getBrokerages(user.uid);
      if (brokerages.length === 0) {
        setError('No brokerage account linked. Please link your Dhan account first.');
        setLoading(false);
        return;
      }

      const brokerage = brokerages[0];

      // Fetch data from Dhan
      const [positionsData, holdingsData, fundData] = await Promise.all([
        dhanService.getPositions(brokerage.accessToken),
        dhanService.getHoldings(brokerage.accessToken),
        dhanService.getFundLimit(brokerage.accessToken)
      ]);

      setPositions(positionsData);
      setHoldings(holdingsData);
      setFundLimit(fundData);
    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPnL = () => {
    return positions.reduce((sum, pos) => sum + (pos.realizedProfit + pos.unrealizedProfit), 0);
  };

  const calculateTotalInvested = () => {
    return holdings.reduce((sum, holding) => sum + (holding.avgCostPrice * holding.quantity), 0);
  };

  const calculateCurrentValue = () => {
    return holdings.reduce((sum, holding) => sum + (holding.lastTradedPrice * holding.quantity), 0);
  };

  if (loading) {
    return (
      <Layout>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading portfolio...</Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            Portfolio
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadPortfolioData}
          >
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
            {error.includes('No brokerage') && (
              <Button
                size="small"
                onClick={() => navigate('/brokerage')}
                sx={{ ml: 2 }}
              >
                Link Account
              </Button>
            )}
          </Alert>
        )}

        {/* Summary Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Available Funds
              </Typography>
              <Typography variant="h5">
                ₹{fundLimit?.availableBalance?.toLocaleString() || '0'}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Total Invested
              </Typography>
              <Typography variant="h5">
                ₹{calculateTotalInvested().toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Current Value
              </Typography>
              <Typography variant="h5">
                ₹{calculateCurrentValue().toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Total P&L
              </Typography>
              <Typography
                variant="h5"
                color={calculateTotalPnL() >= 0 ? 'success.main' : 'error.main'}
              >
                ₹{calculateTotalPnL().toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Positions */}
        <Paper sx={{ mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">
              Open Positions
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Avg Price</TableCell>
                  <TableCell align="right">LTP</TableCell>
                  <TableCell align="right">P&L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No open positions
                    </TableCell>
                  </TableRow>
                ) : (
                  positions.map((position, index) => (
                    <TableRow key={index}>
                      <TableCell>{position.securityId}</TableCell>
                      <TableCell>{position.productType}</TableCell>
                      <TableCell align="right">{position.netQty}</TableCell>
                      <TableCell align="right">₹{position.buyAvg.toFixed(2)}</TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: position.unrealizedProfit >= 0 ? 'success.main' : 'error.main' }}
                      >
                        ₹{position.unrealizedProfit.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Holdings */}
        <Paper>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">
              Holdings
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Avg Cost</TableCell>
                  <TableCell align="right">LTP</TableCell>
                  <TableCell align="right">Current Value</TableCell>
                  <TableCell align="right">P&L</TableCell>
                  <TableCell align="right">P&L %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holdings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No holdings
                    </TableCell>
                  </TableRow>
                ) : (
                  holdings.map((holding, index) => {
                    const invested = holding.avgCostPrice * holding.quantity;
                    const current = holding.lastTradedPrice * holding.quantity;
                    const pnl = current - invested;
                    const pnlPercent = (pnl / invested) * 100;

                    return (
                      <TableRow key={index}>
                        <TableCell>{holding.tradingSymbol}</TableCell>
                        <TableCell align="right">{holding.quantity}</TableCell>
                        <TableCell align="right">₹{holding.avgCostPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{holding.lastTradedPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{current.toFixed(2)}</TableCell>
                        <TableCell
                          align="right"
                          sx={{ color: pnl >= 0 ? 'success.main' : 'error.main' }}
                        >
                          ₹{pnl.toFixed(2)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ color: pnlPercent >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {pnlPercent.toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Layout>
  );
};

export default Portfolio;
