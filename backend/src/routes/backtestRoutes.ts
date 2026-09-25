import express, { Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { backtestEngine } from '../backtest/BacktestEngine';

const router = express.Router();

router.post('/run', optionalAuth, async (req: Request, res: Response) => {
  try {
    const strategyId = String(req.body?.strategyId || 'nifty-atm-independent-breakout');
    const symbol = String(req.body?.symbol || 'NIFTY 50');
    const days = Number(req.body?.days || 22);
    const capital = Number(req.body?.capital || 100000);
    const startDate = req.body?.startDate as string | undefined;
    const endDate = req.body?.endDate as string | undefined;
    const userId = (req as any).user?.userId || (req as any).user?.uid;

    const data = await backtestEngine.runBacktest(
      strategyId,
      symbol,
      days,
      capital,
      userId,
      startDate,
      endDate
    );

    res.json({ success: true, data });
  } catch (error: any) {
    logger.error(`Backtest failed: ${error?.message || error}`);
    res.status(400).json({
      success: false,
      error: error?.message || 'BACKTEST_FAILED'
    });
  }
});

router.get('/export', optionalAuth, exportBacktest);
router.post('/export', optionalAuth, exportBacktest);

async function exportBacktest(req: Request, res: Response) {
  try {
    const source = req.method === 'GET' ? req.query : req.body;
    const strategyId = String(source.strategyId || 'nifty-atm-independent-breakout');
    const symbol = String(source.symbol || 'NIFTY 50');
    const days = Number(source.days || 22);
    const capital = Number(source.capital || 100000);
    const format = String(source.format || 'csv').toLowerCase();
    const startDate = source.startDate ? String(source.startDate) : undefined;
    const endDate = source.endDate ? String(source.endDate) : undefined;
    const userId = (req as any).user?.userId || (req as any).user?.uid;

    const result = await backtestEngine.runBacktest(
      strategyId,
      symbol,
      days,
      capital,
      userId,
      startDate,
      endDate
    );

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="backtest_${result.runId}.json"`);
      return res.send(JSON.stringify(result, null, 2));
    }

    const headers = [
      'Trade ID','Date','Strategy','Instrument','Strike','Option Type','Quantity',
      'Reference','Upper Level','Lower Level','Entry Time','Entry Price',
      'T1 Price','T1 Qty','T1 Time','T1 PnL','T2 Price','T2 Qty','T2 Time','T2 PnL',
      'Lower Exit Price','Lower Exit Qty','Lower Exit Time','Lower Exit PnL',
      'EOD Exit Price','EOD Exit Qty','EOD Exit Time','EOD Exit PnL',
      'Exit Price','Exit Time','Exit Reason','Gross PnL','Total Charges','Net PnL',
      'Equity','Drawdown','Status','Execution Ambiguity'
    ];

    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = result.trades.map((t: any) => [
      t.id,t.date,t.strategyName,t.instrument,t.strike,t.optionType,t.quantity,
      t.signalRefPrice,t.upperBreakoutLevel,t.lowerExitLevel,t.entryTime,t.entryPrice,
      t.target1Price,t.target1Qty,t.target1Time,t.target1Pnl,
      t.target2Price,t.target2Qty,t.target2Time,t.target2Pnl,
      t.lowerExitPrice,t.lowerExitQty,t.lowerExitTime,t.lowerExitPnl,
      t.eodExitPrice,t.eodExitQty,t.eodExitTime,t.eodExitPnl,
      t.exitPrice,t.exitTime,t.exitReason,t.grossPnl,t.totalCharges,t.netPnl,
      t.cumulativeEquity,t.drawdown,t.status,t.executionAmbiguity
    ].map(escape).join(','));

    const metadata = [
      'MAVRIX TRADING - BACKTEST REPORT',
      `Strategy,${escape(result.strategyName)}`,
      `Data Source,${escape(result.dataSource.provider)}`,
      `Signal Resolution,${escape(result.dataQuality.signalResolution)}`,
      `Execution Resolution,${escape(result.dataQuality.executionResolution)}`,
      `Synthetic Prices,${result.dataQuality.syntheticPrices ? 'YES' : 'NO'}`,
      `Period,${escape(result.period.startDate + ' to ' + result.period.endDate)}`,
      ''
    ].join('\n');

    const csv = '\uFEFF' + metadata + headers.join(',') + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Mavrix_Backtest_${result.runId}.csv"`);
    return res.send(csv);
  } catch (error: any) {
    logger.error(`Backtest export failed: ${error?.message || error}`);
    res.status(400).json({
      success: false,
      error: error?.message || 'BACKTEST_EXPORT_FAILED'
    });
  }
}

export default router;
