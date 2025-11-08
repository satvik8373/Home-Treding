const { handleCors } = require('../_lib/cors');

module.exports = async (req, res) => {
  return handleCors(req, res, async () => {
    try {
      const positions = [
        {
          symbol: 'RELIANCE',
          quantity: 10,
          averagePrice: 2450.50,
          currentPrice: 2485.75,
          marketValue: 24857.50,
          pnl: 352.50,
          pnlPercentage: 1.44,
          unrealizedPnl: 352.50,
          realizedPnl: 0,
          dayChange: 15.25,
          dayChangePercentage: 0.62
        },
        {
          symbol: 'TCS',
          quantity: 5,
          averagePrice: 3680.25,
          currentPrice: 3695.80,
          marketValue: 18479.00,
          pnl: 77.75,
          pnlPercentage: 0.42,
          unrealizedPnl: 77.75,
          realizedPnl: 0,
          dayChange: -8.45,
          dayChangePercentage: -0.23
        }
      ];

      res.status(200).json({
        success: true,
        positions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};
