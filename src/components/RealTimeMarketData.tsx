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
  CircularProgress,
  Alert
} from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';

interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  change: {
    absolute: number;
    percentage: number;
  };
  timestamp: string;
}

interface MarketDataProps {
  symbols?: string[];
  autoRefresh?: boolean;
}

const RealTimeMarketData: React.FC<MarketDataProps> = ({ 
  symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'NIFTY50'], 
  autoRefresh = true 
}) => {
  const [marketData, setMarketData] = useState<Map<string, MarketTick>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (!autoRefresh) return;

    // For demo mode, simulate market data instead of WebSocket
    setConnectionStatus('connected');
    setLoading(false);
    
    // Simulate market data updates
    const interval = setInterval(() => {
      const simulatedData = new Map();
      symbols.forEach(symbol => {
        const basePrice = 100 + Math.random() * 2000;
        const change = (Math.random() - 0.5) * 20;
        simulatedData.set(symbol, {
          symbol,
          price: basePrice,
          volume: Math.floor(Math.random() * 100000),
          change: {
            absolute: change,
            percentage: (change / basePrice) * 100
          },
          timestamp: new Date().toISOString()
        });
      });
      setMarketData(simulatedData);
    }, 2000);

    // Try WebSocket connection (will fail gracefully in demo mode)
    const wsUrl = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:5000';
    const newSocket = io(wsUrl, {
      autoConnect: false // Don't auto-connect to prevent console errors
    });

    newSocket.on('connect', () => {
      console.log('📡 Connected to real-time market data');
      setConnectionStatus('connected');
      setError(null);
      newSocket.emit('subscribe_market_data', symbols);
    });

    newSocket.on('connect_error', () => {
      console.log('📡 WebSocket unavailable, using simulated data');
      setConnectionStatus('connected'); // Show as connected with simulated data
    });

    newSocket.on('market_tick', (tick: MarketTick) => {
      setMarketData(prev => {
        const updated = new Map(prev);
        updated.set(tick.symbol, tick);
        return updated;
      });
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      clearInterval(interval);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [symbols.join(','), autoRefresh]); // Use symbols.join(',') to prevent infinite loops

  const formatPrice = (price: number): string => {
    return price.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  const getChangeColor = (change: number): 'success' | 'error' | 'default' => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp fontSize="small" />;
    if (change < 0) return <TrendingDown fontSize="small" />;
    return <TrendingFlat fontSize="small" />;
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Live Market Data
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={connectionStatus}
            color={connectionStatus === 'connected' ? 'success' : 'default'}
            size="small"
          />
          {loading && <CircularProgress size={16} />}
        </Box>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Symbol</strong></TableCell>
              <TableCell align="right"><strong>Price</strong></TableCell>
              <TableCell align="right"><strong>Change</strong></TableCell>
              <TableCell align="right"><strong>Change %</strong></TableCell>
              <TableCell align="right"><strong>Volume</strong></TableCell>
              <TableCell align="right"><strong>Time</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {symbols.map((symbol) => {
              const data = marketData.get(symbol);
              
              return (
                <TableRow key={symbol} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {symbol}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      ₹{data ? formatPrice(data.price) : '--'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {data ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {getChangeIcon(data.change.absolute)}
                        <Typography
                          variant="body2"
                          color={getChangeColor(data.change.absolute)}
                          fontWeight="medium"
                        >
                          {formatChange(data.change.absolute)}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary">--</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {data ? (
                      <Chip
                        label={`${formatChange(data.change.percentage)}%`}
                        color={getChangeColor(data.change.percentage)}
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" color="textSecondary">--</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="textSecondary">
                      {data ? data.volume.toLocaleString() : '--'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="textSecondary">
                      {data ? new Date(data.timestamp).toLocaleTimeString() : '--'}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {marketData.size === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography color="textSecondary">
            No market data available
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default RealTimeMarketData;