import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  status: 'PENDING' | 'PLACED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  timestamp: string;
  fillPrice?: number;
  fillQuantity?: number;
  strategyId?: string;
}

interface OrderFormData {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  brokerId: string;
}

interface OrderManagementProps {
  brokerId?: string;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ brokerId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [orderForm, setOrderForm] = useState<OrderFormData>({
    symbol: '',
    side: 'BUY',
    quantity: 1,
    price: 0,
    orderType: 'MARKET',
    brokerId: brokerId || ''
  });

  useEffect(() => {
    loadOrders();
  }, [brokerId]);

  useEffect(() => {
    setupWebSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const setupWebSocket = () => {
    if (socket) return; // Prevent multiple connections

    const newSocket = io((process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'), {
      autoConnect: false // Don't auto-connect to prevent errors
    });

    newSocket.on('connect', () => {
      console.log('📡 Connected to order updates');
      if (brokerId) {
        newSocket.emit('subscribe_orders', brokerId);
      }
    });

    newSocket.on('connect_error', (error: Error) => {
      console.log('📡 WebSocket connection failed (expected in demo mode)');
    });

    newSocket.on('order_update', (update: any) => {
      console.log('📋 Order update received:', update);
      setOrders(prev => {
        const updated = [...prev];
        const index = updated.findIndex(o => o.id === update.order.id);
        if (index >= 0) {
          updated[index] = update.order;
        } else {
          updated.unshift(update.order);
        }
        return updated;
      });
    });

    // Only try to connect if backend is likely available
    // newSocket.connect();
    setSocket(newSocket);
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders`, {
        params: brokerId ? { brokerId } : {}
      });

      if (response.data.success) {
        setOrders(response.data.orders || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders`, orderForm);

      if (response.data.success) {
        setShowOrderForm(false);
        setOrderForm({
          symbol: '',
          side: 'BUY',
          quantity: 1,
          price: 0,
          orderType: 'MARKET',
          brokerId: brokerId || ''
        });
        await loadOrders();
      }
    } catch (error: any) {
      console.error('Failed to place order:', error);
      setError(error.response?.data?.message || 'Failed to place order');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders/${orderId}`);
      await loadOrders();
    } catch (error: any) {
      console.error('Failed to cancel order:', error);
      setError(error.response?.data?.message || 'Failed to cancel order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED': return 'success';
      case 'PLACED': return 'info';
      case 'CANCELLED': return 'default';
      case 'REJECTED': return 'error';
      default: return 'warning';
    }
  };

  const getSideColor = (side: string) => {
    return side === 'BUY' ? 'success' : 'error';
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Order Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Orders">
              <IconButton onClick={loadOrders} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowOrderForm(true)}
              disabled={!brokerId}
            >
              Place Order
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell>Side</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Time</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {order.symbol}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={order.side}
                      color={getSideColor(order.side)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {order.fillQuantity ? `${order.fillQuantity}/${order.quantity}` : order.quantity}
                  </TableCell>
                  <TableCell align="right">
                    {order.orderType === 'MARKET' ? 'Market' : `₹${order.price?.toFixed(2)}`}
                    {order.fillPrice && (
                      <Typography variant="caption" display="block" color="textSecondary">
                        Filled: ₹{order.fillPrice.toFixed(2)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{order.orderType}</TableCell>
                  <TableCell>
                    <Chip
                      label={order.status}
                      color={getStatusColor(order.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(order.timestamp).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {order.status === 'PLACED' && (
                      <Tooltip title="Cancel Order">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleCancelOrder(order.id)}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {orders.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="textSecondary">
              No orders found
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Place Order Dialog */}
      <Dialog open={showOrderForm} onClose={() => setShowOrderForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Place New Order</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Symbol"
              value={orderForm.symbol}
              onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
              placeholder="e.g., RELIANCE"
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>Side</InputLabel>
              <Select
                value={orderForm.side}
                onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value as 'BUY' | 'SELL' })}
              >
                <MenuItem value="BUY">BUY</MenuItem>
                <MenuItem value="SELL">SELL</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Quantity"
              type="number"
              value={orderForm.quantity}
              onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 0 })}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Order Type</InputLabel>
              <Select
                value={orderForm.orderType}
                onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value as any })}
              >
                <MenuItem value="MARKET">MARKET</MenuItem>
                <MenuItem value="LIMIT">LIMIT</MenuItem>
                <MenuItem value="STOP_LOSS">STOP LOSS</MenuItem>
              </Select>
            </FormControl>

            {orderForm.orderType !== 'MARKET' && (
              <TextField
                label="Price"
                type="number"
                value={orderForm.price}
                onChange={(e) => setOrderForm({ ...orderForm, price: parseFloat(e.target.value) || 0 })}
                fullWidth
                InputProps={{
                  startAdornment: '₹'
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOrderForm(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePlaceOrder}
            disabled={!orderForm.symbol || !orderForm.quantity}
          >
            Place Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderManagement;