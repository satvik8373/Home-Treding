const { handleCors } = require('./_lib/cors');

const strategies = new Map();

module.exports = async (req, res) => {
  return handleCors(req, res, async () => {
    const { method } = req;

    try {
      // GET - List strategies
      if (method === 'GET') {
        const allStrategies = Array.from(strategies.values());
        return res.status(200).json({
          success: true,
          strategies: allStrategies
        });
      }

      // POST - Create strategy
      if (method === 'POST') {
        const strategyData = req.body;
        
        const newStrategy = {
          id: 'strategy_' + Date.now(),
          ...strategyData,
          status: 'draft',
          deploymentStatus: 'stopped',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        strategies.set(newStrategy.id, newStrategy);

        return res.status(201).json({
          success: true,
          message: 'Strategy created successfully',
          strategy: newStrategy
        });
      }

      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });

    } catch (error) {
      console.error('Strategies API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};
