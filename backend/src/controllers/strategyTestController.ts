/**
 * Strategy Testing API Controller
 * Provides endpoints for backtesting and paper trading
 */

import { Request, Response } from 'express';
import StrategyTester from '../strategies/strategyTester';
import { FirstCandleBreakout009Strategy } from '../strategies/firstCandleBreakout009';

interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Backtest strategy with historical data
 */
export const backtestStrategy = async (req: Request, res: Response) => {
  try {
    const { historicalData, previousClose, strategyType } = req.body;

    if (!historicalData || !previousClose) {
      return res.status(400).json({
        success: false,
        message: 'Historical data and previous close are required'
      });
    }

    // Convert timestamp strings to Date objects
    const candles: CandleData[] = historicalData.map((candle: any) => ({
      ...candle,
      timestamp: new Date(candle.timestamp)
    }));

    const tester = new StrategyTester();
    const results = await tester.backtest(candles, previousClose);

    res.json({
      success: true,
      results
    });
  } catch (error: any) {
    console.error('Backtest error:', error);
    res.status(500).json({
      success: false,
      message: 'Backtest failed',
      error: error.message
    });
  }
};

/**
 * Generate sample data for testing
 */
export const generateSampleData = async (req: Request, res: Response) => {
  try {
    const { days = 5 } = req.query;

    const { candles, previousClose } = StrategyTester.generateSampleData(Number(days));

    res.json({
      success: true,
      data: {
        candles,
        previousClose,
        totalCandles: candles.length,
        days: Number(days)
      }
    });
  } catch (error: any) {
    console.error('Generate sample data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sample data',
      error: error.message
    });
  }
};

/**
 * Test strategy with single candle (for live testing)
 */
export const testSingleCandle = async (req: Request, res: Response) => {
  try {
    const { candle, previousClose, isFirstCandle } = req.body;

    if (!candle) {
      return res.status(400).json({
        success: false,
        message: 'Candle data is required'
      });
    }

    const strategy = new FirstCandleBreakout009Strategy();

    // Check gap filter if provided
    if (previousClose) {
      const gapFilterValid = strategy.checkGapFilter(candle.open, previousClose);
      if (!gapFilterValid) {
        return res.json({
          success: true,
          action: 'none',
          reason: 'Gap filter failed',
          gapFilterValid: false
        });
      }
    }

    // Process candle
    const candleData: CandleData = {
      ...candle,
      timestamp: new Date(candle.timestamp)
    };

    const result = strategy.processCandle(candleData, isFirstCandle);
    const state = strategy.getState();

    res.json({
      success: true,
      result,
      state,
      gapFilterValid: true
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
 * Quick backtest with sample data
 */
export const quickBacktest = async (req: Request, res: Response) => {
  try {
    const { days = 5 } = req.query;

    console.log(`Running quick backtest for ${days} days...`);

    const tester = new StrategyTester();
    const { candles, previousClose } = StrategyTester.generateSampleData(Number(days));
    const results = await tester.backtest(candles, previousClose);

    res.json({
      success: true,
      results,
      summary: {
        totalTrades: results.totalTrades,
        winRate: `${results.winRate.toFixed(2)}%`,
        netProfit: `₹${results.netProfit.toFixed(2)}`,
        profitFactor: results.profitFactor.toFixed(2)
      }
    });
  } catch (error: any) {
    console.error('Quick backtest error:', error);
    res.status(500).json({
      success: false,
      message: 'Quick backtest failed',
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

    // Validate configuration
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

    // Create strategy instance to test
    const strategy = new FirstCandleBreakout009Strategy(strategyConfig);

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
  generateSampleData,
  testSingleCandle,
  quickBacktest,
  validateStrategy
};
