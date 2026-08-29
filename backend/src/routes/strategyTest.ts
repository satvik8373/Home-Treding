import express from 'express';
import {
  backtestStrategy,
  quickBacktest,
  testSingleCandle,
  validateStrategy
} from '../controllers/strategyTestController';

const router = express.Router();

/**
 * POST /api/strategy-test/backtest
 * Backtest strategy with historical candles or Dhan API
 */
router.post('/backtest', backtestStrategy);

/**
 * GET /api/strategy-test/quick-backtest
 * Quick backtest on recent Dhan market candles
 */
router.get('/quick-backtest', quickBacktest);

/**
 * POST /api/strategy-test/test-candle
 * Test strategy with single candle in real-time
 */
router.post('/test-candle', testSingleCandle);

/**
 * POST /api/strategy-test/validate
 * Validate strategy configuration
 */
router.post('/validate', validateStrategy);

export default router;
