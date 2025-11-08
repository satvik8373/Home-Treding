const express = require('express');
const router = express.Router();

// Mock market data
const generateMarketData = () => {
  const symbols = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFC'];
  
  return symbols.map(symbol => ({
    symbol,
    ltp: (Math.random() * 10000 + 1000).toFixed(2),
    change: (Math.random() * 200 - 100).toFixed(2),
    changePercent: (Math.random() * 5 - 2.5).toFixed(2),
    volume: Math.floor(Math.random() * 1000000),
    high: (Math.random() * 10000 + 1000).toFixed(2),
    low: (Math.random() * 10000 + 1000).toFixed(2),
    open: (Math.random() * 10000 + 1000).toFixed(2),
    close: (Math.random() * 10000 + 1000).toFixed(2),
    timestamp: new Date().toISOString()
  }));
};

// Get all market data
router.get('/all', (req, res) => {
  try {
    const marketData = generateMarketData();
    
    res.json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get specific symbol data
router.get('/quote/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    const quote = {
      symbol: symbol.toUpperCase(),
      ltp: (Math.random() * 10000 + 1000).toFixed(2),
      change: (Math.random() * 200 - 100).toFixed(2),
      changePercent: (Math.random() * 5 - 2.5).toFixed(2),
      volume: Math.floor(Math.random() * 1000000),
      high: (Math.random() * 10000 + 1000).toFixed(2),
      low: (Math.random() * 10000 + 1000).toFixed(2),
      open: (Math.random() * 10000 + 1000).toFixed(2),
      close: (Math.random() * 10000 + 1000).toFixed(2),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Search symbols
router.get('/search', (req, res) => {
  try {
    const { query } = req.query;
    
    const allSymbols = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK', 'SBIN', 'HDFCBANK'];
    
    const results = query 
      ? allSymbols.filter(s => s.includes(query.toUpperCase()))
      : allSymbols;

    res.json({
      success: true,
      results: results.map(symbol => ({
        symbol,
        name: symbol,
        exchange: 'NSE'
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
