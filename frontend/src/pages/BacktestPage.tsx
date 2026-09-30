import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import axios from 'axios';
import Layout from '../components/Layout';
import { API_CONFIG } from '../config/api';
import { BacktestControls } from '../components/backtest/BacktestControls';
import { BacktestSummaryCards } from '../components/backtest/BacktestSummaryCards';
import { MaxProfitLossChart } from '../components/backtest/MaxProfitLossChart';
import { DaywiseBreakdownHeatmap } from '../components/backtest/DaywiseBreakdownHeatmap';
import { TransactionDetailsAccordion } from '../components/backtest/TransactionDetailsAccordion';
import { EmptyState } from '../components/ui';

interface StrategyOption {
  id: string;
  name: string;
}

const backtestErrorMessage = (detail: string): string => {
  if (detail.includes('DHAN_AUTH_REQUIRED'))
    return 'Connect your Dhan account on the Brokers page before running a historical backtest.';
  if (detail.includes('DHAN_DATA_API_NOT_SUBSCRIBED') || detail.includes('DH-902'))
    return 'Dhan trading connection is active, but your Dhan account does not have Data API access enabled (DH-902). Activate Data APIs on web.dhan.co (My Profile → Access DhanHQ APIs), generate a fresh token, and reconnect on the Brokers page.';
  if (detail.includes('REAL_OPTIONS_BACKTEST_UNAVAILABLE'))
    return 'Historical backtesting service is unavailable. Please try again after the backend is configured.';
  if (detail.includes('DHAN_TOKEN_EXPIRED'))
    return 'Dhan session expired. Reconnect your Dhan account.';
  if (/INCOMPLETE_|UNEXECUTABLE_OPTION_CANDLE|UNVERIFIED_ATM_CONTRACT|MISSING_REFERENCE_CANDLE|NO_HISTORICAL_SPOT_DATA/.test(detail))
    return 'Historical candles are incomplete for this range. Select a standard completed trading period.';
  if (detail.includes('INVALID_DATE_RANGE'))
    return 'Choose completed trading sessions from 2026 onward, ending before today.';
  if (detail.includes('UNSUPPORTED_BACKTEST_STRATEGY'))
    return 'This backtest currently supports the NIFTY ATM CE/PE breakout only.';
  return detail.length > 0 && detail !== 'BACKTEST_FAILED' ? detail : 'Backtest could not be completed. Check date range and try again.';
};

export const BacktestPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialStrategy = searchParams.get('strategyId') || location.state?.strategyId || 'nifty-atm-independent-breakout';
  const [selectedStrategyId, setSelectedStrategyId] = useState(initialStrategy);
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [selectedRange, setSelectedRange] = useState('1 Month');
  const [selectedDays, setSelectedDays] = useState(22);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`${API_CONFIG.BASE_URL}/api/strategies/templates`)
      .then(({ data }) => {
        const options = (data?.templates || []).filter((s: any) => s.id === 'nifty-atm-independent-breakout').map((s: any) => ({ id: s.id, name: s.name }));
        setStrategies(options.length ? options : [{ id: 'nifty-atm-independent-breakout', name: 'NIFTY ATM CE/PE Independent 0.9% Breakout' }]);
      })
      .catch(() => setStrategies([{ id: 'nifty-atm-independent-breakout', name: 'NIFTY ATM CE/PE Independent 0.9% Breakout' }]));
  }, []);

  const runBacktest = async () => {
    if (!selectedStrategyId) return;
    if (selectedStrategyId !== 'nifty-atm-independent-breakout') {
      setError('Only the NIFTY ATM CE/PE breakout has a verified historical options backtest.');
      return;
    }
    if (selectedRange === 'Custom Range' && (!startDate || !endDate)) {
      setError('Select both start and end dates for a custom range.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/backtest/run`, {
        strategyId: selectedStrategyId,
        symbol: 'NIFTY 50',
        days: selectedDays,
        capital: 100000,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });

      if (!response.data?.success) throw new Error(response.data?.error || 'BACKTEST_FAILED');
      setResult(response.data.data);
    } catch (e: any) {
      setError(backtestErrorMessage(String(e.response?.data?.error || e.message || 'BACKTEST_FAILED')));
    } finally {
      setLoading(false);
    }
  };

  const exportBacktest = async (format: 'csv' | 'json') => {
    if (!result?.runId) return;
    try {
      const fields = ['id', 'date', 'instrument', 'optionType', 'strike', 'quantity',
        'signalTime', 'triggerClosePrice', 'entryTime', 'entryPrice', 'exitTime',
        'exitPrice', 'exitReason', 'grossPnl', 'totalCharges', 'netPnl',
        'cumulativeEquity', 'drawdown'];
      const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csv = [
        `Data source,${quote(result.dataSource?.provider)}`,
        `Period,${quote(`${result.period?.startDate} to ${result.period?.endDate}`)}`,
        fields.join(','),
        ...(result.trades || []).map((trade: any) => fields.map(field => quote(trade[field])).join(','))
      ].join('\n');
      const blob = new Blob([format === 'json' ? JSON.stringify(result, null, 2) : '\uFEFF' + csv],
        { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Mavrix_Backtest_${result.runId}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'BACKTEST_EXPORT_FAILED');
    }
  };

  const strategyName =
    strategies.find((s) => s.id === selectedStrategyId)?.name ||
    (selectedStrategyId === 'nifty-atm-independent-breakout'
      ? 'NIFTY ATM CE/PE Independent 0.9% Breakout'
      : 'Unsupported strategy');

  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        <BacktestControls
          strategyName={strategyName}
          strategiesList={strategies}
          selectedStrategyId={selectedStrategyId}
          onSelectStrategy={(id) => {
            setSelectedStrategyId(id);
            setResult(null);
          }}
          selectedRange={selectedRange}
          onSelectRange={(range, days) => {
            setSelectedRange(range);
            setSelectedDays(days);
            if (range !== 'Custom Range') {
              setStartDate('');
              setEndDate('');
            }
            setResult(null);
          }}
          totalPnl={result?.summary?.netProfit ?? null}
          maxDrawdown={result?.summary?.maxDrawdown ?? null}
          equityCurve={result?.equityCurve || []}
          initialCapital={result?.initialCapital ?? 100000}
          loading={loading}
          onRunBacktest={runBacktest}
          onExportTrades={exportBacktest}
          onBack={() => navigate('/strategies')}
          customStartDate={startDate}
          customEndDate={endDate}
          onChangeCustomDates={(start, end) => {
            setStartDate(start);
            setEndDate(end);
            setResult(null);
          }}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={36} />
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Fetching market data and running backtest simulation…
            </Typography>
          </Box>
        )}

        {!loading && !result && !error && (
          <Box sx={{ mt: 3 }}>
            <EmptyState
              title="No Backtest Results"
              description="Select your date range and click Run Backtest to simulate strategy performance."
              actionLabel="Run Backtest"
              onAction={runBacktest}
            />
          </Box>
        )}

        {result?.summary && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 3 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                  Data Feed:
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  {result.dataSource?.provider}
                </Typography>
                {result.dataSource?.isFreeTier && (
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.25,
                      bgcolor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: 0.5,
                      color: '#16a34a',
                      fontWeight: 600
                    }}
                  >
                    100% Free · 0 INR Subscription
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {result.period?.startDate} to {result.period?.endDate}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Completed 5m signals · modeled 1m OHLC fills · estimated charges · closed-trade drawdown · spread and market impact excluded
              </Typography>
            </Box>

            <BacktestSummaryCards summary={result.summary} />
            <MaxProfitLossChart
              dailyBars={result.dailyPnlBars || []}
              avgProfit={result.summary.avgProfitPerDay}
              avgLoss={result.summary.avgLossPerDay}
            />
            <DaywiseBreakdownHeatmap monthlyBreakdown={result.monthlyBreakdown || []} />
            <TransactionDetailsAccordion daywiseTransactions={result.daywiseTransactions || []} />
          </Box>
        )}
      </Box>
    </Layout>
  );
};

export default BacktestPage;
