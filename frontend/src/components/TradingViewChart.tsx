import React from 'react';
import { Box, Typography } from '@mui/material';

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  height?: number;
  theme?: string;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol, theme = 'light' }) => {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography color="textSecondary">
        Chart for {symbol} ({theme} theme) - TradingView integration coming soon
      </Typography>
    </Box>
  );
};

export default TradingViewChart;
