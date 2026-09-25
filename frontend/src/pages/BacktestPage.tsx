import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
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
        const options = (data?.templates || []).map((s: any) => ({ id: s.id, name: s.name }));
        if (options.length) setStrategies(options);
      })
      .catch(() => setStrategies([{ id: 'nifty-atm-independent-breakout', name: 'NIFTY ATM CE/PE Independent 0.9% Breakout' }]));
  }, []);

  const runBacktest = async () => {
    if (!selectedStrategyId) return;
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
      setError(e.response?.data?.error || e.message || 'BACKTEST_FAILED');
    } finally {
      setLoading(false);
    }
  };

  const exportBacktest = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        strategyId: selectedStrategyId,
        symbol: 'NIFTY 50',
        days: String(selectedDays),
        capital: '100000',
        format
      });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await axios.get(
        `${API_CONFIG.BASE_URL}/api/backtest/export?${params.toString()}`,
        { responseType: 'blob' }
      );

      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Mavrix_Backtest_${selectedStrategyId}_${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'BACKTEST_EXPORT_FAILED');
    }
  };

  const strategyName =
    strategies.find((s) => s.id === selectedStrategyId)?.name ||
    'NIFTY ATM CE/PE Independent 0.9% Breakout';

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
            setResult(null);
          }}
          totalPnl={result?.summary?.netProfit ?? null}
          maxDrawdown={result?.summary?.maxDrawdown ?? null}
          equityCurve={result?.equityCurve || []}
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
          <Alert severity="error" sx={{ mt: 3 }} action={
            <Button color="inherit" size="small" onClick={() => navigate('/brokers')}>
              Brokers
            </Button>
          }>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={36} />
            <Typography variant="caption">
              Fetching official Dhan historical option data and running the backtest…
            </Typography>
          </Box>
        )}

        {!loading && !result && !error && (
          <Box sx={{ mt: 3 }}>
            <EmptyState
              title="No Backtest Results"
              description="Run the strategy to load official Dhan historical option data."
              actionLabel="Run Backtest"
              onAction={runBacktest}
            />
          </Box>
        )}

        {result?.summary && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 3 }}>
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
