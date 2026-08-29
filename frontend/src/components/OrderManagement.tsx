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
import { Add as AddIcon, Refresh as RefreshIcon, Close } from '@mui/icons-material';
import { StatusBadge } from './ui';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
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
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders`);
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

    const wsUrl = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:5000';
    const socket: Socket = io(wsUrl);

    socket.on('paper_order_filled', (order: Order) => {
      setOrders(prev => [order, ...prev.filter(o => (o.id || o.orderId) !== (order.id || order.orderId))]);
    });

    const interval = setInterval(loadOrders, 10000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [loadOrders]);

  const handlePlaceOrder = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders`, {
        symbol: orderForm.symbol.toUpperCase(),
        side: orderForm.side,
        quantity: Number(orderForm.quantity),
        price: orderForm.price,
        orderType: orderForm.orderType,
        productType: orderForm.productType
      });

      if (res.data?.success) {
        setShowOrderForm(false);
        setOrderForm({ symbol: '', side: 'BUY', quantity: 10, price: 0, orderType: 'MARKET', productType: 'INTRADAY' });
        await loadOrders();
      }
    } catch (e) {
      // Handled
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
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', bgcolor: '#0f172a', color: '#fff', '&:hover': { bgcolor: '#1e293b' } }}
          >
            Place Order
          </Button>
        </Box>
      </Box>

      {/* Orders Table */}
      <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', py: 1.2, borderBottom: '1px solid #e2e8f0' } }}>
                <TableCell sx={{ pl: 2.5 }}>Order ID</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Side</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Fill Price (₹)</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ pr: 2.5 }}>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#94a3b8', fontSize: '0.85rem' }}>
                    No orders in the book.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => {
                  const id = o.orderId || o.id || o.brokerOrderId;
                  const time = o.orderTimestamp || o.timestamp || new Date().toISOString();
                  const price = o.averagePrice || o.price || 0;

                  return (
                    <TableRow key={id} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                      <TableCell sx={{ pl: 2.5, fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                        {id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                        {o.symbol}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.side === 'BUY' ? 'live' : 'halted'} label={o.side} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {o.quantity}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem', color: '#0f172a' }}>
                        ₹{formatPrice(price)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {o.orderType}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={o.status === 'FILLED' ? 'live' : o.status === 'CANCELLED' ? 'halted' : 'paper'}
                          label={o.status}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 2.5, color: '#64748b', fontSize: '0.75rem' }}>
                        {new Date(time).toLocaleTimeString()}
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
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Place Trading Order
          </Typography>
          <IconButton size="small" onClick={() => setShowOrderForm(false)} sx={{ color: '#94a3b8' }}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
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