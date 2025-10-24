import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Autocomplete,
  Chip,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  ShowChart,
  TrendingUp,
  TrendingDown,
  Refresh,
  Search,
  Settings
} from '@mui/icons-material';
import Layout from '../components/Layout';
import MarketDataDisplay from '../components/MarketDataDisplay';
import TradingViewChart from '../components/TradingViewChart';
import marketDataService, { SymbolSearchResult } from '../services/marketDataService';

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
      id={`market-tabpanel-${index}`}
      aria-labelledby={`market-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const MarketData: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY50');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('1d');
  const [chartInterval, setChartInterval] = useState('1m');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSymbolSearch = async () => {
    if (searchQuery.length < 2) return;

    try {
      setSearchLoading(true);
      const results = await marketDataService.searchSymbols(searchQuery);
      setSearchResults(results);
    } catch (error: any) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    setSearchQuery('');
    setSearchResults([]);
  };

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSymbolSearch();
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  return (
    <Layout>
      <Box>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <ShowChart sx={{ mr: 2, color: 'primary.main' }} />
          Market Data & Analysis
        </Typography>

        <Paper sx={{ mb: 3, p: 2 }}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, 
            gap: 2, 
            alignItems: 'center' 
          }}>
            <Box>
              <Autocomplete
                freeSolo
                options={searchResults.map(result => result.symbol)}
                loading={searchLoading}
                value={searchQuery}
                onInputChange={(event, newValue) => setSearchQuery(newValue || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Symbol"
                    placeholder="e.g., NIFTY50, RELIANCE, TCS"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const result = searchResults.find(r => r.symbol === option);
                  return (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body1">{result?.symbol}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {result?.name} • {result?.exchange}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }}
                onChange={(event, value) => {
                  if (value) handleSymbolSelect(value);
                }}
              />
            </Box>

            <Box>
              <FormControl fullWidth size="small">
                <InputLabel>Period</InputLabel>
                <Select
                  value={chartPeriod}
                  label="Period"
                  onChange={(e) => setChartPeriod(e.target.value)}
                >
                  <MenuItem value="1d">1 Day</MenuItem>
                  <MenuItem value="5d">5 Days</MenuItem>
                  <MenuItem value="1mo">1 Month</MenuItem>
                  <MenuItem value="3mo">3 Months</MenuItem>
                  <MenuItem value="6mo">6 Months</MenuItem>
                  <MenuItem value="1y">1 Year</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FormControl fullWidth size="small">
                <InputLabel>Interval</InputLabel>
                <Select
                  value={chartInterval}
                  label="Interval"
                  onChange={(e) => setChartInterval(e.target.value)}
                >
                  <MenuItem value="1m">1 Minute</MenuItem>
                  <MenuItem value="5m">5 Minutes</MenuItem>
                  <MenuItem value="15m">15 Minutes</MenuItem>
                  <MenuItem value="1h">1 Hour</MenuItem>
                  <MenuItem value="1d">1 Day</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                }
                label="Auto Refresh"
              />
            </Box>

            <Box>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => window.location.reload()}
                fullWidth
              >
                Refresh All
              </Button>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="market data tabs">
            <Tab label="Live Data" />
            <Tab label="Charts" />
            <Tab label="Indices" />
            <Tab label="Settings" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <MarketDataDisplay
            selectedSymbol={selectedSymbol}
            showChart={false}
            autoRefresh={autoRefresh}
            refreshInterval={refreshInterval * 1000}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShowChart />
                  {selectedSymbol} Chart
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip label={`${chartPeriod} • ${chartInterval}`} size="small" />
                  <Button size="small" variant="outlined" startIcon={<Refresh />}>
                    Refresh
                  </Button>
                </Box>
              </Box>
              
              <TradingViewChart
                symbol={selectedSymbol}
                height={500}
                interval={chartInterval}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <MarketDataDisplay
            selectedSymbol=""
            showChart={false}
            autoRefresh={autoRefresh}
            refreshInterval={refreshInterval * 1000}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings />
                Market Data Settings
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
                gap: 3 
              }}>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                      />
                    }
                    label="Enable Auto Refresh"
                  />
                </Box>
                
                <Box>
                  <TextField
                    label="Refresh Interval (seconds)"
                    type="number"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    disabled={!autoRefresh}
                    size="small"
                    fullWidth
                  />
                </Box>
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Data Sources:</strong> This platform uses multiple free APIs including Yahoo Finance, 
                  Alpha Vantage, and Finnhub for real-time market data. For authenticated users, 
                  Dhan API provides additional real-time data and trading capabilities.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </TabPanel>
      </Box>
    </Layout>
  );
};

export default MarketData;
