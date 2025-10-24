/**
 * Strategy Testing Routes
 */

import express from 'express';
import {
  backtestStrategy,
  generateSampleData,
  testSingleCandle,
  quickBacktest,
  validateStrategy
} from '../controllers/strategyTestController';

const router = express.Router();

/**
 * POST /api/strategy-test/backtest
 * Backtest strategy with historical data
 */
router.post('/backtest', backtestStrategy);

/**
 * GET /api/strategy-test/sample-data
 * Generate sample historical data
 */
router.get('/sample-data', generateSampleData);

/**
 * POST /api/strategy-test/test-candle
 * Test strategy with single candle
 */
router.post('/test-candle', testSingleCandle);

/**
 * GET /api/strategy-test/quick-backtest
 * Quick backtest with sample data
 */
router.get('/quick-backtest', quickBacktest);

/**
 * POST /api/strategy-test/validate
 * Validate strategy configuration
 */
router.post('/validate', validateStrategy);

export default router;
