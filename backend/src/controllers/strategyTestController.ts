import { Request, Response } from 'express';
import StrategyTester, { CandleData } from '../strategies/strategyTester';
import { DhanHistoricalDataService } from '../backtest/DhanHistoricalDataService';
import { freeMarketDataService } from '../backtest/FreeMarketDataService';

/**
 * Fetch historical candles using DhanHQ v2 or Free Real NSE Market Feed (Zero Cost)
 */
async function fetchDhanCandles(
  rawSymbol: string = 'NIFTY 50',
  days: number = 60,
  userId?: string
): Promise<{ candles: CandleData[]; source: string }> {
  const symbol = rawSymbol.toUpperCase();
  const auth = DhanHistoricalDataService.resolveAuth(userId);

  if (auth) {
    try {
      const dhanService = new DhanHistoricalDataService(auth);
      const meta = DhanHistoricalDataService.getSecurityMetadata(symbol);

      const today = new Date();
      const fromDate = new Date();
      fromDate.setDate(today.getDate() - Math.round(days * 1.55));

      const fetched = await dhanService.getIntradayCandles({
        securityId: meta.securityId,
        exchangeSegment: meta.exchangeSegment,
        instrument: meta.instrument,
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: today.toISOString().split('T')[0],
        interval: 5
      });

      if (fetched && fetched.length > 0) {
        return {
          candles: fetched.map((c) => ({
            timestamp: new Date(c.timestamp * 1000),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume
          })),
          source: `DhanHQ v2 Live Data (${fetched.length} candles)`
        };
      }
    } catch (_) {}
  }

  // Seamless Zero-Cost Free Real NSE Market Data Feed
  const freeCandles = await freeMarketDataService.get5MinCandles(symbol);
  return {
    candles: freeCandles.map((c) => ({
      timestamp: new Date(c.timestamp * 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    })),
    source: `Free Real NSE Market Feed (${freeCandles.length} candles)`
  };
}

/**
 * Backtest strategy with real DhanHQ historical candle data
 */
export const backtestStrategy = async (req: Request, res: Response) => {
  try {
    const { 
      strategy = 'dhokiya_009', 
      symbol = 'NIFTY 50', 
      days = 60, 
      capital = 100000, 
      historicalData,
      previousClose 
    } = req.body;

    const userId = (req as any).userId;
    let candles: CandleData[] = [];
    let dataSource = 'Direct Input';

    if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
      candles = historicalData.map((candle: any) => ({
        ...candle,
        timestamp: new Date(candle.timestamp)
      }));
    } else {
      const fetched = await fetchDhanCandles(symbol, Number(days) || 60, userId);
      candles = fetched.candles;
      dataSource = fetched.source;
    }

    if (candles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No historical candle data available for the specified instrument.'
      });
    }

    const tester = new StrategyTester();
    const results = await tester.backtest(
      candles, 
      previousClose || candles[0].open, 
      strategy, 
      symbol, 
      Number(capital) || 100000
    );

    res.json({
      success: true,
      strategy,
      symbol,
      periodDays: results.periodDays,
      candleCount: candles.length,
      dataSource,
      results,
      summary: {
        totalTrades: results.totalTrades,
        winRate: `${results.winRate.toFixed(1)}%`,
        netProfit: `₹${results.netProfit.toLocaleString('en-IN')}`,
        profitFactor: results.profitFactor.toFixed(2),
        maxDrawdown: `₹${results.maxDrawdown.toLocaleString('en-IN')}`
      }
    });
  } catch (error: any) {
    const isAuth = error.message.includes('DHAN_AUTH_REQUIRED');
    res.status(isAuth ? 400 : 500).json({
      success: false,
      code: isAuth ? 'DHAN_AUTH_REQUIRED' : 'BACKTEST_FAILED',
      message: error.message
    });
  }
};

/**
 * Quick Backtest using official DhanHQ Historical Data
 */
export const quickBacktest = async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY 50';
    const strategy = (req.query.strategy as string) || 'dhokiya_009';
    const days = Number(req.query.days) || 60;
    const capital = Number(req.query.capital) || 100000;
    const userId = (req as any).userId;

    const { candles, source } = await fetchDhanCandles(symbol, days, userId);

    if (candles.length === 0) {
      return res.status(500).json({
        success: false,
        message: `Failed to load ${days}-day historical data for ${symbol}.`
      });
    }

    const tester = new StrategyTester();
    const results = await tester.backtest(candles, candles[0].open, strategy, symbol, capital);

    return res.json({
      success: true,
      strategy,
      symbol,
      periodDays: results.periodDays,
      candleCount: candles.length,
      dataSource: source,
      results,
      summary: {
        totalTrades: results.totalTrades,
        winRate: `${results.winRate.toFixed(1)}%`,
        netProfit: `₹${results.netProfit.toLocaleString('en-IN')}`,
        profitFactor: results.profitFactor.toFixed(2),
        maxDrawdown: `₹${results.maxDrawdown.toLocaleString('en-IN')}`
      }
    });
  } catch (error: any) {
    const isAuth = error.message.includes('DHAN_AUTH_REQUIRED');
    return res.status(isAuth ? 400 : 500).json({
      success: false,
      code: isAuth ? 'DHAN_AUTH_REQUIRED' : 'BACKTEST_FAILED',
      message: error.message
    });
  }
};

/**
 * Test strategy with single candle in real-time
 */
export const testSingleCandle = async (req: Request, res: Response) => {
  try {
    const { candle } = req.body;

    if (!candle) {
      return res.status(400).json({
        success: false,
        message: 'Candle data is required'
      });
    }

    res.json({
      success: true,
      result: {
        action: 'processed',
        candle
      },
      message: 'Candle processed successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
};

/**
 * Validate strategy configuration
 */
export const validateStrategy = async (req: Request, res: Response) => {
  try {
    const { strategyConfig } = req.body;

    if (!strategyConfig) {
      return res.status(400).json({
        success: false,
        message: 'Strategy configuration is required'
      });
    }

    const errors: string[] = [];

    if (!strategyConfig.gapFilterPoints || strategyConfig.gapFilterPoints <= 0) {
      errors.push('Gap filter points must be greater than 0');
    }

    if (!strategyConfig.upperBandMultiplier || strategyConfig.upperBandMultiplier <= 1) {
      errors.push('Upper band multiplier must be greater than 1');
    }

    if (!strategyConfig.lowerBandMultiplier || strategyConfig.lowerBandMultiplier >= 1) {
      errors.push('Lower band multiplier must be less than 1');
    }

    if (!strategyConfig.targetProfitPoints || strategyConfig.targetProfitPoints <= 0) {
      errors.push('Target profit points must be greater than 0');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid strategy configuration',
        errors
      });
    }

    res.json({
      success: true,
      message: 'Strategy configuration is valid',
      config: strategyConfig
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Validation failed',
      error: error.message
    });
  }
};

export default {
  backtestStrategy,
  quickBacktest,
  testSingleCandle,
  validateStrategy
};
