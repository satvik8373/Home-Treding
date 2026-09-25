import express, { Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { backtestEngine } from '../backtest/BacktestEngine';

const router = express.Router();
let backtestCreditsRemaining = 49;
const totalCredits = 50;

/**
 * Format CSV rows into a standardized institutional trade audit file
 */
export function buildBacktestCsv(result: any): string {
  const s = result.summary || {};
  const p = result.period || {};
  const exportTimeIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

  const metadataHeader = [
    '# =========================================================================================',
    '# MAVRIX TRADING PLATFORM - INSTITUTIONAL STRATEGY BACKTEST AUDIT REPORT',
    `# Strategy: ${(result.strategyName || result.strategyId || '').toUpperCase()} | Underlying: ${result.symbol} (NSE)`,
    `# Period: ${p.startDate || ''} to ${p.endDate || ''} (${p.totalDays || 0} Trading Days) | Resolution: 5m Candle`,
    `# Initial Capital: INR ${Number(s.initialCapital || 100000).toLocaleString('en-IN')} | Realized Net P&L: INR ${Number(s.netProfit || 0).toLocaleString('en-IN')}`,
    `# Total Trades: ${s.totalTrades || 0} | Win Rate: ${s.winRatePct || s.winTradesPercent || 0}% | Profit Factor: ${s.profitFactor || 0}`,
    `# Max Drawdown: INR ${Number(s.maxDrawdownFromPeak || 0).toLocaleString('en-IN')} (${s.maxDrawdownPct || 0}%) | Final Equity: INR ${Number(s.finalBalance || 100000).toLocaleString('en-IN')}`,
    `# Execution Model: DhanHQ / Real NSE Market Bar-by-Bar Fill | Export Generated: ${exportTimeIST} IST`,
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

  const trades = result.trades || (result.daywiseTransactions ? result.daywiseTransactions.flatMap((d: any) => d.trades) : []);

  const rows = trades.map((t: any) => [
    t.id,
    t.date,
    t.dayOfWeek || '',
    `"${t.strategyName || result.strategyName || result.strategyId || ''}"`,
    `"${t.symbol || result.symbol || ''}"`,
    `"${t.instrument || ''}"`,
    t.strike,
    t.optionType,
    t.side || t.type,
    t.orderType || 'MARKET',
    t.quantity,
    t.lotSize || 65,
    t.spotRefPrice || '',
    t.breakoutLevel || '',
    t.entryTime,
    t.entryTimestamp || '',
    t.entryPrice,
    t.exitTime,
    t.exitTimestamp || '',
    t.exitPrice,
    `"${t.exitReason || t.reason || ''}"`,
    t.durationMinutes || 0,
    t.grossPnl,
    t.brokerage || 0,
    t.stt || 0,
    t.exchangeCharges || 0,
    t.gst || 0,
    t.sebiCharges || 0,
    t.stampDuty || 0,
    t.totalCharges || t.charges || 0,
    t.netPnl,
    t.roiPct || 0,
    t.cumulativeEquity || 0,
    t.drawdown || 0,
    t.status,
    `"${t.fillModel || '5m Candle Breakout Execution'}"`,
    `"${t.dataSource || 'Real NSE Market Feed'}"`
  ].join(','));

  return `${metadataHeader}\n${headers.join(',')}\n${rows.join('\n')}`;
}

/**
 * POST /api/backtest/run
 */
router.post('/run', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      strategyId = 'nifty-009-atm-breakout',
      symbol = 'NIFTY 50',
      days = 22,
      capital = 100000,
      startDate,
      endDate
    } = req.body || {};

    if (backtestCreditsRemaining > 0) {
      backtestCreditsRemaining -= 1;
    }

    const userId = (req as any).user?.userId || (req as any).user?.uid;
    logger.info(`[BacktestRoutes] Running real backtest: strategy=${strategyId} symbol=${symbol} days=${days} range=${startDate || 'auto'}-${endDate || 'auto'} user=${userId || 'anonymous'}`);

    const result = await backtestEngine.runBacktest(strategyId, symbol, Number(days) || 22, Number(capital) || 100000, userId, startDate, endDate);

    return res.json({
      success: true,
      creditsRemaining: backtestCreditsRemaining,
      totalCredits,
      data: result
    });
  } catch (err: any) {
    logger.error('Backtest error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET & POST /api/backtest/export
 * Downloads professional institutional CSV or JSON audit report
 */
const handleExport = async (req: Request, res: Response) => {
  try {
    const strategyId = (req.query.strategyId || req.body?.strategyId || 'nifty-009-atm-breakout') as string;
    const symbol = (req.query.symbol || req.body?.symbol || 'NIFTY 50') as string;
    const days = Number(req.query.days || req.body?.days) || 22;
    const format = (req.query.format || req.body?.format || 'csv') as string;
    const startDate = (req.query.startDate || req.body?.startDate) as string | undefined;
    const endDate = (req.query.endDate || req.body?.endDate) as string | undefined;
    const userId = (req as any).user?.userId || (req as any).user?.uid;

    const result = await backtestEngine.runBacktest(strategyId, symbol, days, 100000, userId, startDate, endDate);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=backtest_${result.runId}.json`);
      return res.send(JSON.stringify(result, null, 2));
    }

    const safeStrategyId = (strategyId || 'nifty009').replace(/[^a-zA-Z0-9_-]/g, '_');
    const totalDays = result.period?.totalDays || days;
    const filename = `Mavrix_Backtest_${safeStrategyId}_${totalDays}D_${Date.now()}.csv`;

    const csvContent = buildBacktestCsv(result);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.send('\uFEFF' + csvContent);
  } catch (err: any) {
    logger.error('Export error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/export', optionalAuth, handleExport);
router.post('/export', optionalAuth, handleExport);

export default router;