const express = require('express');
const router = express.Router();

// In-memory broker storage
const brokers = new Map();

// Seed initial default Dhan broker connection for demo/paper
brokers.set('dhan_demo_1', {
  id: 'dhan_demo_1',
  broker: 'dhan',
  clientId: 'DHAN_10029384',
  maskedClientId: 'DHAN***3984',
  accountName: 'Mavrix Primary Dhan',
  status: 'Connected',
  terminalEnabled: true,
  tradingEngineEnabled: true,
  connectedAt: new Date().toISOString(),
  lastActivity: new Date().toISOString()
});

// Get broker list
router.get('/list', (req, res) => {
  try {
    const { userId } = req.query;
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

// Connect Dhan or Add Broker
router.post('/connect', (req, res) => {
  try {
    const { broker = 'dhan', clientId, accessToken, userId = 'default' } = req.body;
    if (!clientId) {
      return res.status(400).json({ success: false, message: 'Client ID is required' });
    }

    const id = `${broker}_${clientId}_${Date.now()}`;
    const masked = clientId.length > 4 ? `${clientId.slice(0, 4)}***${clientId.slice(-3)}` : clientId;
    const brokerObj = {
      id,
      broker,
      clientId,
      maskedClientId: masked,
      accountName: `${broker.toUpperCase()} Account (${masked})`,
      status: 'Connected',
      terminalEnabled: true,
      tradingEngineEnabled: true,
      userId,
      connectedAt: new Date().toISOString()
    };

    brokers.set(id, brokerObj);

    res.json({
      success: true,
      message: 'Broker connected successfully',
      broker: brokerObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Dhan OAuth Login URL
router.post('/dhan-login-url', (req, res) => {
  try {
    const { clientId } = req.body;
    const state = `st_${Date.now()}`;
    const loginUrl = `https://auth.dhan.co/login?clientId=${clientId || 'DHAN_CLI'}&state=${state}`;
    res.json({
      success: true,
      loginUrl,
      state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get Funds
router.get('/funds', (req, res) => {
  res.json({
    success: true,
    funds: {
      availableMargin: 125000.50,
      usedMargin: 15400.00,
      totalAccountBalance: 140400.50,
      collateralMargin: 25000.00,
      cashBalance: 115400.50,
      currency: 'INR',
      timestamp: new Date().toISOString()
    }
  });
});

router.get('/funds/:brokerId', (req, res) => {
  res.json({
    success: true,
    funds: {
      availableMargin: 125000.50,
      usedMargin: 15400.00,
      totalAccountBalance: 140400.50,
      collateralMargin: 25000.00,
      cashBalance: 115400.50,
      currency: 'INR',
      timestamp: new Date().toISOString()
    }
  });
});

// Get Positions
router.get('/positions', (req, res) => {
  res.json({
    success: true,
    positions: []
  });
});

router.get('/positions/:brokerId', (req, res) => {
  res.json({
    success: true,
    positions: []
  });
});

// Get Orders
router.get('/orders', (req, res) => {
  res.json({
    success: true,
    orders: []
  });
});

router.get('/orders/:brokerId', (req, res) => {
  res.json({
    success: true,
    orders: []
  });
});

// Delete broker
router.delete('/:brokerId', (req, res) => {
  try {
    const { brokerId } = req.params;
    if (brokers.has(brokerId)) {
      brokers.delete(brokerId);
      res.json({ success: true, message: 'Broker disconnected' });
    } else {
      res.status(404).json({ success: false, message: 'Broker not found' });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
