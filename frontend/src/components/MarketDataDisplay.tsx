import React from 'react';
import { Box, Typography } from '@mui/material';

interface MarketDataDisplayProps {
  selectedSymbol?: string;
  showChart?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const MarketDataDisplay: React.FC<MarketDataDisplayProps> = ({ 
  selectedSymbol = 'NIFTY50',
  showChart = true,
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography color="textSecondary">
        Market Data Display for {selectedSymbol} - Coming soon
      </Typography>
      <Typography variant="caption" display="block">
        Chart: {showChart ? 'Yes' : 'No'} | Auto-refresh: {autoRefresh ? 'Yes' : 'No'} | Interval: {refreshInterval}ms
      </Typography>
    </Box>
  );
};

export default MarketDataDisplay;
