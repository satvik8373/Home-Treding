import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Container,
  Alert,
  Snackbar,
  Paper,
  Chip,
  Typography,
  Button
} from '@mui/material';
import axios from 'axios';
import Layout from '../components/Layout';
import { API_CONFIG } from '../config/api';
import { BacktestControls } from '../components/backtest/BacktestControls';
import { BacktestSummaryCards } from '../components/backtest/BacktestSummaryCards';
import { MaxProfitLossChart } from '../components/backtest/MaxProfitLossChart';
import { DaywiseBreakdownHeatmap } from '../components/backtest/DaywiseBreakdownHeatmap';
import { TransactionDetailsAccordion } from '../components/backtest/TransactionDetailsAccordion';

export const BacktestPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const queryStrategyId = searchParams.get('strategyId') || location.state?.strategyId || '';

  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(queryStrategyId);
  const [strategiesList, setStrategiesList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRange, setSelectedRange] = useState<string>('1 Month');
  const [selectedDays, setSelectedDays] = useState<number>(22);
  const [creditsRemaining, setCreditsRemaining] = useState<number>(49);
  const [totalCredits] = useState<number>(50);

  const [loading, setLoading] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dhanConnected, setDhanConnected] = useState<boolean | null>(null);

  // Check Dhan connection status
  useEffect(() => {
    axios.get(`${API_CONFIG.BASE_URL}/api/brokers/connections`)
      .then(res => {
        const conns = res.data?.connections || [];
        const isDhan = conns.some((c: any) => c.broker === 'dhan' && c.status === 'Connected');
        setDhanConnected(isDhan);
      })
      .catch(() => setDhanConnected(false));
  }, []);

  // Load available strategies
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const [templatesRes, customRes] = await Promise.all([
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies/templates`).catch(() => ({ data: { templates: [] } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies`).catch(() => ({ data: { strategies: [] } }))
        ]);

        const combined: Array<{ id: string; name: string }> = [];
        if (templatesRes.data?.templates) {
          templatesRes.data.templates.forEach((t: any) => combined.push({ id: t.id, name: t.name }));
        }
        if (customRes.data?.strategies) {
          customRes.data.strategies.forEach((s: any) => {
            if (!combined.some(c => c.id === s.id)) {
              combined.push({ id: s.id, name: s.name });
            }
          });
        }

        if (combined.length > 0) {
          setStrategiesList(combined);
          if (!selectedStrategyId) {
            setSelectedStrategyId(combined[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load strategies for backtest:', err);
      }
    };

    fetchStrategies();
  }, [selectedStrategyId]);

  const runBacktest = async (strategyId: string = selectedStrategyId, days: number = selectedDays) => {
    if (!strategyId) {
      setErrorMessage('Please select a strategy to backtest.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const symbol = strategyId.toLowerCase().includes('bnf') || strategyId.toLowerCase().includes('bank') ? 'BANKNIFTY' : 'NIFTY 50';

      const res = await axios.post(
        `${API_CONFIG.BASE_URL}/api/backtest/run`,
        {
          strategyId,
          symbol,
          days,
          capital: 100000
        }
      );

      if (res.data?.success && res.data?.data) {
        setBacktestResult(res.data.data);
        if (res.data.creditsRemaining !== undefined) {
          setCreditsRemaining(res.data.creditsRemaining);
        }
      } else {
        setErrorMessage('Failed to execute backtest with DhanHQ market data.');
      }
    } catch (err: any) {
      console.error('Backtest run error:', err);
      const apiErr = err.response?.data?.message
        || err.response?.data?.error?.message
        || err.message
        || 'Error executing backtest simulator.';
      setErrorMessage(apiErr);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTrades = (format: 'csv' | 'json') => {
    try {
      if (backtestResult) {
        if (format === 'json') {
          const jsonStr = JSON.stringify(backtestResult, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `backtest_${selectedStrategyId}_${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }

        const trades = backtestResult.daywiseTransactions ? backtestResult.daywiseTransactions.flatMap((d: any) => d.trades) : [];
        const headers = [
          'Trade ID', 'Date', 'Entry Time', 'Exit Time', 'Instrument', 'Strike',
          'Option Type', 'Side', 'Qty', 'Lot Size', 'Entry Price', 'Exit Price',
          'Gross PnL', 'Brokerage', 'STT', 'Exchange Charges', 'GST', 'SEBI Charges',
          'Stamp Duty', 'Slippage', 'Total Charges', 'Net PnL', 'Status', 'Exit Reason',
          'Spot Ref Price', 'Fill Model', 'Data Source'
        ];
        const rows = trades.map((t: any) => [
          t.id, t.date, t.entryTime, t.exitTime, `"${t.instrument}"`,
          t.strike || '', t.optionType || '', t.side, t.quantity, t.lotSize || t.quantity,
          t.entryPrice, t.exitPrice, t.grossPnl, t.brokerage || 40, t.stt || 0,
          t.exchangeCharges || 0, t.gst || 0, t.sebiCharges || 0, t.stampDuty || 0,
          t.slippage || 0, t.totalCharges || 40, t.netPnl, t.status,
          `"${t.exitReason || t.reason || 'SQUAREOFF'}"`, `"${t.spotRefPrice || ''}"`,
          `"${t.fillModel || 'Real Market Bar-by-Bar Fill'}"`,
          `"${backtestResult.dataSource?.provider || 'Live Real NSE Market Feed (Real API Call)'}"`
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backtest_${selectedStrategyId}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      const baseUrl = API_CONFIG.BASE_URL;
      window.open(`${baseUrl}/api/backtest/export?strategyId=${selectedStrategyId}&days=${selectedDays}&format=${format}`, '_blank');
    } catch (e) {
      const baseUrl = API_CONFIG.BASE_URL;
      window.open(`${baseUrl}/api/backtest/export?strategyId=${selectedStrategyId}&days=${selectedDays}&format=${format}`, '_blank');
    }
  };

  const currentStrategyName = strategiesList.find(s => s.id === selectedStrategyId)?.name || selectedStrategyId || 'Select Strategy';

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: { xs: 8, sm: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Backtest Controls */}
        <BacktestControls
          strategyName={currentStrategyName}
          strategiesList={strategiesList}
          selectedStrategyId={selectedStrategyId}
          onSelectStrategy={(id) => {
            setSelectedStrategyId(id);
            setBacktestResult(null);
          }}
          selectedRange={selectedRange}
          onSelectRange={(range, days) => {
            setSelectedRange(range);
            setSelectedDays(days);
            setBacktestResult(null);
          }}
          creditsRemaining={creditsRemaining}
          totalCredits={totalCredits}
          totalPnl={backtestResult ? backtestResult.totalNetPnl : null}
          maxDrawdown={backtestResult ? backtestResult.maxDrawdown : null}
          equityCurve={backtestResult?.equityCurve || []}
          loading={loading}
          onRunBacktest={() => runBacktest(selectedStrategyId, selectedDays)}
          onExportTrades={handleExportTrades}
          onBack={() => navigate('/strategies')}
        />

        {/* Error State Banner */}
        {errorMessage && (
          <Alert
            severity="error"
            sx={{
              mt: 3,
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.95rem',
              alignItems: 'center',
              '& .MuiAlert-message': { width: '100%' }
            }}
            action={
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {(errorMessage.includes('Data APIs') || errorMessage.includes('DH-902')) && (
                  <Button
                    color="inherit"
                    size="small"
                    variant="contained"
                    onClick={() => window.open('https://dhanhq.co', '_blank')}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#ffffff', color: '#b91c1c', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#fef2f2' } }}
                  >
                    Activate Data APIs
                  </Button>
                )}
                <Button
                  color="inherit"
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/brokers')}
                  sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'currentColor', whiteSpace: 'nowrap' }}
                >
                  Go to Brokers
                </Button>
              </Box>
            }
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Historical Data Feed Notice
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {errorMessage}
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Empty State Banner */}
        {!backtestResult && !loading && !errorMessage && (
          <Paper
            elevation={0}
            sx={{
              p: 5,
              mt: 3,
              borderRadius: 3,
              border: '1px dashed #cbd5e1',
              bgcolor: '#ffffff',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
              No Backtest Results Generated Yet
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 520 }}>
              Select your strategy and duration above, then click <strong>Run Backtest</strong> to fetch real DhanHQ v2 candles and compute performance analytics.
            </Typography>
            <Button
              variant="contained"
              disabled={!selectedStrategyId}
              onClick={() => runBacktest(selectedStrategyId, selectedDays)}
              sx={{
                bgcolor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 2,
                px: 3.5,
                py: 1,
                mt: 1,
                '&:hover': { bgcolor: '#1d4ed8' }
              }}
            >
              Run Backtest
            </Button>
          </Paper>
        )}

        {/* Loading Spinner */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 1.5 }}>
            <CircularProgress size={36} sx={{ color: '#2563eb' }} />
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              Fetching real candles from DhanHQ v2 API &amp; simulating execution...
            </Typography>
          </Box>
        )}

        {/* Backtest Analytics Sections */}
        {backtestResult && backtestResult.summary && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 3.5 }}>
            {/* Real Data Source Banner */}
            {backtestResult.dataSource && (
              <Paper
                elevation={0}
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderRadius: 2.5,
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={`🟢 ${backtestResult.dataSource?.provider || 'NSE Live Market Feed'}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      bgcolor: '#dcfce7',
                      color: '#166534'
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                    Candles: <strong>{backtestResult.dataSource.candleCount}</strong> (5m OHLCV) | Period: <strong>{backtestResult.period}</strong>
                  </Typography>
                  {backtestResult.dataSource?.minSpotPrice > 0 && (
                    <Chip
                      label={`Market Range: ₹${backtestResult.dataSource.minSpotPrice.toLocaleString('en-IN')} - ₹${backtestResult.dataSource.maxSpotPrice.toLocaleString('en-IN')} (Last: ₹${backtestResult.dataSource.lastSpotPrice.toLocaleString('en-IN')})`}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        borderColor: '#cbd5e1',
                        color: '#0f172a'
                      }}
                    />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Security: <strong>{backtestResult.symbol} {backtestResult.dataSource.securityId ? `(${backtestResult.dataSource.securityId})` : ''}</strong> | Exchange Feed: <strong>NSE Real-Time</strong>
                </Typography>
              </Paper>
            )}

            {/* Summary Cards */}
            <BacktestSummaryCards summary={backtestResult.summary} />

            {/* Max Profit & Loss Bar Chart */}
            <MaxProfitLossChart
              dailyBars={backtestResult.dailyPnlBars || []}
              avgProfit={backtestResult.summary.avgProfitPerDay}
              avgLoss={backtestResult.summary.avgLossPerDay}
            />

            {/* Monthly Calendar Heatmap */}
            <DaywiseBreakdownHeatmap
              monthlyBreakdown={backtestResult.monthlyBreakdown || []}
            />

            {/* Transaction Details Accordion */}
            <TransactionDetailsAccordion
              daywiseTransactions={backtestResult.daywiseTransactions || []}
            />
          </Box>
        )}

        <Snackbar
          open={Boolean(errorMessage)}
          autoHideDuration={6000}
          onClose={() => setErrorMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
};

export default BacktestPage;
