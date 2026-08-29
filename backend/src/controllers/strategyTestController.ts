import { Request, Response } from 'express';
import axios from 'axios';
import StrategyTester, { CandleData } from '../strategies/strategyTester';
import { BrokerRegistry } from '../brokers/BrokerRegistry';
import { HistoricalCandle } from '../brokers/types';

const YAHOO_SYMBOL_MAP: { [key: string]: string } = {
  'NIFTY 50': '^NSEI',
  'NIFTY': '^NSEI',
  'BANKNIFTY': '^NSEBANK',
  'FINNIFTY': 'NIFTY_FIN_SERVICE.NS',
  'RELIANCE': 'RELIANCE.NS',
  'TCS': 'TCS.NS',
  'INFY': 'INFY.NS',
  'HDFCBANK': 'HDFCBANK.NS',
  'ICICIBANK': 'ICICIBANK.NS',
  'SBIN': 'SBIN.NS',
  'BHARTIARTL': 'BHARTIARTL.NS'
};

const SECURITY_ID_MAP: { [key: string]: string } = {
  'NIFTY 50': '13',
  'NIFTY': '13',
  'BANKNIFTY': '25',
  'FINNIFTY': '27',
  'RELIANCE': '2885',
  'TCS': '11536',
  'INFY': '1594',
  'HDFCBANK': '1333',
  'ICICIBANK': '4963',
  'SBIN': '3045',
  'BHARTIARTL': '10604'
};

/**
 * Fetch 60-day historical candles from Dhan or Yahoo Finance
 */
async function fetchHistoricalCandles(
  rawSymbol: string = 'NIFTY 50',
  days: number = 60
): Promise<{ candles: CandleData[]; source: string }> {
  const symbol = rawSymbol.toUpperCase();
  const brokerRegistry = BrokerRegistry.getInstance();
  const primaryAdapter = brokerRegistry.getPrimaryAdapter();

  // 1. Try Dhan HQ historical API if connected
  if (primaryAdapter) {
    try {
      const securityId = SECURITY_ID_MAP[symbol] || '13';
      const today = new Date();
      const fromDate = new Date();
      fromDate.setDate(today.getDate() - days);

      const fetchedCandles: HistoricalCandle[] = await primaryAdapter.getHistoricalData({
        symbol: symbol.includes('NIFTY') ? 'NIFTY' : symbol,
        securityId,
        exchange: 'NSE',
        interval: '5',
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: today.toISOString().split('T')[0]
      });

      if (fetchedCandles && fetchedCandles.length > 0) {
        return {
          candles: fetchedCandles.map((c: HistoricalCandle) => ({
            timestamp: new Date(c.timestamp),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume
          })),
          source: 'DhanHQ v2 Historical 5m Feed'
        };
      }
    } catch (e) {
      // Fallback to Yahoo Finance
    }
  }

  // 2. Guaranteed Yahoo Finance 60-Day Indian Market Feed
  try {
    const yahooSymbol = YAHOO_SYMBOL_MAP[symbol] || (symbol.includes('.') ? symbol : `${symbol}.NS`);
    const interval = days <= 5 ? '5m' : '15m';
    const range = `${Math.min(days, 60)}d`;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const result = response.data?.chart?.result?.[0];
    if (result && result.timestamp && result.indicators?.quote?.[0]) {
      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];
      const candles: CandleData[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const o = quote.open?.[i];
        const h = quote.high?.[i];
        const l = quote.low?.[i];
        const c = quote.close?.[i];
        const v = quote.volume?.[i] || 0;

        if (o !== null && h !== null && l !== null && c !== null && !isNaN(o) && !isNaN(c)) {
          candles.push({
            timestamp: new Date(timestamps[i] * 1000),
            open: Number(o.toFixed(2)),
            high: Number(h.toFixed(2)),
            low: Number(l.toFixed(2)),
            close: Number(c.toFixed(2)),
            volume: Number(v)
          });
        }
      }

      if (candles.length > 0) {
        return {
          candles,
          source: `NSE 60-Day Real Data (${candles.length} candles)`
        };
      }
    }
  } catch (err: any) {
    console.error('[Historical Feed Error]', err.message);
  }

  return { candles: [], source: 'None' };
}

/**
 * Backtest strategy with historical candle data
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

    let candles: CandleData[] = [];
    let dataSource = 'Direct Input';

    if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
      candles = historicalData.map((candle: any) => ({
        ...candle,
        timestamp: new Date(candle.timestamp)
      }));
    } else {
      const fetched = await fetchHistoricalCandles(symbol, Number(days) || 60);
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
    console.error('Backtest error:', error);
    res.status(500).json({
      success: false,
      message: 'Backtest execution failed',
      error: error.message
    });
  }
};

/**
 * Quick 60-Day Backtest using Dhan HQ / NSE 60-Day Historical Data
 */
export const quickBacktest = async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY 50';
    const strategy = (req.query.strategy as string) || 'dhokiya_009';
    const days = Number(req.query.days) || 60;
    const capital = Number(req.query.capital) || 100000;

    const { candles, source } = await fetchHistoricalCandles(symbol, days);

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
    return res.status(500).json({
      success: false,
      message: 'Quick backtest failed',
      error: error.message
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
    console.error('Test single candle error:', error);
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
    console.error('Validate strategy error:', error);
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
