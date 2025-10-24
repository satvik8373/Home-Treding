import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Container,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Dashboard,
  ShowChart,
  TrendingUp,
  Refresh,
  Info
} from '@mui/icons-material';
import MarketDashboard from '../components/MarketDashboard';
import TradingViewChart from '../components/TradingViewChart';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`market-page-tabpanel-${index}`}
      aria-labelledby={`market-page-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const MarketDataPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom>
          Live Market Data
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Real-time market data for Indian and Global markets with live charts
        </Typography>
        
        {/* Features Info */}
        <Alert 
          severity="info" 
          icon={<Info />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2">
            <strong>Features:</strong> Indian Markets (NSE) • Global Markets (US Stocks, Crypto, Forex) • 
            Live TradingView Charts • Real-time Price Updates • Multiple Data Sources
          </Typography>
        </Alert>
      </Box>

      {/* Main Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="market data tabs"
            variant="fullWidth"
          >
            <Tab 
              icon={<Dashboard />} 
              label="Market Dashboard" 
              id="market-page-tab-0"
              aria-controls="market-page-tabpanel-0"
            />
            <Tab 
              icon={<ShowChart />} 
              label="Live Charts" 
              id="market-page-tab-1"
              aria-controls="market-page-tabpanel-1"
            />
            <Tab 
              icon={<TrendingUp />} 
              label="Combined View" 
              id="market-page-tab-2"
              aria-controls="market-page-tabpanel-2"
            />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          <MarketDashboard />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Interactive Live Charts
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Professional TradingView charts with real-time data for Indian and Global markets
            </Typography>
            
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <TradingViewChart 
                  symbol="NSE:NIFTY50"
                  height={600}
                  theme="dark"
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Combined Market View
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Dashboard and charts side by side for comprehensive market analysis
            </Typography>
            
            <Grid container spacing={3}>
              {/* Left Column - Dashboard */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Paper sx={{ p: 2, height: 'fit-content' }}>
                  <Typography variant="h6" gutterBottom>
                    Market Overview
                  </Typography>
                  <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                    <MarketDashboard />
                  </Box>
                </Paper>
              </Grid>
              
              {/* Right Column - Charts */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Live Chart
                  </Typography>
                  <TradingViewChart 
                    symbol="NSE:NIFTY50"
                    height={600}
                    theme="dark"
                  />
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Paper>

      {/* Footer Info */}
      <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="body2" color="text.secondary" align="center">
          <strong>Data Sources:</strong> NSE Unofficial API (Free) • Yahoo Finance API (Free) • 
          TradingView Widgets (Free) • Dhan API (Optional)
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
          <strong>Markets Covered:</strong> Indian Stocks & Indices • US Stocks • Cryptocurrencies • 
          Forex • Commodities
        </Typography>
      </Box>
    </Container>
  );
};

export default MarketDataPage;
