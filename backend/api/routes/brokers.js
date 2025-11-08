const express = require('express');
const router = express.Router();

// In-memory broker storage (in production, use a database)
const brokers = new Map();

// Get broker list
router.get('/list', (req, res) => {
  try {
    const { userId } = req.query;
    
    // Filter brokers by userId if provided
    const userBrokers = userId 
      ? Array.from(brokers.values()).filter(b => b.userId === userId)
      : Array.from(brokers.values());

    res.json({
      success: true,
      brokers: userBrokers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add broker
router.post('/add', (req, res) => {
  try {
    const { broker, clientId, userId } = req.body;
    
    if (!broker || !clientId) {
      return res.status(400).json({
        success: false,
        message: 'Broker and clientId are required'
      });
    }

    const brokerId = `${broker}_${clientId}_${Date.now()}`;
    const brokerData = {
      id: brokerId,
      broker,
      clientId,
      userId: userId || 'default',
      status: 'Disconnected',
      terminalEnabled: false,
      tradingEngineEnabled: false,
      createdAt: new Date().toISOString()
    };

    brokers.set(brokerId, brokerData);

    res.status(201).json({
      success: true,
      message: 'Broker added successfully',
      broker: brokerData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete broker
router.delete('/:brokerId', (req, res) => {
  try {
    const { brokerId } = req.params;
    
    if (brokers.has(brokerId)) {
      brokers.delete(brokerId);
      res.json({
        success: true,
        message: 'Broker deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Toggle terminal
router.post('/terminal', (req, res) => {
  try {
    const { brokerId, enabled } = req.body;
    
    const broker = brokers.get(brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    broker.terminalEnabled = enabled;
    brokers.set(brokerId, broker);

    res.json({
      success: true,
      message: `Terminal ${enabled ? 'enabled' : 'disabled'}`,
      broker
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Toggle trading engine
router.post('/tradingEngine', (req, res) => {
  try {
    const { brokerId, enabled } = req.body;
    
    const broker = brokers.get(brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    broker.tradingEngineEnabled = enabled;
    brokers.set(brokerId, broker);

    res.json({
      success: true,
      message: `Trading Engine ${enabled ? 'enabled' : 'disabled'}`,
      broker
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
