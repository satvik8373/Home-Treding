import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  TextField,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart
} from '@mui/icons-material';
import axios from 'axios';

interface DhanTerminalProps {
  open: boolean;
  onClose: () => void;
  broker: any;
}

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
}

interface Order {
  orderId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  time: string;
}

const DhanTerminal: React.FC<DhanTerminalProps> = ({ open, onClose, broker }) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Real data only - no demo fallbacks

  useEffect(() => {
    if (open) {
      fetchTerminalData();
      // Auto-refresh every 5 seconds
      const interval = setInterval(fetchTerminalData, 5000);
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [open]);

  const fetchTerminalData = async () => {
    setLoading(true);
    setError('');

    try {
      // Get real-time data from Dhan API
      const [positionsRes, ordersRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/positions/${broker.id}`),
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/orders/${broker.id}`)
      ]);

      // Use only real data from Dhan API
      setPositions(positionsRes.data.positions || []);
      setOrders(ordersRes.data.orders || []);
      
      // Calculate real account info from API data
      const totalPnL = (positionsRes.data.positions || []).reduce((sum: number, pos: any) => sum + (pos.pnl || 0), 0);
      
      setAccountInfo({
        clientId: broker.clientId,
        availableMargin: positionsRes.data.availableMargin || '₹0.00',
        usedMargin: positionsRes.data.usedMargin || '₹0.00',
        totalPnL: `₹${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}`,
        dayPnL: positionsRes.data.dayPnL || '₹0.00'
      });

    } catch (error: any) {
      console.error('Failed to fetch terminal data:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      console.error('Orders API error details:', {
        status: error.response?.status,
        data: error.response?.data,
        brokerId: broker.id
      });
      setError(`Failed to fetch real-time data from Dhan: ${errorMsg}. Please check your connection and broker status.`);
      // Set empty data on error - no demo fallbacks
      setPositions([]);
      setOrders([]);
      setAccountInfo({
        clientId: broker.clientId,
        availableMargin: '₹0.00',
        usedMargin: '₹0.00',
        totalPnL: '₹0.00',
        dayPnL: '₹0.00'
      });
    } finally {
      setLoading(false);
    }
  };

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ShowChart />
          <Typography variant="h6">
            DHAN Terminal - {broker.clientId}
          </Typography>
          <Chip 
            label="LIVE" 
            color="success" 
            size="small"
            sx={{ 
              bgcolor: 'success.main',
              color: 'white',
              animation: 'pulse 2s infinite'
            }}
          />
        </Box>
        <Box>
          <IconButton onClick={fetchTerminalData} sx={{ color: 'white', mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* Account Summary */}
        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
            gap: 2 
          }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">Available Margin</Typography>
                <Typography variant="h6" color="success.main">
                  {accountInfo?.availableMargin || '₹0.00'}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">Used Margin</Typography>
                <Typography variant="h6" color="warning.main">
                  {accountInfo?.usedMargin || '₹0.00'}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">Total P&L</Typography>
                <Typography variant="h6" color={totalPnL >= 0 ? 'success.main' : 'error.main'}>
                  ₹{totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">Day P&L</Typography>
                <Typography variant="h6" color="success.main">
                  {accountInfo?.dayPnL || '₹0.00'}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', height: 'calc(100% - 120px)' }}>
          {/* Positions */}
          <Box sx={{ flex: 1, p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalance />
              Positions ({positions.length})
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Avg Price</TableCell>
                    <TableCell align="right">LTP</TableCell>
                    <TableCell align="right">P&L</TableCell>
                    <TableCell align="right">P&L %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positions.map((position, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {position.pnl >= 0 ? 
                            <TrendingUp color="success" fontSize="small" /> : 
                            <TrendingDown color="error" fontSize="small" />
                          }
                          {position.symbol}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{position.quantity}</TableCell>
                      <TableCell align="right">₹{position.avgPrice.toFixed(2)}</TableCell>
                      <TableCell align="right">₹{position.ltp.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ color: position.pnl >= 0 ? 'success.main' : 'error.main' }}>
                        ₹{position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: position.pnlPercent >= 0 ? 'success.main' : 'error.main' }}>
                        {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Orders */}
          <Box sx={{ flex: 1, p: 2, borderLeft: 1, borderColor: 'divider' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShowChart />
              Orders ({orders.length})
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Side</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.length > 0 ? (
                    orders.map((order, index) => (
                      <TableRow key={order.orderId || index}>
                        <TableCell>{order.orderId || 'N/A'}</TableCell>
                        <TableCell>{order.symbol || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={order.side || 'N/A'} 
                            color={order.side === 'BUY' ? 'success' : 'error'} 
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">{order.quantity || 0}</TableCell>
                        <TableCell align="right">₹{(order.price || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={order.status || 'PENDING'} 
                            color={order.status === 'EXECUTED' || order.status === 'FILLED' ? 'success' : 'warning'} 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{order.time || 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="textSecondary">
                          No orders found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>

        {/* Quick Actions */}
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button variant="contained" color="success" size="small">
              Quick Buy
            </Button>
            <Button variant="contained" color="error" size="small">
              Quick Sell
            </Button>
            <TextField 
              size="small" 
              placeholder="Enter Symbol" 
              sx={{ width: 150 }}
            />
            <TextField 
              size="small" 
              placeholder="Quantity" 
              type="number"
              sx={{ width: 100 }}
            />
            <Button variant="outlined" size="small">
              Place Order
            </Button>
            <Box sx={{ ml: 'auto' }}>
              <Typography variant="caption" color="textSecondary">
                Last Updated: {new Date().toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default DhanTerminal;