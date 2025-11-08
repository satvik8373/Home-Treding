const { handleCors } = require('./_lib/cors');
const { getAllBrokers, saveBroker, deleteBroker } = require('./_lib/brokerStore');

module.exports = async (req, res) => {
  return handleCors(req, res, async () => {
    try {
      const { method } = req;

      // GET - List all brokers
      if (method === 'GET') {
        const brokers = getAllBrokers();
        return res.status(200).json({
          success: true,
          brokers
        });
      }

      // POST - Connect new broker
      if (method === 'POST') {
        const { broker, clientId, accessToken } = req.body;

        if (!broker || !clientId) {
          return res.status(400).json({
            success: false,
            message: 'Broker name and Client ID are required'
          });
        }

        const newBroker = {
          id: `${broker.toLowerCase()}_${clientId}_${Date.now()}`,
          broker,
          clientId,
          accessToken: accessToken || '',
          status: 'Connected',
          terminalEnabled: true,
          terminalActivated: true,
          tradingEngineEnabled: false,
          accountName: `${broker} Account ${clientId}`,
          connectedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        };

        saveBroker(newBroker);

        return res.status(201).json({
          success: true,
          message: 'Broker connected successfully',
          broker: newBroker
        });
      }

      // DELETE - Remove broker
      if (method === 'DELETE') {
        const { brokerId } = req.query;
        
        if (!brokerId) {
          return res.status(400).json({
            success: false,
            message: 'Broker ID is required'
          });
        }

        const deleted = deleteBroker(brokerId);
        
        if (deleted) {
          return res.status(200).json({
            success: true,
            message: 'Broker deleted successfully'
          });
        } else {
          return res.status(404).json({
            success: false,
            message: 'Broker not found'
          });
        }
      }

      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });

    } catch (error) {
      console.error('Brokers API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};
