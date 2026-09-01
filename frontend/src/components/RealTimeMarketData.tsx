import React, { useState, useEffect, useRef } from 'react';
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
  CircularProgress,
  Dialog,
  IconButton,
  LinearProgress
} from '@mui/material';
import { TrendingUp, TrendingDown, Close, ChevronRight, FiberManualRecord } from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

interface MarketTick {
  symbol: string;
  name?: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  prevClose?: number;
  volume: number;
  change: {
    absolute: number;
    percentage: number;
  };
  timestamp: string;
}

interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

interface DepthData {
  symbol: string;
  name: string;
  exchange: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  buyDepth: DepthLevel[];
  sellDepth: DepthLevel[];
  totalBuyQty: number;
  totalSellQty: number;
  timestamp: string;
  source: string;
}

interface MarketDataProps {
  symbols?: string[];
  autoRefresh?: boolean;
}

const RealTimeMarketData: React.FC<MarketDataProps> = ({ 
  symbols = ['NIFTY 50', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BHARTIARTL'], 
  autoRefresh = true 
}) => {
  const [marketData, setMarketData] = useState<Map<string, MarketTick>>(new Map());
  const [flashStates, setFlashStates] = useState<Map<string, 'up' | 'down'>>(new Map());
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [marketStatus, setMarketStatus] = useState<{ status?: string; message?: string; nextOpen?: string; istTime?: string } | null>(null);
  const [selectedDepth, setSelectedDepth] = useState<DepthData | null>(null);
  const prevPricesRef = useRef<Map<string, number>>(new Map());

  const symbolsKey = symbols.join(',');

  useEffect(() => {
    if (!autoRefresh) return;
    let isMounted = true;

    // 1. REST Data Fetch
    const fetchMarketFeed = async () => {
      try {
        const res = await axios.get(`${API_CONFIG.BASE_URL}/api/market/all`);
        if (res.data?.success && isMounted) {
          if (typeof res.data.isMarketOpen === 'boolean') {
            setIsMarketOpen(res.data.isMarketOpen);
          }
          if (res.data.marketStatus) {
            setMarketStatus({ ...res.data.marketStatus, istTime: res.data.istTime });
          }

          const newMap = new Map<string, MarketTick>();
          (res.data.data || []).forEach((item: any) => {
            const price = parseFloat(item.price || item.ltp) || 0;
            const oldPrice = prevPricesRef.current.get(item.symbol);
            const changeAbs = parseFloat(item.change) || 0;
            const changePct = parseFloat(item.changePercent) || 0;

            if (oldPrice !== undefined && oldPrice !== price) {
              const dir = price > oldPrice ? 'up' : 'down';
              setFlashStates(prev => new Map(prev).set(item.symbol, dir));
              setTimeout(() => {
                if (isMounted) {
                  setFlashStates(prev => {
                    const m = new Map(prev);
                    m.delete(item.symbol);
                    return m;
                  });
                }
              }, 400);
            }

            prevPricesRef.current.set(item.symbol, price);

            newMap.set(item.symbol, {
              symbol: item.symbol,
              name: item.name || item.symbol,
              price,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              prevClose: item.prevClose,
              volume: item.volume || 0,
              change: {
                absolute: changeAbs,
                percentage: changePct
              },
              timestamp: item.timestamp || new Date().toISOString()
            });
          });
          setMarketData(newMap);
          setConnectionStatus('connected');
        }
      } catch (err) {
        // Ignored
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMarketFeed();

    // Polling interval for resilient continuous ticks
    const pollInterval = setInterval(fetchMarketFeed, 2000);

    // 2. High-Frequency WebSocket Connection
    const newSocket: Socket = io(API_CONFIG.WS_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    newSocket.on('connect', () => {
      if (isMounted) {
        setConnectionStatus('connected');
        newSocket.emit('subscribe_market_data', symbols);
      }
    });

    newSocket.on('connect_error', () => {
      // In serverless, fallback polling takes over cleanly
    });

    newSocket.on('market_tick', (tick: any) => {
      if (!isMounted || !tick || !tick.symbol) return;

      if (typeof tick.isOpen === 'boolean') {
        setIsMarketOpen(tick.isOpen);
      }

      const newPrice = Number(tick.ltp || tick.price || 0);
      const oldPrice = prevPricesRef.current.get(tick.symbol) || newPrice;

      if (newPrice !== oldPrice) {
        const dir = newPrice > oldPrice ? 'up' : 'down';
        setFlashStates(prev => new Map(prev).set(tick.symbol, dir));
        setTimeout(() => {
          if (isMounted) {
            setFlashStates(prev => {
              const m = new Map(prev);
              m.delete(tick.symbol);
              return m;
            });
          }
        }, 400);
      }

      prevPricesRef.current.set(tick.symbol, newPrice);

      setMarketData(prev => {
        const updated = new Map(prev);
        const existing: MarketTick = updated.get(tick.symbol) || {
          symbol: tick.symbol,
          name: tick.name || tick.symbol,
          price: newPrice,
          open: newPrice,
          high: newPrice,
          low: newPrice,
          volume: tick.volume || 0,
          prevClose: tick.prevClose || newPrice,
          change: { absolute: 0, percentage: 0 },
          timestamp: new Date().toISOString()
        };

        const prevClose = tick.prevClose || existing.prevClose || newPrice;
        const changeAbs = Number((newPrice - prevClose).toFixed(2));
        const changePct = prevClose > 0 ? Number(((changeAbs / prevClose) * 100).toFixed(2)) : 0;

        updated.set(tick.symbol, {
          ...existing,
          name: tick.name || existing.name,
          price: newPrice,
          open: tick.open || existing.open,
          high: Math.max(existing.high || newPrice, newPrice),
          low: Math.min(existing.low || newPrice, newPrice),
          prevClose,
          volume: tick.volume || existing.volume,
          change: {
            absolute: changeAbs,
            percentage: changePct
          },
          timestamp: new Date().toISOString()
        });

        return updated;
      });
    });

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      newSocket.disconnect();
    };
  }, [symbolsKey, autoRefresh]);

  const openMarketDepth = async (symbol: string) => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/market/depth/${encodeURIComponent(symbol)}`);
      if (res.data?.success && res.data?.depth) {
        setSelectedDepth(res.data.depth);
      }
    } catch (e) {
      // Handled
    }
  };

  const formatPrice = (price: number = 0): string => {
    return price.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (loading && marketData.size === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #f1f5f9', boxShadow: 'none' }}>
        <CircularProgress size={28} sx={{ color: '#0f172a' }} />
        <Typography variant="body2" sx={{ mt: 1.5, color: '#64748b', fontSize: '0.85rem' }}>
          Connecting to market feed...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 0, borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
      {/* Sleek Minimalist Header */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
            Market Feed
          </Typography>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.6, 
              bgcolor: isMarketOpen ? '#f0fdf4' : '#fef3c7', 
              px: 1, 
              py: 0.3, 
              borderRadius: 4, 
              border: isMarketOpen ? '1px solid #dcfce7' : '1px solid #fde68a' 
            }}
          >
            <FiberManualRecord sx={{ fontSize: 8, color: isMarketOpen ? '#16a34a' : '#d97706' }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: isMarketOpen ? '#15803d' : '#92400e' }}>
              {isMarketOpen ? (connectionStatus === 'connected' ? 'LIVE' : 'SYNCING') : 'MARKET CLOSED'}
            </Typography>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
          {isMarketOpen ? 'NSE & DhanHQ Live' : (marketStatus?.nextOpen || 'NSE Close Prices Fixed')}
        </Typography>
      </Box>

      {/* Clean Minimalist Table */}
      <TableContainer sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', py: 1.2, borderBottom: '1px solid #e2e8f0' } }}>
              <TableCell sx={{ pl: 2.5 }}>Instrument</TableCell>
              <TableCell align="right">LTP (₹)</TableCell>
              <TableCell align="right">Change</TableCell>
              <TableCell align="right">Range (H / L)</TableCell>
              <TableCell align="right">Volume</TableCell>
              <TableCell align="center" sx={{ pr: 2.5 }}>Depth</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {symbols.map((symbol) => {
              const data = marketData.get(symbol);
              const flash = flashStates.get(symbol);
              const isPositive = data ? data.change.absolute >= 0 : true;

              return (
                <TableRow 
                  key={symbol} 
                  hover
                  sx={{
                    bgcolor: flash === 'up' ? 'rgba(22, 163, 74, 0.08)' : flash === 'down' ? 'rgba(220, 38, 38, 0.08)' : 'transparent',
                    transition: 'background-color 0.3s ease',
                    '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' }
                  }}
                >
                  {/* Symbol */}
                  <TableCell sx={{ pl: 2.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                      {symbol}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                      {data?.name || 'NSE'}
                    </Typography>
                  </TableCell>

                  {/* LTP */}
                  <TableCell align="right">
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 700, 
                        fontFamily: 'monospace',
                        fontSize: '0.88rem',
                        color: isPositive ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {data ? `₹${formatPrice(data.price)}` : '--'}
                    </Typography>
                  </TableCell>

                  {/* Change */}
                  <TableCell align="right">
                    {data ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          {isPositive ? <TrendingUp sx={{ fontSize: 13, color: '#16a34a' }} /> : <TrendingDown sx={{ fontSize: 13, color: '#dc2626' }} />}
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: isPositive ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                            {isPositive ? '+' : ''}{data.change.absolute.toFixed(2)}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.7rem', color: isPositive ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                          ({isPositive ? '+' : ''}{data.change.percentage.toFixed(2)}%)
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="textSecondary">--</Typography>
                    )}
                  </TableCell>

                  {/* Day Range */}
                  <TableCell align="right">
                    {data && data.high ? (
                      <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#475569' }}>
                        {formatPrice(data.high)} / {formatPrice(data.low || data.price)}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="textSecondary">--</Typography>
                    )}
                  </TableCell>

                  {/* Volume */}
                  <TableCell align="right">
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {data && data.volume > 0 ? data.volume.toLocaleString('en-IN') : '--'}
                    </Typography>
                  </TableCell>

                  {/* Depth Action */}
                  <TableCell align="center" sx={{ pr: 2.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => openMarketDepth(symbol)}
                      sx={{ color: '#64748b', '&:hover': { color: '#0f172a', bgcolor: '#f1f5f9' }, p: 0.6 }}
                    >
                      <ChevronRight sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Minimalist Depth Modal */}
      <Dialog
        open={Boolean(selectedDepth)}
        onClose={() => setSelectedDepth(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 0,
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }
        }}
      >
        {selectedDepth && (
          <Box>
            {/* Modal Header */}
            <Box sx={{ p: 2.5, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                  {selectedDepth.symbol}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                  {selectedDepth.name} • {selectedDepth.exchange}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: selectedDepth.change >= 0 ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                    ₹{formatPrice(selectedDepth.ltp)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: selectedDepth.change >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {selectedDepth.change >= 0 ? '+' : ''}{selectedDepth.change.toFixed(2)} ({selectedDepth.changePercent.toFixed(2)}%)
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setSelectedDepth(null)} sx={{ color: '#94a3b8' }}>
                  <Close sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ p: 2.5 }}>
              {/* Clean Volume Pressure */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#16a34a' }}>
                    Buy: {selectedDepth.totalBuyQty.toLocaleString('en-IN')} (
                    {((selectedDepth.totalBuyQty / (selectedDepth.totalBuyQty + selectedDepth.totalSellQty || 1)) * 100).toFixed(0)}%)
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#dc2626' }}>
                    Sell: {selectedDepth.totalSellQty.toLocaleString('en-IN')} (
                    {((selectedDepth.totalSellQty / (selectedDepth.totalBuyQty + selectedDepth.totalSellQty || 1)) * 100).toFixed(0)}%)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(selectedDepth.totalBuyQty / (selectedDepth.totalBuyQty + selectedDepth.totalSellQty || 1)) * 100}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: '#fee2e2',
                    '& .MuiLinearProgress-bar': { bgcolor: '#16a34a' }
                  }}
                />
              </Box>

              {/* Orderbook Columns */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                {/* Bids */}
                <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #f1f5f9' }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', mb: 1 }}>
                    BIDS (BUYERS)
                  </Typography>
                  {selectedDepth.buyDepth.map((b, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>{b.orders}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace' }}>{b.quantity}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>₹{formatPrice(b.price)}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Asks */}
                <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #f1f5f9' }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', mb: 1 }}>
                    ASKS (SELLERS)
                  </Typography>
                  {selectedDepth.sellDepth.map((a, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>₹{formatPrice(a.price)}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace' }}>{a.quantity}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>{a.orders}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Day Stats Row */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, pt: 1.5, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>Open</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>₹{formatPrice(selectedDepth.open)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>High</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>₹{formatPrice(selectedDepth.high)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>Low</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>₹{formatPrice(selectedDepth.low)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>Prev Close</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>₹{formatPrice(selectedDepth.prevClose)}</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>
    </Paper>
  );
};

export default RealTimeMarketData;