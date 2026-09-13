const express = require('express');
const router = express.Router();
const realMarketData = require('../services/realMarketData');

// Default symbols for market overview
const DEFAULT_SYMBOLS = [
  'NIFTY 50',
  'BANKNIFTY',
  'FINNIFTY',
  'RELIANCE',
  'TCS',
  'INFY',
  'HDFCBANK',
  'ICICIBANK',
  'SBIN',
  'BHARTIARTL'
];

// Get all market data
router.get('/all', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const marketStatus = realMarketData.getMarketStatus();
    const marketData = await realMarketData.fetchLiveData(DEFAULT_SYMBOLS);

    res.json({
      success: true,
      data: marketData,
      isMarketOpen: marketStatus.isOpen,
      marketStatus: {
        status: marketStatus.status,
        message: marketStatus.message,
        nextOpen: marketStatus.nextOpen
      },
      istTime: marketStatus.istTime,
      serverTime: Date.now(),
      timestamp: new Date().toISOString(),
      source: marketData[0]?.source || 'NSE'
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

// Get live updates for specific symbols
router.get('/live', async (req, res) => {
  try {
    const { symbols } = req.query;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    let symbolList = symbols ? symbols.split(',').map(s => s.trim()) : DEFAULT_SYMBOLS;
    const marketData = await realMarketData.fetchLiveData(symbolList);
    const marketStatus = realMarketData.getMarketStatus();

    res.json({
      success: true,
      data: marketData,
      isMarketOpen: marketStatus.isOpen,
      serverTime: Date.now(),
      source: marketData[0]?.source || 'NSE'
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

// Get market depth (Level 2 orderbook)
router.get('/depth/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const depth = await realMarketData.getMarketDepth(symbol);
    res.json({
      success: true,
      depth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get indices
router.get('/indices', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const indices = await realMarketData.getIndices();
    const marketStatus = realMarketData.getMarketStatus();

    res.json({
      success: true,
      data: indices,
      isMarketOpen: marketStatus.isOpen,
      serverTime: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get specific symbol quote
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const data = await realMarketData.fetchLiveData([symbol]);
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Symbol ${symbol} not found`
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
    const allSymbols = [
      'NIFTY 50', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 
      'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 
      'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT', 'AXISBANK', 'WIPRO', 'TATAMOTORS'
    ];

    const results = query
      ? allSymbols.filter(s => s.toLowerCase().includes(query.toLowerCase()))
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
