// Market data endpoint
const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Simple mock data for now
    const marketData = {
      stocks: [
        { symbol: 'RELIANCE', price: 2450.50, change: 15.25, changePercent: 0.63 },
        { symbol: 'TCS', price: 3680.25, change: -8.45, changePercent: -0.23 }
      ],
      indices: [
        { symbol: 'NIFTY50', price: 19500.50, change: 125.30, changePercent: 0.65 },
        { symbol: 'BANKNIFTY', price: 44200.75, change: -150.25, changePercent: -0.34 }
      ]
    };

    res.status(200).json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
