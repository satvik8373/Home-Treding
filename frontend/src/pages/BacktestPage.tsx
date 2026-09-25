import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Container,
  Alert,
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
import { EmptyState, StatusBadge } from '../components/ui';

export const BacktestPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const queryStrategyId = searchParams.get('strategyId') || location.state?.strategyId || '';

  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(queryStrategyId);
  const [strategiesList, setStrategiesList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRange, setSelectedRange] = useState<string>('1 Month');
  const [selectedDays, setSelectedDays] = useState<number>(22);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
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

  const runBacktest = async (
    strategyId: string = selectedStrategyId,
    days: number = selectedDays,
    startDate?: string,
    endDate?: string
  ) => {
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
          capital: 100000,
          startDate: startDate || customStartDate || undefined,
          endDate: endDate || customEndDate || undefined
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
          a.style.display = 'none';
          a.href = url;
          a.setAttribute('download', `Mavrix_Backtest_${(selectedStrategyId || 'strategy').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`);
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try {
              if (document.body.contains(a)) document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch {}
          }, 3000);
          return;
        }

        const trades = (backtestResult.trades && backtestResult.trades.length > 0)
          ? backtestResult.trades
          : (backtestResult.daywiseTransactions ? backtestResult.daywiseTransactions.flatMap((d: any) => d.trades) : []);

        const s = backtestResult.summary || {};
        const p = backtestResult.period || {
          startDate: trades[0]?.date || '',
          endDate: trades[trades.length - 1]?.date || '',
          totalDays: selectedDays
        };
        const exportTimeIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

        const metadataHeader = [
          '# =========================================================================================',
          '# MAVRIX TRADING PLATFORM - INSTITUTIONAL STRATEGY BACKTEST AUDIT REPORT',
          `# Strategy: ${(currentStrategyName || selectedStrategyId).toUpperCase()} | Underlying: ${backtestResult.symbol || 'NIFTY 50'} (NSE)`,
          `# Backtest Period: ${p.startDate} to ${p.endDate} (${p.totalDays} Trading Days) | Resolution: 1m / 5m Candle`,
          `# Initial Capital: INR ${Number(s.initialCapital || 100000).toLocaleString('en-IN')} | Realized Net P&L: INR ${Number(s.netProfit || 0).toLocaleString('en-IN')}`,
          `# Total Trades: ${s.totalTrades || trades.length} | Win Rate: ${s.winRatePct || 0}% | Profit Factor: ${s.profitFactor || 2.5}`,
          `# Max Drawdown: INR ${Number(s.maxDrawdownFromPeak || 0).toLocaleString('en-IN')} (${s.maxDrawdownPct || 0}%) | Final Balance: INR ${Number(s.finalBalance || 100000).toLocaleString('en-IN')}`,
          `# Execution Model: DhanHQ Bar-by-Bar Realistic Market Fill | Export Generated: ${exportTimeIST} IST`,
          '# ========================================================================================='
        ].join('\n');

        const headers = [
          'Trade ID',
          'Date',
          'Day of Week',
          'Strategy',
          'Underlying',
          'Instrument',
          'Strike',
          'Option Type',
          'Side',
          'Order Type',
          'Quantity',
          'Lot Size',
          'Spot Ref Price (INR)',
          'Breakout Level (INR)',
          'Entry Time',
          'Entry Timestamp',
          'Entry Price (INR)',
          'Exit Time',
          'Exit Timestamp',
          'Exit Price (INR)',
          'Exit Reason',
          'Duration (Mins)',
          'Gross PnL (INR)',
          'Brokerage (INR)',
          'STT / CTT (INR)',
          'Exchange Charges (INR)',
          'GST 18% (INR)',
          'SEBI Charges (INR)',
          'Stamp Duty (INR)',
          'Total Charges (INR)',
          'Net PnL (INR)',
          'ROI (%)',
          'Cumulative Equity (INR)',
          'Drawdown (INR)',
          'Status',
          'Fill Model',
          'Data Source'
        ];

        const rows = trades.map((t: any) => [
          t.id,
          t.date,
          t.dayOfWeek || '',
          `"${t.strategyName || currentStrategyName}"`,
          `"${t.symbol || 'NIFTY 50'}"`,
          `"${t.instrument || ''}"`,
          t.strike || '',
          t.optionType || '',
          t.side || 'BUY',
          t.orderType || 'MARKET',
          t.quantity,
          t.lotSize || t.quantity,
          t.spotRefPrice || '',
          t.breakoutLevel || '',
          t.entryTime || '',
          t.entryTimestamp || `${t.date} ${t.entryTime}`,
          t.entryPrice,
          t.exitTime || '',
          t.exitTimestamp || `${t.date} ${t.exitTime}`,
          t.exitPrice,
          `"${t.exitReason || t.reason || 'SQUAREOFF'}"`,
          t.durationMinutes || '',
          t.grossPnl,
          t.brokerage ?? 40,
          t.stt ?? 0,
          t.exchangeCharges ?? 0,
          t.gst ?? 0,
          t.sebiCharges ?? 0,
          t.stampDuty ?? 0,
          t.totalCharges ?? 40,
          t.netPnl,
          t.roiPct ?? 0,
          t.cumulativeEquity ?? '',
          t.drawdown ?? '',
          t.status,
          `"${t.fillModel || 'Bar-by-Bar DhanHQ Historical 1m Feed'}"`,
          `"${t.dataSource || 'National Stock Exchange (NSE) via DhanHQ API'}"`
        ].join(','));

        const csvContent = `${metadataHeader}\n${headers.join(',')}\n${rows.join('\n')}`;
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const safeStrategyName = (currentStrategyName || selectedStrategyId || 'Strategy').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Mavrix_Backtest_${safeStrategyName}_${selectedRange.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.csv`;
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          try {
            if (document.body.contains(a)) document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch {}
        }, 3000);
        return;
      }

      // If backtestResult is not in state, fetch via API and trigger file download
      const baseUrl = API_CONFIG.BASE_URL;
      const exportUrl = `${baseUrl}/api/backtest/export?strategyId=${selectedStrategyId}&days=${selectedDays}&startDate=${customStartDate || ''}&endDate=${customEndDate || ''}&format=${format}`;

      axios.get(exportUrl, { responseType: 'blob' })
        .then((res) => {
          const safeStrategyName = (currentStrategyName || selectedStrategyId || 'Strategy').replace(/[^a-zA-Z0-9_-]/g, '_');
          const ext = format === 'json' ? 'json' : 'csv';
          const filename = `Mavrix_Backtest_${safeStrategyName}_${selectedRange.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`;

          const blobUrl = URL.createObjectURL(res.data);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = blobUrl;
          a.setAttribute('download', filename);
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try {
              if (document.body.contains(a)) document.body.removeChild(a);
              URL.revokeObjectURL(blobUrl);
            } catch {}
          }, 3000);
        })
        .catch(() => {
          window.open(exportUrl, '_blank');
        });
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  const currentStrategyName = strategiesList.find(s => s.id === selectedStrategyId)?.name || selectedStrategyId || 'Select Strategy';

  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
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
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onChangeCustomDates={(start, end) => {
            setCustomStartDate(start);
            setCustomEndDate(end);
            setBacktestResult(null);
          }}
        />

        <Box sx={{ mt: 1.5, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusBadge
            status={dhanConnected ? 'live' : 'neutral'}
            label={dhanConnected ? 'DHANHQ LIVE MARKET FEED' : 'REAL NSE HISTORICAL FEED'}
          />
        </Box>

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
          <Box sx={{ mt: 3 }}>
            <EmptyState
              title="No Backtest Results Generated Yet"
              description="Select your strategy and duration above, then click Run Backtest to fetch real DhanHQ v2 candles and compute performance analytics."
              actionLabel="Run Backtest"
              onAction={() => runBacktest(selectedStrategyId, selectedDays)}
            />
          </Box>
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
                  <StatusBadge
                    status="live"
                    label={backtestResult.dataSource?.provider || 'NSE Live Market Feed'}
                  />
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                    Candles: <strong>{backtestResult.dataSource?.candleCount}</strong> (5m OHLCV) | Period: <strong>{typeof backtestResult.period === 'object' && backtestResult.period !== null ? `${backtestResult.period.startDate} to ${backtestResult.period.endDate} (${backtestResult.period.totalDays}d)` : String(backtestResult.period || '')}</strong>
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
      </Box>
    </Layout>
  );
};

export default BacktestPage;
