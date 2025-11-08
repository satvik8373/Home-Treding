const express = require('express');
const router = express.Router();
const realMarketData = require('../services/realMarketData');

// Default symbols to fetch
const DEFAULT_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK', 'SBIN'];

// Get all market data (REAL LIVE DATA from APIs)
router.get('/all', async (req, res) => {
  try {
    // Set headers for fast response and no caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Fetch real market data
    const marketData = await realMarketData.fetchLiveData(DEFAULT_SYMBOLS);
    
    if (marketData.length === 0) {
      return res.status(503).json({
        success: false,
        message: 'Market data temporarily unavailable. Please try again.',
        data: []
      });
    }
    
    res.json({
      success: true,
      data: marketData,
      serverTime: Date.now(),
      timestamp: new Date().toISOString(),
      source: marketData[0]?.source || 'Unknown'
    });
  } catch (error) {
    console.error('Market data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market data',
      error: error.message
    });
  }
});

// Get live updates for specific symbols (REAL LIVE DATA)
router.get('/live', async (req, res) => {
  try {
    const { symbols } = req.query;
    
    // Set headers for fast response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    let symbolList = symbols ? symbols.split(',').map(s => s.trim().toUpperCase()) : ['NIFTY', 'BANKNIFTY', 'SENSEX'];
    
    // Fetch real market data for specific symbols
    const marketData = await realMarketData.fetchLiveData(symbolList);
    
    res.json({
      success: true,
      data: marketData,
      serverTime: Date.now(),
      source: marketData[0]?.source || 'Unknown'
    });
  } catch (error) {
    console.error('Live data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live data',
      error: error.message
    });
  }
});

// Get indices only (NIFTY, BANKNIFTY, SENSEX)
router.get('/indices', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    const indices = await realMarketData.getIndices();
    
    res.json({
      success: true,
      data: indices,
      serverTime: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get specific symbol data (REAL LIVE DATA)
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    const data = await realMarketData.fetchLiveData([symbol.toUpperCase()]);
    
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Symbol ${symbol} not found or data unavailable`
      });
    }

    res.json({
      success: true,
      data: data[0]
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
