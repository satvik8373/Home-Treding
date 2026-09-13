const express = require('express');
const router = express.Router();

// Mock portfolio data
const generatePortfolioData = (userId) => {
  return {
    userId,
    totalValue: 1250000,
    totalPnL: 45000,
    totalPnLPercent: 3.73,
    dayPnL: 12500,
    dayPnLPercent: 1.01,
    positions: [
      {
        id: 'pos_1',
        symbol: 'RELIANCE',
        quantity: 100,
        avgPrice: 2450.50,
        ltp: 2475.00,
        pnl: 2450,
        pnlPercent: 1.0
      },
      {
        id: 'pos_2',
        symbol: 'TCS',
        quantity: 50,
        avgPrice: 3200.00,
        ltp: 3180.00,
        pnl: -1000,
        pnlPercent: -0.63
      }
    ],
    holdings: [
      {
        id: 'hold_1',
        symbol: 'INFY',
        quantity: 200,
        avgPrice: 1450.00,
        ltp: 1480.00,
        pnl: 6000,
        pnlPercent: 2.07
      }
    ]
  };
};

// Get portfolio summary
router.get('/summary', (req, res) => {
  try {
    const { userId } = req.query;
    const portfolio = generatePortfolioData(userId || 'default');

    res.json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get positions
router.get('/positions', (req, res) => {
  try {
    const { userId } = req.query;
    const portfolio = generatePortfolioData(userId || 'default');

    res.json({
      success: true,
      positions: portfolio.positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get holdings
router.get('/holdings', (req, res) => {
  try {
    const { userId } = req.query;
    const portfolio = generatePortfolioData(userId || 'default');

    res.json({
      success: true,
      holdings: portfolio.holdings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
