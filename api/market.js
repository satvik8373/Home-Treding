// Market data API endpoint
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Mock market data
    const marketData = {
      nifty: {
        symbol: 'NIFTY 50',
        price: 19500.50,
        change: 125.30,
        changePercent: 0.65
      },
      sensex: {
        symbol: 'SENSEX',
        price: 65000.25,
        change: 200.50,
        changePercent: 0.31
      }
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
