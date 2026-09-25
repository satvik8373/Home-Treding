import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Refresh, Close, AccountBalanceWallet } from '@mui/icons-material';
import Layout from '../components/Layout';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

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

const UNDERLYING_MAP: Record<string, { securityId: string; segment: string; defaultStep: number }> = {
  'NIFTY': { securityId: '13', segment: 'IDX_I', defaultStep: 50 },
  'BANKNIFTY': { securityId: '25', segment: 'IDX_I', defaultStep: 100 },
  'FINNIFTY': { securityId: '27', segment: 'IDX_I', defaultStep: 50 },
  'RELIANCE': { securityId: '2885', segment: 'NSE_EQ', defaultStep: 20 }
};

export const OptionChainPage: React.FC = () => {
  const navigate = useNavigate();
  const [underlying, setUnderlying] = useState('NIFTY');
  const [underlyingPrice, setUnderlyingPrice] = useState<number>(0);
  const [expiry, setExpiry] = useState<string>('');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [strikes, setStrikes] = useState<StrikeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pcrRatio, setPcrRatio] = useState<number>(1.0);
  const [dhanConnected, setDhanConnected] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    quantity: 65
  });

  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // 1. Check Dhan Broker Connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await axios.get(`${API_CONFIG.BASE_URL}/api/brokers/connections`);
        const conns = res.data?.connections || [];
        const isDhan = conns.some((c: any) => c.broker === 'dhan' && c.status === 'Connected');
        setDhanConnected(isDhan);
      } catch (_) {
        setDhanConnected(false);
      }
    };
    checkConnection();
  }, []);

  // 2. Load Available Expiries for Selected Underlying
  useEffect(() => {
    if (dhanConnected === false) return;

    const fetchExpiries = async () => {
      const meta = UNDERLYING_MAP[underlying] || UNDERLYING_MAP['NIFTY'];
      try {
        const res = await axios.post(`${API_CONFIG.BASE_URL}/api/brokers/option-chain/expiries`, {
          underlyingSecurityId: meta.securityId
        });
        if (res.data?.success && Array.isArray(res.data?.expiries) && res.data.expiries.length > 0) {
          setExpiries(res.data.expiries);
          setExpiry(res.data.expiries[0]);
        } else {
          setExpiries([]);
        }
      } catch (_) {
        setExpiries([]);
      }
    };

    fetchExpiries();
  }, [underlying, dhanConnected]);

  // 3. Load Real Option Chain from DhanHQ API
  const loadOptionChain = useCallback(async () => {
    if (dhanConnected === false) {
      setStrikes([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const meta = UNDERLYING_MAP[underlying] || UNDERLYING_MAP['NIFTY'];

    try {
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/brokers/option-chain`, {
        underlyingSecurityId: meta.securityId,
        expiry: expiry || undefined
      });

      if (res.data?.success && res.data?.optionChain) {
        const chain = res.data.optionChain;
        if (chain.underlyingPrice) {
          setUnderlyingPrice(chain.underlyingPrice);
        }
        if (chain.pcrRatio !== undefined) {
          setPcrRatio(chain.pcrRatio);
        }
        if (Array.isArray(chain.strikes) && chain.strikes.length > 0) {
          setStrikes(chain.strikes);
        } else {
          setStrikes([]);
        }
      } else {
        setStrikes([]);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to fetch option chain from broker.';
      setErrorMessage(msg);
      setStrikes([]);
    } finally {
      setLoading(false);
    }
  }, [underlying, expiry, dhanConnected]);

  useEffect(() => {
    if (dhanConnected) {
      loadOptionChain();
    }
  }, [loadOptionChain, dhanConnected]);

  const openTradeModal = (strike: number, type: 'CE' | 'PE', side: 'BUY' | 'SELL', price: number) => {
    const symbol = `${underlying} ${strike} ${type}`;
    const defaultQty = underlying === 'BANKNIFTY' ? 30 : underlying === 'FINNIFTY' ? 40 : 65;

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
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/trading/orders`, {
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
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Order placement failed.';
      setOrderSuccess(`Error: ${msg}`);
    }
  };

  const formatPrice = (val: number = 0) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        {/* Unified Responsive Page Header */}
        <PageHeader
          title="Option Chain & Greeks"
          subtitle={
            underlyingPrice > 0
              ? `Spot: ₹${formatPrice(underlyingPrice)} • Put-Call Ratio (PCR): ${pcrRatio} ${pcrRatio >= 1 ? '(Bullish)' : '(Bearish)'}`
              : `Put-Call Ratio (PCR): ${pcrRatio || 1.0}`
          }
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

              {expiries.length > 0 && (
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 130 } }}>
                  <InputLabel sx={{ fontSize: '0.8rem' }}>Expiry</InputLabel>
                  <Select value={expiry} label="Expiry" onChange={(e) => setExpiry(e.target.value)} sx={{ fontSize: '0.82rem', borderRadius: 2 }}>
                    {expiries.map(exp => (
                      <MenuItem key={exp} value={exp}>{exp}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh sx={{ fontSize: 15 }} />}
                onClick={loadOptionChain}
                disabled={loading}
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, fontSize: '0.78rem', height: 38, borderColor: '#e2e8f0', color: '#475569' }}
              >
                Refresh
              </Button>
            </Box>
          }
        />

        {/* Dhan Broker Disconnected Empty State */}
        {dhanConnected === false && (
          <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', p: 4, mb: 3 }}>
            <EmptyState
              icon={<AccountBalanceWallet sx={{ fontSize: 32, color: '#64748b' }} />}
              title="Dhan Broker Disconnected"
              description="Connect your active DhanHQ trading account in Broker Connections to stream authentic real-time NSE Option Chain data with Greeks, Open Interest analysis, and direct order placement."
              action={{
                label: 'Connect Dhan Broker',
                onClick: () => navigate('/brokers')
              }}
            />
          </Paper>
        )}

        {/* Option Chain Table */}
        {dhanConnected !== false && (
          <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: 'none', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 650 }}>
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
                  ) : strikes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                        <EmptyState
                          title="No Live Option Chain Data"
                          description={errorMessage || 'Option chain data is currently unavailable for the selected expiry. This may occur outside NSE market hours or if F&O segment permissions are pending on Dhan.'}
                          action={{
                            label: 'Retry Fetch',
                            onClick: loadOptionChain
                          }}
                          compact
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    strikes.map((s) => {
                      const isItmCe = underlyingPrice > 0 && s.strikePrice < underlyingPrice;
                      const isItmPe = underlyingPrice > 0 && s.strikePrice > underlyingPrice;

                      return (
                        <TableRow key={s.strikePrice} hover sx={{ '& td': { py: 0.9, borderBottom: '1px solid #f8fafc' } }}>
                          {/* CE */}
                          <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                            {s.ce?.oi ? s.ce.oi.toLocaleString('en-IN') : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                            {s.ce?.iv ? `${s.ce.iv}%` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', color: '#0284c7', fontWeight: 600 }}>
                            {s.ce?.delta ?? '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem', bgcolor: isItmCe ? '#f8fafc' : 'transparent', fontWeight: 700, fontFamily: 'monospace' }}>
                            {s.ce?.ltp ? `₹${formatPrice(s.ce.ltp)}` : '—'}
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: isItmCe ? '#f8fafc' : 'transparent', borderRight: '1px solid #e2e8f0' }}>
                            <Button
                              size="small"
                              disabled={!s.ce?.ltp}
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
                              disabled={!s.pe?.ltp}
                              onClick={() => openTradeModal(s.strikePrice, 'PE', 'BUY', s.pe?.ltp || 0)}
                              sx={{ minWidth: 38, py: 0.1, px: 0.8, fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', bgcolor: '#fef2f2', border: '1px solid #fee2e2', '&:hover': { bgcolor: '#fee2e2' }, textTransform: 'none', borderRadius: 1.5 }}
                            >
                              Buy
                            </Button>
                          </TableCell>
                          <TableCell align="left" sx={{ fontSize: '0.8rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', fontWeight: 700, fontFamily: 'monospace' }}>
                            {s.pe?.ltp ? `₹${formatPrice(s.pe.ltp)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', color: '#e11d48', fontWeight: 600 }}>
                            {s.pe?.delta ?? '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                            {s.pe?.iv ? `${s.pe.iv}%` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', bgcolor: isItmPe ? '#f8fafc' : 'transparent', color: '#64748b' }}>
                            {s.pe?.oi ? s.pe.oi.toLocaleString('en-IN') : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

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
            {orderSuccess && <Alert severity={orderSuccess.startsWith('Error') ? 'error' : 'success'} sx={{ mb: 2, borderRadius: 2 }}>{orderSuccess}</Alert>}
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
              Confirm Order
            </Button>
          </Box>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default OptionChainPage;
