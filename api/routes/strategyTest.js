/**
 * Mavrix AlgoRooms - Production Strategy Test Route
 * Routes backtesting to the Dhan historical candle engine.
 */

const express = require('express');
const router = express.Router();
const backtestRouter = require('./backtest');

/**
 * GET /api/strategy-test/quick-backtest
 */
router.get('/quick-backtest', async (req, res) => {
  try {
    const days = Number(req.query.days) || 5;
    const symbol = req.query.symbol || 'NIFTY 50';
    const result = await backtestRouter.executeAuthenticBacktest({
      strategyId: 'nifty-atm-independent-breakout',
      symbol,
      days,
      capital: 100000
    }, req.headers.authorization);

    res.json({
      success: true,
      strategy: 'nifty-atm-independent-breakout',
      symbol,
      periodDays: days,
      candleCount: result.dataSource?.spotCandleCount || days * 75,
      dataSource: result.dataSource?.provider,
      results: {
        totalTrades: result.totalTrades,
        winRate: result.winRate,
        netProfit: result.totalNetPnl,
        profitFactor: result.profitFactor,
        maxDrawdown: result.maxDrawdown
      },
      summary: result.summary
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'BACKTEST_FAILED' });
  }
});

/**
 * POST /api/strategy-test/backtest
 */
router.post('/backtest', async (req, res) => {
  try {
    const { symbol = 'NIFTY 50', days = 5, capital = 100000 } = req.body || {};
    const result = await backtestRouter.executeAuthenticBacktest({
      strategyId: 'nifty-atm-independent-breakout',
      symbol,
      days: Number(days) || 5,
      capital: Number(capital) || 100000
    }, req.headers.authorization);

    res.json({
      success: true,
      strategy: 'nifty-atm-independent-breakout',
      symbol,
      periodDays: Number(days),
      dataSource: result.dataSource?.provider,
      results: {
        totalTrades: result.totalTrades,
        winRate: result.winRate,
        netProfit: result.totalNetPnl,
        profitFactor: result.profitFactor,
        maxDrawdown: result.maxDrawdown
      },
      summary: result.summary
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'BACKTEST_FAILED' });
  }
});

/**
 * POST /api/strategy-test/test-candle
 */
router.post('/test-candle', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Single-candle testing is unavailable; run a complete historical session.'
  });
});

/**
 * POST /api/strategy-test/validate
 */
router.post('/validate', (req, res) => {
  const config = req.body?.strategyConfig;
  const valid = config && Number.isFinite(config.breakoutPct) && config.breakoutPct > 0;
  res.status(valid ? 200 : 400).json({
    success: Boolean(valid),
    valid: Boolean(valid),
    message: valid ? 'Strategy parameters validated successfully' : 'Invalid breakout parameters'
  });
});

module.exports = router;
