import { Request, Response } from 'express';
import { backtestEngine } from '../backtest/BacktestEngine';

// Legacy strategy-test routes use the same historical option engine.
async function run(req: Request, res: Response) {
  try {
    const input = req.method === 'GET' ? req.query : req.body;
    if (input.historicalData) throw new Error('OPTION_CANDLES_REQUIRED: Spot-only uploads cannot backtest option trades.');
    const result = await backtestEngine.runBacktest(
      String(input.strategyId || 'nifty-atm-independent-breakout'),
      String(input.symbol || 'NIFTY 50'),
      Number(input.days || 5),
      Number(input.capital || 100000),
      (req as any).user?.uid || 'user_admin',
      input.startDate ? String(input.startDate) : undefined,
      input.endDate ? String(input.endDate) : undefined
    );
    return res.json({
      success: true,
      dataSource: result.dataSource.provider,
      results: {
        ...result.summary,
        winRate: result.summary.winRatePct,
        netProfit: result.summary.netProfit,
        trades: result.trades,
        equityCurve: result.equityCurve
      }
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'BACKTEST_FAILED' });
  }
}

export const backtestStrategy = run;
export const quickBacktest = run;

export const testSingleCandle = async (_req: Request, res: Response) => {
  res.status(410).json({ success: false, error: 'Single-candle strategy testing is unavailable; use a complete historical session.' });
};

export const validateStrategy = async (req: Request, res: Response) => {
  const config = req.body?.strategyConfig;
  const valid = config && Number.isFinite(config.breakoutPct) && config.breakoutPct > 0 &&
    Number.isFinite(config.target1Pts) && config.target1Pts > 0 &&
    Number.isFinite(config.target2Pts) && config.target2Pts > config.target1Pts;
  res.status(valid ? 200 : 400).json({ success: Boolean(valid), error: valid ? undefined : 'Invalid breakout or target configuration.' });
};
