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
import { BacktestControls } from '../components/backtest/BacktestControls';
import { BacktestSummaryCards } from '../components/backtest/BacktestSummaryCards';
import { MaxProfitLossChart } from '../components/backtest/MaxProfitLossChart';
import { DaywiseBreakdownHeatmap } from '../components/backtest/DaywiseBreakdownHeatmap';
import { TransactionDetailsAccordion } from '../components/backtest/TransactionDetailsAccordion';

export const BacktestPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const queryStrategyId = searchParams.get('strategyId') || location.state?.strategyId || '1_percent_sl_strangle_bnf';

  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(queryStrategyId);
  const [strategiesList, setStrategiesList] = useState<Array<{ id: string; name: string }>>([
    { id: '1_percent_sl_strangle_bnf', name: '1 % SL strangle BNF' },
    { id: 'nifty-009-atm-breakout', name: 'NIFTY 0.09% ATM Full-Day Breakout' }
  ]);

  const [selectedRange, setSelectedRange] = useState<string>('1 Month');
  const [selectedDays, setSelectedDays] = useState<number>(22);
  const [creditsRemaining, setCreditsRemaining] = useState<number>(49);
  const [totalCredits] = useState<number>(50);

  const [loading, setLoading] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load available strategies
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const [templatesRes, customRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/strategies/templates`).catch(() => ({ data: { templates: [] } })),
          axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/strategies`).catch(() => ({ data: { strategies: [] } }))
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
        }
      } catch (err) {
        console.error('Failed to load strategies for backtest:', err);
      }
    };

    fetchStrategies();
  }, []);

  const runBacktest = async (strategyId: string = selectedStrategyId, days: number = selectedDays) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const symbol = strategyId.toLowerCase().includes('bnf') || strategyId.toLowerCase().includes('bank') ? 'BANKNIFTY' : 'NIFTY 50';

      const res = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/backtest/run`,
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
        setErrorMessage('Failed to simulate strategy replay.');
      }
    } catch (err: any) {
      console.error('Backtest run error:', err);
      const apiErr = err.response?.data?.error?.message
        || err.response?.data?.message
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

        // CSV download from state with full institutional columns
        const trades = backtestResult.daywiseTransactions ? backtestResult.daywiseTransactions.flatMap((d: any) => d.trades) : [];
        const headers = [
          'Trade ID',
          'Date',
          'Entry Time',
          'Exit Time',
          'Instrument',
          'Strike',
          'Option Type',
          'Side',
          'Qty',
          'Contract Lot Size',
          'Entry Price',
          'Exit Price',
          'Gross PnL',
          'Brokerage',
          'STT',
          'Exchange Charges',
          'GST',
          'SEBI Charges',
          'Stamp Duty',
          'Slippage',
          'Total Charges',
          'Net PnL',
          'Status',
          'Exit Reason',
          'Spot Ref Price',
          'Fill Model'
        ];
        const rows = trades.map((t: any) => [
          t.id,
          t.date,
          t.entryTime,
          t.exitTime,
          `"${t.instrument}"`,
          t.strike || '',
          t.optionType || '',
          t.side,
          t.quantity,
          t.lotSize || t.quantity,
          t.entryPrice,
          t.exitPrice,
          t.grossPnl,
          t.brokerage || 40,
          t.stt || 0,
          t.exchangeCharges || 0,
          t.gst || 0,
          t.sebiCharges || 0,
          t.stampDuty || 0,
          t.slippage || 0,
          t.totalCharges || 40,
          t.netPnl,
          t.status,
          `"${t.exitReason}"`,
          t.spotRefPrice || '',
          `"${t.fillModel || 'Next 5m Candle Open + 0.05% Slippage'}"`
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

      // Fallback to API direct export
      const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      window.open(`${baseUrl}/api/backtest/export?strategyId=${selectedStrategyId}&days=${selectedDays}&format=${format}`, '_blank');
    } catch (e) {
      const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      window.open(`${baseUrl}/api/backtest/export?strategyId=${selectedStrategyId}&days=${selectedDays}&format=${format}`, '_blank');
    }
  };

  const currentStrategyName = strategiesList.find(s => s.id === selectedStrategyId)?.name || '1 % SL strangle BNF';

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: { xs: 8, sm: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Main AlgoRooms-Style Backtest Controls & Equity Curve (Screenshot 3) */}
        <BacktestControls
          strategyName={currentStrategyName}
          strategiesList={strategiesList}
          selectedStrategyId={selectedStrategyId}
          onSelectStrategy={(id) => {
            setSelectedStrategyId(id);
            setBacktestResult(null); // Clear previous result on strategy switch
          }}
          selectedRange={selectedRange}
          onSelectRange={(range, days) => {
            setSelectedRange(range);
            setSelectedDays(days);
            setBacktestResult(null); // Clear previous result on range switch
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
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={() => navigate('/brokers')}
                sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'currentColor', whiteSpace: 'nowrap' }}
              >
                Go to Brokers
              </Button>
            }
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Official DhanHQ Market Data Notice
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {errorMessage}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#b91c1c' }}>
                Synthetic &amp; fake candle generation is strictly disabled. Official DhanHQ connection is required for live candle simulation.
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Empty State Banner (When no backtest has been run) */}
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
              Select your strategy and duration above, then click <strong>Run Backtest</strong> to simulate historical candle execution and generate performance metrics.
            </Typography>
            <Button
              variant="contained"
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
              Simulating chronological candle replay...
            </Typography>
          </Box>
        )}

        {/* Backtest Analytics Sections */}
        {backtestResult && backtestResult.summary && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 3.5 }}>
            {/* Provenance & Audit Status Bar */}
            {backtestResult.provenance && (
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    label={
                      backtestResult.provenance.status === 'REAL_DATA'
                        ? '🟢 DhanHQ Live API'
                        : backtestResult.provenance.status === 'CACHED_REAL_DATA'
                        ? '🔵 DhanHQ Verified Cache'
                        : '🟡 Demo Simulation'
                    }
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      bgcolor:
                        backtestResult.provenance.status === 'REAL_DATA'
                          ? '#dcfce7'
                          : backtestResult.provenance.status === 'CACHED_REAL_DATA'
                          ? '#dbeafe'
                          : '#fef3c7',
                      color:
                        backtestResult.provenance.status === 'REAL_DATA'
                          ? '#166534'
                          : backtestResult.provenance.status === 'CACHED_REAL_DATA'
                          ? '#1e40af'
                          : '#92400e'
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                    Resolution: <strong>{backtestResult.provenance.resolution}</strong> | Contract Lot: <strong>{backtestResult.provenance.contractLotSize}</strong>
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Execution: <strong>{backtestResult.provenance.executionModel}</strong>
                </Typography>
              </Paper>
            )}

            {/* 1. Summary Cards (Trading Days, Total Trades, Streak, Average Per Day, Max Drawdown badge) */}
            <BacktestSummaryCards summary={backtestResult.summary} />

            {/* 2. Max Profit & Loss Bar Chart with Top 10/20/30/All Filters - Screenshot 2 */}
            <MaxProfitLossChart
              dailyBars={backtestResult.dailyPnlBars || []}
              avgProfit={backtestResult.summary.avgProfitPerDay}
              avgLoss={backtestResult.summary.avgLossPerDay}
            />

            {/* 3. Daywise Breakdown Monthly Calendar Heatmaps (Jul 2026, Aug 2026) - Screenshot 1 */}
            <DaywiseBreakdownHeatmap
              monthlyBreakdown={backtestResult.monthlyBreakdown || []}
            />

            {/* 4. Transaction Details Accordions - Screenshot 1 */}
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
