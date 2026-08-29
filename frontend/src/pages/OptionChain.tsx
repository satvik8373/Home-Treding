import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  TextField,
  Alert
} from '@mui/material';
import { Refresh, Close } from '@mui/icons-material';
import Layout from '../components/Layout';
import { PageHeader, StatusBadge } from '../components/ui';
import axios from 'axios';

interface StrikeData {
  strikePrice: number;
  ce?: {
    securityId: string;
    symbol: string;
    ltp: number;
    change: number;
    changePercent: number;
    volume: number;
    oi: number;
    iv: number;
    delta?: number;
    theta?: number;
    bidPrice: number;
    askPrice: number;
  };
  pe?: {
    securityId: string;
    symbol: string;
    ltp: number;
    change: number;
    changePercent: number;
    volume: number;
    oi: number;
    iv: number;
    delta?: number;
    theta?: number;
    bidPrice: number;
    askPrice: number;
  };
}

const OptionChainPage: React.FC = () => {
  const [underlying, setUnderlying] = useState('NIFTY');
  const [underlyingPrice, setUnderlyingPrice] = useState(24100.70);
  const [expiry, setExpiry] = useState('28-AUG-2026');
  const expiries = ['28-AUG-2026', '04-SEP-2026', '11-SEP-2026', '25-SEP-2026'];
  const [strikes, setStrikes] = useState<StrikeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pcrRatio, setPcrRatio] = useState(1.08);

  const [orderModal, setOrderModal] = useState<{
    open: boolean;
    symbol: string;
    strike: number;
    type: 'CE' | 'PE';
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
  }>({
    open: false,
    symbol: '',
    strike: 0,
    type: 'CE',
    side: 'BUY',
    price: 0,
    quantity: 50
  });

  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const loadOptionChain = useCallback(async () => {
    setLoading(true);
    try {
      const basePrice = underlying === 'BANKNIFTY' ? 57336 : underlying === 'FINNIFTY' ? 26204 : underlying === 'RELIANCE' ? 1283 : 24100;
      setUnderlyingPrice(basePrice);

      const step = underlying === 'BANKNIFTY' ? 100 : underlying === 'RELIANCE' ? 20 : 50;
      const atmStrike = Math.round(basePrice / step) * step;

      const generatedStrikes: StrikeData[] = [];
      let totalCeOi = 0;
      let totalPeOi = 0;

      for (let i = -7; i <= 7; i++) {
        const strikePrice = atmStrike + i * step;
        const dist = (strikePrice - basePrice);
        
        const ceLtp = Math.max(5, Number((Math.max(0, basePrice - strikePrice) + 120 * Math.exp(-Math.abs(dist) / (basePrice * 0.03))).toFixed(2)));
        const peLtp = Math.max(5, Number((Math.max(0, strikePrice - basePrice) + 120 * Math.exp(-Math.abs(dist) / (basePrice * 0.03))).toFixed(2)));
        
        const ceOi = Math.floor(25000 + Math.random() * 40000);
        const peOi = Math.floor(28000 + Math.random() * 45000);
        totalCeOi += ceOi;
        totalPeOi += peOi;

        generatedStrikes.push({
          strikePrice,
          ce: {
            securityId: `ce_${strikePrice}`,
            symbol: `${underlying} ${strikePrice} CE`,
            ltp: ceLtp,
            change: Number(((Math.random() - 0.45) * 12).toFixed(2)),
            changePercent: Number(((Math.random() - 0.45) * 8).toFixed(2)),
            volume: Math.floor(ceOi * 1.8),
            oi: ceOi,
            iv: Number((13.5 + Math.abs(i) * 0.4).toFixed(1)),
            delta: Number((0.50 - (i * 0.05)).toFixed(2)),
            theta: Number((-8.5 - Math.random() * 2).toFixed(1)),
            bidPrice: Number((ceLtp - 0.25).toFixed(2)),
            askPrice: Number((ceLtp + 0.25).toFixed(2))
          },
          pe: {
            securityId: `pe_${strikePrice}`,
            symbol: `${underlying} ${strikePrice} PE`,
            ltp: peLtp,
            change: Number(((Math.random() - 0.55) * 12).toFixed(2)),
            changePercent: Number(((Math.random() - 0.55) * 8).toFixed(2)),
            volume: Math.floor(peOi * 1.6),
            oi: peOi,
            iv: Number((14.0 + Math.abs(i) * 0.4).toFixed(1)),
            delta: Number((-0.50 - (i * 0.05)).toFixed(2)),
            theta: Number((-8.2 - Math.random() * 2).toFixed(1)),
            bidPrice: Number((peLtp - 0.25).toFixed(2)),
            askPrice: Number((peLtp + 0.25).toFixed(2))
          }
        });
      }

      setStrikes(generatedStrikes);
      setPcrRatio(Number((totalPeOi / (totalCeOi || 1)).toFixed(2)));
    } catch (e) {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [underlying]);

  useEffect(() => {
    loadOptionChain();
  }, [loadOptionChain]);

  const openTradeModal = (strike: number, type: 'CE' | 'PE', side: 'BUY' | 'SELL', price: number) => {
    const symbol = `${underlying} ${strike} ${type}`;
    const defaultQty = underlying === 'BANKNIFTY' ? 15 : underlying === 'FINNIFTY' ? 25 : 50;

    setOrderModal({
      open: true,
      symbol,
      strike,
      type,
      side,
      price,
      quantity: defaultQty
    });
    setOrderSuccess(null);
  };

  const executeOptionOrder = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders`, {
        symbol: orderModal.symbol,
        side: orderModal.side,
        quantity: orderModal.quantity,
        price: orderModal.price,
        orderType: 'MARKET',
        productType: 'INTRADAY'
      });

      if (res.data?.success) {
        setOrderSuccess(`Filled: ${orderModal.side} ${orderModal.quantity} Qty @ ₹${orderModal.price}`);
        setTimeout(() => {
          setOrderModal(prev => ({ ...prev, open: false }));
        }, 1200);
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
    <Layout>
      <Box sx={{ maxWidth: '100%' }}>
        {/* Unified Responsive Page Header */}
        <PageHeader
          title="Option Chain & Greeks"
          subtitle={`Spot: ₹${formatPrice(underlyingPrice)} • Put-Call Ratio (PCR): ${pcrRatio} ${pcrRatio >= 1 ? '(Bullish)' : '(Bearish)'}`}
          badge={<StatusBadge status={pcrRatio >= 1 ? 'live' : 'halted'} dot label={pcrRatio >= 1 ? 'PCR BULLISH' : 'PCR BEARISH'} />}
          action={
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
                <InputLabel sx={{ fontSize: '0.8rem' }}>Underlying</InputLabel>
                <Select value={underlying} label="Underlying" onChange={(e) => setUnderlying(e.target.value)} sx={{ fontSize: '0.82rem', borderRadius: 2 }}>
                  <MenuItem value="NIFTY">NIFTY 50</MenuItem>
                  <MenuItem value="BANKNIFTY">BANKNIFTY</MenuItem>
                  <MenuItem value="FINNIFTY">FINNIFTY</MenuItem>
                  <MenuItem value="RELIANCE">RELIANCE</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 130 } }}>
                <InputLabel sx={{ fontSize: '0.8rem' }}>Expiry</InputLabel>
                <Select value={expiry} label="Expiry" onChange={(e) => setExpiry(e.target.value)} sx={{ fontSize: '0.82rem', borderRadius: 2 }}>
                  {expiries.map(exp => (
                    <MenuItem key={exp} value={exp}>{exp}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh sx={{ fontSize: 15 }} />}
                onClick={loadOptionChain}
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, fontSize: '0.78rem', height: 38, borderColor: '#e2e8f0', color: '#475569' }}
              >
                Refresh
              </Button>
            </Box>
          }
        />

        {/* Option Chain Table */}
        <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#0f172a', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, py: 1 } }}>
                  <TableCell colSpan={5} align="center" sx={{ color: '#38bdf8', borderRight: '1px solid #1e293b' }}>CALLS (CE)</TableCell>
                  <TableCell align="center" sx={{ color: '#ffffff', bgcolor: '#1e293b' }}>STRIKE</TableCell>
                  <TableCell colSpan={5} align="center" sx={{ color: '#f43f5e', borderLeft: '1px solid #1e293b' }}>PUTS (PE)</TableCell>
                </TableRow>
                <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, py: 1, borderBottom: '1px solid #e2e8f0' } }}>
                  <TableCell align="right">OI</TableCell>
                  <TableCell align="right">IV</TableCell>
                  <TableCell align="right">Delta</TableCell>
                  <TableCell align="right">LTP (₹)</TableCell>
                  <TableCell align="center" sx={{ borderRight: '1px solid #e2e8f0' }}>Action</TableCell>
                  
                  <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 700 }}>Strike</TableCell>

                  <TableCell align="center" sx={{ borderLeft: '1px solid #e2e8f0' }}>Action</TableCell>
                  <TableCell align="left">LTP (₹)</TableCell>
                  <TableCell align="right">Delta</TableCell>
                  <TableCell align="right">IV</TableCell>
                  <TableCell align="right">OI</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: '#0f172a' }} />
                    </TableCell>
                  </TableRow>
                ) : (
                  strikes.map((s) => {
                    const isItmCe = s.strikePrice < underlyingPrice;
                    const isItmPe = s.strikePrice > underlyingPrice;

                    return (
                      <TableRow key={s.strikePrice} hover sx={{ '& td': { py: 0.9, borderBottom: '1px solid #f8fafc' } }}>
                        {/* CE */}
                        <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                          {s.ce?.oi.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                          {s.ce?.iv}%
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', color: '#0284c7', fontWeight: 600 }}>
                          {s.ce?.delta}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', fontWeight: 700, fontFamily: 'monospace' }}>
                          ₹{formatPrice(s.ce?.ltp)}
                        </TableCell>
                        <TableCell align="center" sx={{ bgcolor: isItmCe ? '#f8fafc' : 'transparent', borderRight: '1px solid #e2e8f0' }}>
                          <Button
                            size="small"
                            onClick={() => openTradeModal(s.strikePrice, 'CE', 'BUY', s.ce?.ltp || 0)}
                            sx={{ minWidth: 38, py: 0.1, px: 0.8, fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', bgcolor: '#f0fdf4', border: '1px solid #dcfce7', '&:hover': { bgcolor: '#dcfce7' }, textTransform: 'none', borderRadius: 1.5 }}
                          >
                            Buy
                          </Button>
                        </TableCell>

                        {/* Strike */}
                        <TableCell align="center" sx={{ fontWeight: 800, bgcolor: '#f1f5f9', fontSize: '0.82rem', fontFamily: 'monospace', color: '#0f172a' }}>
                          {s.strikePrice}
                        </TableCell>

                        {/* PE */}
                        <TableCell align="center" sx={{ bgcolor: isItmPe ? '#f8fafc' : 'transparent', borderLeft: '1px solid #e2e8f0' }}>
                          <Button
                            size="small"
                            onClick={() => openTradeModal(s.strikePrice, 'PE', 'BUY', s.pe?.ltp || 0)}
                            sx={{ minWidth: 38, py: 0.1, px: 0.8, fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', bgcolor: '#fef2f2', border: '1px solid #fee2e2', '&:hover': { bgcolor: '#fee2e2' }, textTransform: 'none', borderRadius: 1.5 }}
                          >
                            Buy
                          </Button>
                        </TableCell>
                        <TableCell align="left" sx={{ fontSize: '0.8rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', fontWeight: 700, fontFamily: 'monospace' }}>
                          ₹{formatPrice(s.pe?.ltp)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', color: '#e11d48', fontWeight: 600 }}>
                          {s.pe?.delta}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                          {s.pe?.iv}%
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                          {s.pe?.oi.toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Minimal Order Modal */}
        <Dialog open={orderModal.open} onClose={() => setOrderModal(prev => ({ ...prev, open: false }))} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 0, overflow: 'hidden' } }}>
          <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
              {orderModal.side} {orderModal.symbol}
            </Typography>
            <IconButton size="small" onClick={() => setOrderModal(prev => ({ ...prev, open: false }))} sx={{ color: '#94a3b8' }}>
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Box sx={{ p: 2.5 }}>
            {orderSuccess && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{orderSuccess}</Alert>}
            <TextField
              fullWidth
              label="Quantity"
              type="number"
              value={orderModal.quantity}
              onChange={(e) => setOrderModal(prev => ({ ...prev, quantity: Number(e.target.value) }))}
              size="small"
              sx={{ mb: 2 }}
            />
            <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #f1f5f9', mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="textSecondary">Price</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>₹{formatPrice(orderModal.price)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="textSecondary">Required Margin</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>₹{formatPrice(orderModal.price * orderModal.quantity)}</Typography>
              </Box>
            </Box>
            <Button
              fullWidth
              variant="contained"
              onClick={executeOptionOrder}
              sx={{
                bgcolor: orderModal.type === 'CE' ? '#0f172a' : '#dc2626',
                color: '#fff',
                fontWeight: 700,
                textTransform: 'none',
                py: 1,
                borderRadius: 2,
                '&:hover': { bgcolor: orderModal.type === 'CE' ? '#1e293b' : '#b91c1c' }
              }}
            >
              Confirm Paper Order
            </Button>
          </Box>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default OptionChainPage;
