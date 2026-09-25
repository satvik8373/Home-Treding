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
  Button,
  Dialog,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Close, ReceiptLong } from '@mui/icons-material';
import { StatusBadge, EmptyState } from './ui';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api';
import { useTradingMode } from '../context/TradingModeContext';
import { Alert } from '@mui/material';

interface Order {
  id: string;
  orderId?: string;
  brokerOrderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  averagePrice?: number;
  orderType: string;
  productType?: string;
  status: string;
  timestamp?: string;
  orderTimestamp?: string;
}

interface OrderManagementProps {
  brokerId?: string;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ brokerId }) => {
  const { isLive } = useTradingMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [, setSubmittingOrder] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState('');
  const [orderForm, setOrderForm] = useState({
    symbol: '',
    side: 'BUY',
    quantity: 10,
    price: 0,
    orderType: 'MARKET',
    productType: 'INTRADAY'
  });

  const loadOrders = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/trading/orders`);
      if (res.data?.success && res.data?.orders) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    let socket: Socket | null = null;

    if (API_CONFIG.ENABLE_WEBSOCKETS) {
      try {
        socket = io(API_CONFIG.WS_URL, {
          transports: ['websocket'],
          timeout: 5000,
          reconnectionAttempts: 2
        });

        socket.on('paper_order_filled', (order: Order) => {
          setOrders(prev => [order, ...prev.filter(o => (o.id || o.orderId) !== (order.id || order.orderId))]);
        });
      } catch (_) {}
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadOrders();
    }, 10000);

    return () => {
      if (socket) socket.disconnect();
      clearInterval(interval);
    };
  }, [loadOrders]);

  const handlePlaceOrder = async () => {
    if (!orderForm.symbol.trim()) {
      setOrderError('Please enter a symbol');
      return;
    }
    setSubmittingOrder(true);
    setOrderError('');
    try {
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/trading/orders`, {
        symbol: orderForm.symbol.toUpperCase(),
        side: orderForm.side,
        quantity: Number(orderForm.quantity),
        price: orderForm.price,
        orderType: orderForm.orderType,
        productType: orderForm.productType,
        brokerId,
        mode: isLive ? 'live' : 'paper'
      });

      if (res.data?.success) {
        setShowOrderForm(false);
        setOrderForm({ symbol: '', side: 'BUY', quantity: 10, price: 0, orderType: 'MARKET', productType: 'INTRADAY' });
        await loadOrders();
      } else {
        setOrderError(res.data?.message || 'Failed to place order');
      }
    } catch (e: any) {
      setOrderError(e.response?.data?.message || e.message || 'Error executing order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!orderId) return;
    try {
      setCancellingOrderId(orderId);
      const res = await axios.delete(`${API_CONFIG.BASE_URL}/api/trading/orders/${orderId}`);
      if (res.data?.success) {
        await loadOrders();
      } else {
        alert(res.data?.message || 'Failed to cancel order');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Error cancelling order');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const formatPrice = (val: number = 0) => {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Orderbook & Execution Management
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Live Dhan orders and virtual paper trading fills
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            onClick={loadOrders}
            disabled={loading}
            size="small"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: '#e2e8f0', color: '#475569' }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            onClick={() => setShowOrderForm(true)}
            size="small"
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
          >
            Place Order
          </Button>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ pl: 2.5 }}>Order ID</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Side</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Fill Price (₹)</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Time</TableCell>
                <TableCell align="center" sx={{ pr: 2.5 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ p: 0, border: 0 }}>
                    <EmptyState
                      icon={<ReceiptLong sx={{ fontSize: 26 }} />}
                      title="No orders in the book"
                      description="Place a paper or live order using the button above."
                      compact
                    />
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => {
                  const id = o.orderId || o.id || o.brokerOrderId;
                  const time = o.orderTimestamp || o.timestamp || new Date().toISOString();
                  const price = o.averagePrice || o.price || 0;

                  return (
                    <TableRow key={id} hover>
                      <TableCell sx={{ pl: 2.5, fontFamily: 'monospace', fontSize: '0.75rem' }}>{id}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{o.symbol}</TableCell>
                      <TableCell>
                        <StatusBadge status={o.side === 'BUY' ? 'live' : 'halted'} label={o.side} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{o.quantity}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem', color: '#0f172a' }}>₹{formatPrice(price)}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>{o.orderType}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={o.status === 'FILLED' ? 'filled' : o.status === 'CANCELLED' ? 'cancelled' : 'pending'}
                          label={o.status}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                        {new Date(time).toLocaleTimeString()}
                      </TableCell>
                      <TableCell align="center" sx={{ pr: 2.5 }}>
                        {['OPEN', 'PENDING', 'TRIGGERED', 'TRANSIT', 'PLACED'].includes(o.status?.toUpperCase()) ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleCancelOrder(String(id || ''))}
                            disabled={cancellingOrderId === id}
                            sx={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              py: 0.2,
                              px: 1.2,
                              borderRadius: 1.5,
                              textTransform: 'none',
                              borderColor: '#fca5a5',
                              color: '#dc2626',
                              bgcolor: '#fef2f2',
                              '&:hover': { bgcolor: '#fee2e2', borderColor: '#ef4444' }
                            }}
                          >
                            {cancellingOrderId === id ? 'Cancelling...' : 'Cancel'}
                          </Button>
                        ) : (
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Sleek Place Order Modal */}
      <Dialog
        open={showOrderForm}
        onClose={() => setShowOrderForm(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 0, overflow: 'hidden' } }}
      >
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Place {isLive ? 'Live' : 'Paper'} Order
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: isLive ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
              {isLive ? 'Real funds — DhanHQ execution' : 'Virtual simulation — no real capital'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setShowOrderForm(false)} sx={{ color: '#94a3b8' }}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {orderError && (
            <Alert severity="error" sx={{ borderRadius: 2, fontSize: '0.78rem' }}>
              {orderError}
            </Alert>
          )}
          <TextField
            label="Symbol"
            value={orderForm.symbol}
            onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
            placeholder="e.g. RELIANCE, TCS, INFY"
            size="small"
            fullWidth
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Side</InputLabel>
              <Select
                value={orderForm.side}
                label="Side"
                onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value as any })}
              >
                <MenuItem value="BUY">BUY</MenuItem>
                <MenuItem value="SELL">SELL</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Quantity"
              type="number"
              value={orderForm.quantity}
              onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
              size="small"
              fullWidth
            />
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel>Order Type</InputLabel>
            <Select
              value={orderForm.orderType}
              label="Order Type"
              onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value as any })}
            >
              <MenuItem value="MARKET">MARKET</MenuItem>
              <MenuItem value="LIMIT">LIMIT</MenuItem>
            </Select>
          </FormControl>
          <Button
            fullWidth
            variant="contained"
            onClick={handlePlaceOrder}
            disabled={!orderForm.symbol || orderForm.quantity <= 0}
            sx={{
              bgcolor: orderForm.side === 'BUY' ? '#16a34a' : '#dc2626',
              color: '#fff',
              fontWeight: 700,
              textTransform: 'none',
              py: 1,
              borderRadius: 2,
              '&:hover': { bgcolor: orderForm.side === 'BUY' ? '#15803d' : '#b91c1c' }
            }}
          >
            Execute {orderForm.side} Order
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default OrderManagement;