import express, { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { backtestEngine } from '../backtest/BacktestEngine';
import { logger } from '../utils/logger';

const router = express.Router();
let backtestCreditsRemaining = 49;

/**
 * POST /api/backtest/run
 *
 * Every POST creates a completely fresh run:
 *   NEW REQUEST → NEW Dhan API fetch → NEW calculation → NEW runId → NEW JSON
 *
 * No previous result is ever read as a data source.
 * If Dhan data is unavailable, returns 500 with FRESH_DHAN_DATA_UNAVAILABLE.
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      strategyId,
      symbol = 'BANKNIFTY',
      days = 22,
      capital = 100000,
      fromDate,
      toDate,
      legs
    } = req.body;

    // Resolve date range
    const resolvedToDate: string = toDate ?? new Date().toISOString().split('T')[0];
    let resolvedFromDate: string;
    if (fromDate) {
      resolvedFromDate = fromDate;
    } else {
      const d = new Date();
      const calDays = Math.round(Number(days) * 1.55);
      d.setDate(d.getDate() - calDays);
      resolvedFromDate = d.toISOString().split('T')[0];
    }

    // Credit tracking
    if (backtestCreditsRemaining > 0) backtestCreditsRemaining -= 1;

    // Build strategy config from request or strategies.json
    let stratConfig: any = null;
    const strategiesFile = path.join(__dirname, '../../data/strategies.json');
    if (strategyId && fs.existsSync(strategiesFile)) {
      try {
        const strategies = JSON.parse(fs.readFileSync(strategiesFile, 'utf8'));
        const found = strategies.find((s: any) => s.id === strategyId || s.name === strategyId);
        if (found) stratConfig = found;
      } catch (_) {}
    }

    // If no strategy found, build from request body legs
    if (!stratConfig) {
      stratConfig = {
        id: strategyId ?? `run-${Date.now()}`,
        name: strategyId ?? 'Custom Strategy',
        symbol,
        startTime: req.body.startTime ?? '09:16',
        endTime: req.body.endTime ?? req.body.squareOff ?? '15:10',
        legs: legs ?? [
          { id: 'leg-1', action: 'SELL', optionType: 'CE', quantity: 0, slValue: 0, targetValue: 0, strike: 'ATM', expiry: 'MONTHLY' },
          { id: 'leg-2', action: 'SELL', optionType: 'PE', quantity: 0, slValue: 0, targetValue: 0, strike: 'ATM', expiry: 'MONTHLY' }
        ]
      };
    }

    logger.info(`[BacktestRoutes] Starting backtest run: strategy=${stratConfig.name} symbol=${symbol} ${resolvedFromDate}→${resolvedToDate}`);

    const result = await backtestEngine.run(
      stratConfig,
      {
        strategyId: stratConfig.id,
        symbol,
        fromDate: resolvedFromDate,
        toDate: resolvedToDate,
        capital: Number(capital),
        legs: (legs && Array.isArray(legs) && legs.length > 0) ? legs : (stratConfig.legs ?? [])
      }
    );

    return res.json({
      success: true,
      data: result,
      creditsRemaining: backtestCreditsRemaining,
      totalCredits: 50
    });

  } catch (error: any) {
    const dhanErr = error?.response?.data?.errorMessage
      || error?.response?.data?.data?.['806']
      || error?.response?.data?.message
      || error?.message
      || String(error);

    let msg = dhanErr;

    if (dhanErr.includes('DH-902') || dhanErr.includes('Data APIs') || dhanErr.includes('806')) {
      msg = "DhanHQ Data APIs Not Subscribed (Error DH-902): Your Dhan account is connected for Orders & Funds, but historical candle data requires the 'Data APIs' subscription enabled in your Dhan Developer Portal (https://dhanhq.co/).";
    } else if (dhanErr.includes('401') || dhanErr.includes('Invalid_Authentication') || dhanErr.includes('DH-901')) {
      msg = 'DhanHQ Access Token is invalid or expired (HTTP 401). Please go to the Brokers page and connect with a fresh Dhan access token.';
    }

    logger.error(`[BacktestRoutes] Backtest run error: ${msg}`);
    const code = 'FRESH_DHAN_DATA_UNAVAILABLE';
    return res.status(400).json({
      success: false,
      message: msg,
      error: { code, message: msg }
    });
  }
});

/**
 * GET /api/backtest/credits
 */
router.get('/credits', (_req: Request, res: Response) => {
  res.json({ success: true, creditsRemaining: backtestCreditsRemaining, totalCredits: 50 });
});

/**
 * GET /api/backtest/results
 * List all saved result JSON files from data/backtest-results/
 */
router.get('/results', (_req: Request, res: Response) => {
  try {
    const resultsDir = path.join(__dirname, '../../data/backtest-results');
    if (!fs.existsSync(resultsDir)) return res.json({ success: true, data: [] });
    const files = fs
      .readdirSync(resultsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    return res.json({ success: true, data: files });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backtest/results/:runId
 * Retrieve a specific saved backtest result by runId.
 */
router.get('/results/:runId', (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const filePath = path.join(__dirname, '../../data/backtest-results', `${runId}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET & POST /api/backtest/export
 * Download trades as CSV or JSON from last backtest result file.
 */
const handleExport = async (req: Request, res: Response) => {
  try {
    const strategyId = req.query.strategyId || req.body.strategyId || '';
    const symbol = (req.query.symbol || req.body.symbol || 'BANKNIFTY') as string;
    const days = Number(req.query.days || req.body.days) || 22;
    const format = (req.query.format || req.body.format || 'csv') as string;

    const result = await backtestEngine.runBacktest(String(strategyId), symbol, days);
    const trades = result.daywiseTransactions.flatMap((d: any) => d.trades);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=backtest_${result.runId}.json`);
      return res.send(JSON.stringify(result, null, 2));
    }

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
      t.entryPrice, t.exitPrice, t.grossPnl, t.brokerage ?? 40, t.stt ?? 0,
      t.exchangeCharges ?? 0, t.gst ?? 0, t.sebiCharges ?? 0, t.stampDuty ?? 0,
      t.slippage ?? 0, t.totalCharges ?? 40, t.netPnl, t.status,
      `"${t.exitReason}"`, t.spotRefPrice || '',
      `"${t.fillModel || 'Dhan /charts/rollingoption real OHLC'}"`,
      '"DhanHQ v2 — syntheticData:false"'
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=backtest_${result.runId}.csv`);
    return res.send(csvContent);
  } catch (err: any) {
    logger.error('[BacktestRoutes] Export error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/export', handleExport);
router.post('/export', handleExport);

export default router;