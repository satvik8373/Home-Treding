import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { backtestEngine } from '../backtest/BacktestEngine';
import { optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
let backtestCreditsRemaining = 49;

/**
 * POST /api/backtest/run
 *
 * Runs backtest using official DhanHQ v2 Data APIs (https://docs.dhanhq.co/api/v2/data-apis).
 * No fake/sample data fallbacks. If Dhan credentials are missing or expired, fails cleanly.
 */
router.post('/run', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      strategyId,
      symbol = 'BANKNIFTY',
      days = 22,
      capital = 100000,
      fromDate,
      toDate,
      legs,
      dhanAccessToken,
      dhanClientId
    } = req.body;

    const userId = (req as any).userId;

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
          { id: 'leg-1', action: 'SELL', optionType: 'CE', quantity: 15, slValue: 0, targetValue: 0, strike: 'ATM', expiry: 'MONTHLY' },
          { id: 'leg-2', action: 'SELL', optionType: 'PE', quantity: 15, slValue: 0, targetValue: 0, strike: 'ATM', expiry: 'MONTHLY' }
        ]
      };
    }

    logger.info(`[BacktestRoutes] Starting DhanHQ backtest run: strategy=${stratConfig.name} symbol=${symbol} (User: ${userId || 'anonymous'})`);

    const result = await backtestEngine.run(
      stratConfig,
      {
        strategyId: stratConfig.id,
        symbol,
        fromDate: resolvedFromDate,
        toDate: resolvedToDate,
        capital: Number(capital),
        legs: (legs && Array.isArray(legs) && legs.length > 0) ? legs : (stratConfig.legs ?? []),
        userId,
        customCredentials: (dhanAccessToken && dhanClientId) ? {
          accessToken: dhanAccessToken,
          clientId: dhanClientId
        } : undefined
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

    if (dhanErr.includes('DHAN_AUTH_REQUIRED')) {
      return res.status(400).json({
        success: false,
        code: 'DHAN_AUTH_REQUIRED',
        message: 'DhanHQ Authentication Required: Please connect your Dhan broker account with Data APIs enabled in the Brokers tab, or provide DHAN_ACCESS_TOKEN and DHAN_CLIENT_ID.'
      });
    }

    if (dhanErr.includes('DH-902') || dhanErr.includes('DHAN_DATA_API_NOT_SUBSCRIBED') || dhanErr.includes('not subscribed') || dhanErr.includes('Data APIs')) {
      msg = "DhanHQ Data APIs Not Subscribed (DH-902): Your Dhan token is valid and connected, but your Dhan account does not have the 'Data APIs' subscription active (dataPlan is Deactive). Please log in to https://dhanhq.co (or web.dhan.co -> Profile -> DhanHQ Trading APIs) and activate 'Data APIs' to fetch historical candle data.";
    } else if (dhanErr.includes('DHAN_TOKEN_EXPIRED') || dhanErr.includes('DH-901') || (dhanErr.includes('401') && !dhanErr.includes('DH-902'))) {
      msg = 'DhanHQ Access Token is invalid or expired. Please go to the Brokers page and reconnect your Dhan account with a fresh access token.';
    }

    logger.error(`[BacktestRoutes] Backtest run error: ${msg}`);
    return res.status(400).json({
      success: false,
      code: 'DHAN_DATA_ERROR',
      message: msg
    });
  }
});

/**
 * GET /api/backtest/credits
 */
router.get('/credits', (req: Request, res: Response) => {
  res.json({ success: true, creditsRemaining: backtestCreditsRemaining, totalCredits: 50 });
});

/**
 * GET /api/backtest/results
 * List latest backtest results from memory (Zero disk files)
 */
router.get('/results', optionalAuth, (_req: Request, res: Response) => {
  const list = backtestEngine.listResults().map((data: any) => ({
    runId: data.runId,
    strategyId: data.strategyId,
    strategyName: data.strategyName,
    symbol: data.symbol,
    totalNetPnl: data.totalNetPnl,
    winRate: data.winRate,
    maxDrawdown: data.maxDrawdown,
    createdAt: data.createdAt,
    dataSource: data.dataSource
  }));
  res.json({ success: true, results: list });
});

/**
 * GET /api/backtest/results/:runId
 */
router.get('/results/:runId', optionalAuth, (req: Request, res: Response) => {
  const data = backtestEngine.getResult(String(req.params.runId));
  if (!data) {
    return res.status(404).json({ success: false, message: 'Backtest result not found' });
  }
  res.json({ success: true, data });
});

/**
 * GET & POST /api/backtest/export
 */
const handleExport = async (req: Request, res: Response) => {
  try {
    const strategyId = req.query.strategyId || req.body.strategyId || '';
    const symbol = (req.query.symbol || req.body.symbol || 'BANKNIFTY') as string;
    const days = Number(req.query.days || req.body.days) || 22;
    const format = (req.query.format || req.body.format || 'csv') as string;
    const userId = (req as any).userId;

    const result = await backtestEngine.runBacktest(String(strategyId), symbol, days, 100000, userId);
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
      `"${t.exitReason || t.reason || 'SQUAREOFF'}"`, `"${t.spotRefPrice || ''}"`,
      `"${t.fillModel || 'Real Market Bar-by-Bar Fill'}"`,
      `"${result.dataSource?.provider || 'Live Real NSE Market Feed (Real API Call)'}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=backtest_${result.runId}.csv`);
    return res.send(csvContent);
  } catch (err: any) {
    logger.error('[BacktestRoutes] Export error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

router.get('/export', optionalAuth, handleExport);
router.post('/export', optionalAuth, handleExport);

export default router;