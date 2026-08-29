import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Chip, Alert, CircularProgress } from '@mui/material';
import { TrendingUp, TrendingDown, Refresh } from '@mui/icons-material';
import apiService from '../services/apiService';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
}

const MarketData: React.FC = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [indices, setIndices] = useState<Stock[]>([]);
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [marketStatusMsg, setMarketStatusMsg] = useState('Live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const fetchData = async () => {
      try {
        setError(null);
        const response = await apiService.get<{ 
          success: boolean; 
          isMarketOpen?: boolean;
          marketStatus?: { status: string; message: string; nextOpen?: string };
          data?: any;
          stocks?: Stock[]; 
          indices?: Stock[] 
        }>(
          '/api/market/all'
        );
        
        if (response.success) {
          const s = response.stocks || (response.data && response.data.stocks) || [];
          const ind = response.indices || (response.data && response.data.indices) || [];
          setStocks(s);
          setIndices(ind);
          if (typeof response.isMarketOpen === 'boolean') {
            setIsMarketOpen(response.isMarketOpen);
            setMarketStatusMsg(response.isMarketOpen ? 'Live' : (response.marketStatus?.status || 'Closed'));
          }
          setLastUpdate(new Date());
        } else {
          setError('Failed to fetch market data');
        }
      } catch (error: any) {
        console.error('Failed to fetch market data:', error);
        setError('Unable to connect to market data service');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 5s if live, 30s if market closed
    timer = setInterval(fetchData, isMarketOpen ? 5000 : 30000);
    
    return () => clearInterval(timer);
  }, [isMarketOpen]);

  const renderCard = (item: Stock) => (
    <Box key={item.symbol}>
      <Card sx={{ 
        transition: 'all 0.3s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
      }}>
        <CardContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {item.symbol}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.75rem', mb: 1 }}>
            {item.name}
          </Typography>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
            ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            {item.change >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
            <Chip
              label={`${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)} (${item.changePercent.toFixed(2)}%)`}
              size="small"
              color={item.change >= 0 ? 'success' : 'error'}
              variant="filled"
            />
          </Box>
          {item.volume && (
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
              Vol: {item.volume.toLocaleString('en-IN')}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
        <CircularProgress size={24} />
        <Typography>Loading live market data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Live Update Indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Refresh sx={{ fontSize: 16, color: 'success.main' }} />
        <Typography variant="caption" color="success.main">
          🔴 REAL-TIME • Updates every 2s • Last: {lastUpdate?.toLocaleTimeString()}
        </Typography>
      </Box>

      {/* Stocks Section */}
      <Typography variant="h6" gutterBottom>
        Live Stocks
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3
        }}
      >
        {stocks.length > 0 ? stocks.map(renderCard) : (
          <Typography color="textSecondary">No stock data available</Typography>
        )}
      </Box>

      {/* Indices Section */}
      <Typography variant="h6" gutterBottom>
        Live Indices
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2
        }}
      >
        {indices.length > 0 ? indices.map(renderCard) : (
          <Typography color="textSecondary">No index data available</Typography>
        )}
      </Box>
    </Box>
  );
};

export default MarketData;
