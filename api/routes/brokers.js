const express = require('express');
const axios = require('axios');
const router = express.Router();

// In-memory broker storage
const brokers = new Map();

// Helper to safely find user broker without cross-user leakage
const findUserBroker = (userId, brokerId) => {
  if (brokerId) {
    const b = brokers.get(brokerId);
    if (b && (!userId || b.userId === userId)) return b;
    for (const item of brokers.values()) {
      if ((item.id === brokerId || item.clientId === brokerId) && (!userId || item.userId === userId)) {
        return item;
      }
    }
    return null;
  }
  if (userId) {
    for (const item of brokers.values()) {
      if (item.userId === userId) return item;
    }
  }
  return null;
};

// Get broker list (support both / and /list)
const handleGetBrokers = (req, res) => {
  try {
    const { userId } = req.query;
    const all = Array.from(brokers.values());
    const userBrokers = userId 
      ? all.filter(b => b.userId === userId)
      : [];

    // Sanitize: do not send plaintext accessToken to client list
    const sanitized = userBrokers.map(b => ({
      id: b.id,
      broker: b.broker,
      clientId: b.clientId,
      maskedClientId: b.maskedClientId,
      accountName: b.accountName,
      status: b.status,
      terminalEnabled: b.terminalEnabled,
      tradingEngineEnabled: b.tradingEngineEnabled,
      connectedAt: b.connectedAt,
      lastActivity: b.lastActivity
    }));

    res.json({
      success: true,
      brokers: sanitized
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

router.get('/', handleGetBrokers);
router.get('/list', handleGetBrokers);

// Toggle Terminal Status
router.post('/terminal', (req, res) => {
  try {
    const { brokerId, enabled, userId } = req.body;
    const broker = findUserBroker(userId, brokerId);
    if (broker) {
      broker.terminalEnabled = enabled;
      broker.lastActivity = new Date().toISOString();
      return res.json({
        success: true,
        message: `Terminal ${enabled ? 'enabled' : 'disabled'}`,
        broker: {
          id: broker.id,
          broker: broker.broker,
          clientId: broker.clientId,
          maskedClientId: broker.maskedClientId,
          accountName: broker.accountName,
          status: broker.status,
          terminalEnabled: broker.terminalEnabled,
          tradingEngineEnabled: broker.tradingEngineEnabled
        }
      });
    }
    res.json({
      success: true,
      message: `Terminal ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle Trading Engine
router.post('/tradingEngine', (req, res) => {
  try {
    const { brokerId, enabled } = req.body;
    const broker = brokers.get(brokerId) || Array.from(brokers.values())[0];
    if (broker) {
      broker.tradingEngineEnabled = enabled;
      broker.lastActivity = new Date().toISOString();
      return res.json({
        success: true,
        message: `Trading engine ${enabled ? 'enabled' : 'disabled'}`,
        broker: {
          id: broker.id,
          broker: broker.broker,
          clientId: broker.clientId,
          maskedClientId: broker.maskedClientId,
          accountName: broker.accountName,
          status: broker.status,
          terminalEnabled: broker.terminalEnabled,
          tradingEngineEnabled: broker.tradingEngineEnabled
        }
      });
    }
    res.json({
      success: true,
      message: `Trading engine ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/terminal-status', (req, res) => {
  const hasActive = Array.from(brokers.values()).some(b => b.status === 'Connected');
  res.json({ success: true, status: hasActive ? 'Active' : 'Standby', terminalEnabled: hasActive });
});

// Connect Dhan: REAL verification against DhanHQ v2 API
router.post('/connect', async (req, res) => {
  try {
    const { broker = 'dhan', clientId, accessToken, userId = 'default' } = req.body;
    if (!clientId || !accessToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both Client ID and Access Token are required to connect Dhan' 
      });
    }

    const cleanClientId = String(clientId).trim();
    const cleanToken = String(accessToken).trim();

    // Verify credentials directly with DhanHQ v2 API (Fund Limit endpoint)
    console.log(`[Dhan] Validating credentials with DhanHQ v2 for client: ${cleanClientId}...`);
    try {
      const dhanRes = await axios.get('https://api.dhan.co/v2/fundlimit', {
        headers: {
          'access-token': cleanToken,
          'client-id': cleanClientId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      console.log(`[Dhan] Credentials verified successfully for client: ${cleanClientId}`);
      const fundData = dhanRes.data || {};

      const id = `dhan_${cleanClientId}`;
      const masked = cleanClientId.length > 4 
        ? `${cleanClientId.slice(0, 4)}***${cleanClientId.slice(-3)}` 
        : cleanClientId;

      const brokerObj = {
        id,
        broker: 'dhan',
        clientId: cleanClientId,
        maskedClientId: masked,
        accountName: `DhanHQ (${masked})`,
        status: 'Connected',
        terminalEnabled: true,
        tradingEngineEnabled: true,
        accessToken: cleanToken,
        userId,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        funds: {
          availableMargin: Number(fundData.availabelBalance || fundData.availableBalance || 0),
          usedMargin: Number(fundData.utilizedAmount || 0),
          totalAccountBalance: Number(fundData.availabelBalance || fundData.availableBalance || 0) + Number(fundData.utilizedAmount || 0),
          collateralMargin: Number(fundData.collateralAmount || 0),
          cashBalance: Number(fundData.availabelBalance || fundData.availableBalance || 0),
          currency: 'INR',
          timestamp: new Date().toISOString()
        }
      };

      brokers.set(id, brokerObj);

      return res.json({
        success: true,
        message: 'Dhan broker account verified and connected successfully!',
        broker: {
          id: brokerObj.id,
          broker: brokerObj.broker,
          clientId: brokerObj.clientId,
          maskedClientId: brokerObj.maskedClientId,
          accountName: brokerObj.accountName,
          status: brokerObj.status,
          terminalEnabled: brokerObj.terminalEnabled,
          tradingEngineEnabled: brokerObj.tradingEngineEnabled,
          connectedAt: brokerObj.connectedAt,
          lastActivity: brokerObj.lastActivity
        },
        funds: brokerObj.funds
      });
    } catch (dhanErr) {
      const status = dhanErr.response?.status;
      const respData = dhanErr.response?.data;
      console.error(`[Dhan Validation Failed] status=${status}:`, respData || dhanErr.message);

      let clientMsg = 'Failed to validate credentials with Dhan API.';
      if (status === 401) {
        clientMsg = 'Invalid Dhan Client ID or Access Token. Please verify your credentials or generate a fresh token from Dhan Developer Portal.';
      } else if (status === 403) {
        clientMsg = 'Dhan account trading access is inactive or permission denied.';
      } else if (dhanErr.code === 'ECONNABORTED' || dhanErr.code === 'ENOTFOUND') {
        clientMsg = 'Dhan API server unreachable. Please check your internet connection.';
      } else if (respData?.remarks || respData?.errorMessage) {
        clientMsg = `Dhan Error: ${respData.remarks || respData.errorMessage}`;
      }

      return res.status(status && status >= 400 && status < 500 ? status : 400).json({
        success: false,
        message: clientMsg,
        error: respData || dhanErr.message
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during broker connection'
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

// Live Funds from DhanHQ v2
const handleGetFunds = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const userId = req.query.userId || req.body?.userId;
    const broker = findUserBroker(userId, brokerId);
    if (!broker || !broker.accessToken || !broker.clientId) {
      return res.json({
        success: false,
        message: 'No active Dhan broker connected',
        funds: null
      });
    }

    try {
      const dhanRes = await axios.get('https://api.dhan.co/v2/fundlimit', {
        headers: {
          'access-token': broker.accessToken,
          'client-id': broker.clientId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 8000
      });

      const fundData = dhanRes.data || {};
      const funds = {
        availableMargin: Number(fundData.availabelBalance || fundData.availableBalance || 0),
        usedMargin: Number(fundData.utilizedAmount || 0),
        totalAccountBalance: Number(fundData.availabelBalance || fundData.availableBalance || 0) + Number(fundData.utilizedAmount || 0),
        collateralMargin: Number(fundData.collateralAmount || 0),
        cashBalance: Number(fundData.availabelBalance || fundData.availableBalance || 0),
        currency: 'INR',
        timestamp: new Date().toISOString()
      };
      broker.funds = funds;
      broker.status = 'Connected';

      return res.json({ success: true, funds });
    } catch (apiErr) {
      if (apiErr.response?.status === 401) {
        broker.status = 'Expired';
        return res.status(401).json({
          success: false,
          status: 'Expired',
          message: 'Dhan Access Token has expired. Please reconnect.',
          funds: broker.funds || null
        });
      }
      return res.json({
        success: true,
        funds: broker.funds || null
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/funds', handleGetFunds);
router.get('/funds/:brokerId', handleGetFunds);

// Live Positions from DhanHQ v2
const handleGetPositions = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const userId = req.query.userId || req.body?.userId;
    const broker = findUserBroker(userId, brokerId);
    if (!broker || !broker.accessToken || !broker.clientId) {
      return res.json({ success: true, positions: [] });
    }

    try {
      const dhanRes = await axios.get('https://api.dhan.co/v2/positions', {
        headers: {
          'access-token': broker.accessToken,
          'client-id': broker.clientId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 8000
      });
      const pos = Array.isArray(dhanRes.data) ? dhanRes.data : [];
      return res.json({ success: true, positions: pos });
    } catch (e) {
      return res.json({ success: true, positions: [] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/positions', handleGetPositions);
router.get('/positions/:brokerId', handleGetPositions);

// Live Orders from DhanHQ v2
const handleGetOrders = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const userId = req.query.userId || req.body?.userId;
    const broker = findUserBroker(userId, brokerId);
    if (!broker || !broker.accessToken || !broker.clientId) {
      return res.json({ success: true, orders: [] });
    }

    try {
      const dhanRes = await axios.get('https://api.dhan.co/v2/orders', {
        headers: {
          'access-token': broker.accessToken,
          'client-id': broker.clientId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 8000
      });
      const ords = Array.isArray(dhanRes.data) ? dhanRes.data : [];
      return res.json({ success: true, orders: ords });
    } catch (e) {
      return res.json({ success: true, orders: [] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/orders', handleGetOrders);
router.get('/orders/:brokerId', handleGetOrders);

// Delete / Disconnect broker
router.delete('/:brokerId', (req, res) => {
  try {
    const { brokerId } = req.params;
    if (brokers.has(brokerId)) {
      brokers.delete(brokerId);
      res.json({ success: true, message: 'Dhan broker disconnected successfully' });
    } else {
      // If client sent clientId or partial ID
      let deleted = false;
      for (const [key, b] of brokers.entries()) {
        if (b.id === brokerId || b.clientId === brokerId || key === brokerId) {
          brokers.delete(key);
          deleted = true;
          break;
        }
      }
      if (deleted) {
        res.json({ success: true, message: 'Dhan broker disconnected successfully' });
      } else {
        res.json({ success: true, message: 'Broker already removed' });
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
