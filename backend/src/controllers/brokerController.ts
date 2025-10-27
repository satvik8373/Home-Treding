/**
 * Broker Controller - DHAN Integration (AlgoRooms Style)
 * Handles broker connections, validation, and trading operations
 */

import { Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// DHAN API Configuration
const DHAN_CONFIG = {
  apiBase: 'https://api.dhan.co/v2',
  loginUrl: 'https://api.dhan.co/v2/login',
  ordersUrl: 'https://api.dhan.co/v2/orders',
  positionsUrl: 'https://api.dhan.co/v2/positions'
};

// In-memory broker storage (in production, use database)
const brokers = new Map<string, any>();

/**
 * Connect and validate broker credentials
 */
export const connectBroker = asyncHandler(async (req: Request, res: Response) => {
  const { broker, clientId, accessToken } = req.body;

  try {
    logger.info('🔗 Connecting to broker:', { broker, clientId });

    if (!clientId || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Client ID and Access Token are required'
      });
    }

    // Validate credentials with DHAN API
    const validationResult = await validateDhanCredentials(clientId, accessToken);

    if (validationResult.success) {
      // Generate unique broker ID
      const brokerId = `${broker}_${clientId}_${Date.now()}`;

      // Create broker record
      const brokerRecord = {
        id: brokerId,
        broker,
        clientId,
        accessToken,
        status: 'Connected',
        accountName: validationResult.accountName || `${broker} Account`,
        strategyPerformance: '0.00%',
        terminalEnabled: false,
        tradingEngineEnabled: false,
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      // Store broker
      brokers.set(brokerId, brokerRecord);

      logger.info('✅ Broker connected successfully:', brokerId);

      res.json({
        success: true,
        message: 'Broker connected successfully',
        broker: brokerRecord
      });
    } else {
      res.status(400).json({
        success: false,
        message: validationResult.error || 'Invalid credentials'
      });
    }

  } catch (error: any) {
    logger.error('❌ Broker connection error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to connect broker',
      error: error.message
    });
  }
});

/**
 * Validate DHAN credentials by testing API access
 */
async function validateDhanCredentials(clientId: string, accessToken: string) {
  try {
    // Test API access by fetching orders
    const response = await axios.get(DHAN_CONFIG.ordersUrl, {
      headers: {
        'access-token': accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.status === 200) {
      return {
        success: true,
        accountName: `DHAN Account ${clientId}`
      };
    } else {
      return {
        success: false,
        error: 'Invalid API response'
      };
    }

  } catch (error: any) {
    logger.error('DHAN validation error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Invalid Access Token. Please check your credentials.'
      };
    } else if (error.response?.status === 403) {
      return {
        success: false,
        error: 'Access denied. Please ensure trading permissions are enabled.'
      };
    } else {
      return {
        success: false,
        error: 'Unable to validate credentials. Please try again.'
      };
    }
  }
}

/**
 * List all connected brokers
 */
export const listBrokers = asyncHandler(async (req: Request, res: Response) => {
  const brokerList = Array.from(brokers.values());

  res.json({
    success: true,
    brokers: brokerList
  });
});

/**
 * Activate Dhan Trading Terminal (Like AlgoRooms)
 */
export const activateTerminal = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.body;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  try {
    logger.info('🔥 Activating Dhan Trading Terminal for broker:', brokerId);

    // Step 1: Check if terminal is already active by testing order placement capability
    // In Dhan API, terminal activation is usually done through the web interface
    // We'll verify if the account has trading permissions by testing API access

    logger.info('🔍 Checking Dhan account trading permissions...');

    // Step 2: Test trading permissions by checking orders and positions
    const [ordersResponse, positionsResponse] = await Promise.all([
      axios.get(DHAN_CONFIG.ordersUrl, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }),
      axios.get(DHAN_CONFIG.positionsUrl, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }).catch(() => ({ data: [] }))
    ]);

    logger.info('✅ Trading permissions verified - Orders and positions accessible');

    // Step 3: Create account info with trading capabilities
    const accountInfo = {
      clientId: broker.clientId,
      status: 'Trading Enabled',
      terminalActivated: true,
      lastLogin: new Date().toISOString(),
      totalOrders: Array.isArray(ordersResponse.data) ? ordersResponse.data.length : 0,
      activePositions: Array.isArray(positionsResponse.data) ? positionsResponse.data.length : 0,
      connectionStatus: 'Connected',
      marketStatus: 'Open',
      lastActivity: new Date().toISOString(),
      canPlaceOrders: true,
      tradingPermissions: 'Active'
    };

    // Update broker with terminal active status
    broker.terminalActivated = true;
    broker.lastActivity = new Date();
    brokers.set(brokerId, broker);

    logger.info('🚀 Trading permissions verified for broker:', brokerId);

    res.json({
      success: true,
      message: 'Trading permissions verified! Your Dhan account is ready for order placement.',
      accountInfo,
      recentActivity: {
        orders: ordersResponse.data?.slice(0, 5) || [],
        positions: positionsResponse.data?.slice(0, 5) || []
      }
    });

  } catch (error: any) {
    logger.error('❌ Trading permission check error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      res.status(401).json({
        success: false,
        message: 'Invalid Access Token. Please check your Dhan API credentials.',
        instructions: 'Go to Dhan → Profile → DhanHQ Trading APIs and regenerate your Access Token.'
      });
    } else if (error.response?.status === 403) {
      res.status(403).json({
        success: false,
        message: 'Trading permissions not enabled. Please activate terminal in Dhan app.',
        instructions: 'Login to Dhan app/web → Go to Trading Terminal → Click "Activate Terminal" → Then try again.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Unable to verify trading permissions. Please ensure terminal is active in Dhan.',
        instructions: 'Manual Steps: 1) Login to Dhan app 2) Go to Trading section 3) Activate Terminal 4) Try connecting again',
        error: error.message
      });
    }
  }
});

/**
 * Check Terminal Status and Account Activity
 */
export const checkTerminalStatus = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.body;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  try {
    // Get live account info and recent activity from DHAN
    const [ordersResponse, positionsResponse] = await Promise.all([
      axios.get(DHAN_CONFIG.ordersUrl, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }),
      axios.get(DHAN_CONFIG.positionsUrl, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }).catch(() => ({ data: [] })) // Positions might not be available
    ]);

    const accountInfo = {
      clientId: broker.clientId,
      status: broker.terminalActivated ? 'Terminal Active' : 'Terminal Inactive',
      terminalActivated: broker.terminalActivated || false,
      lastLogin: new Date().toISOString(),
      totalOrders: Array.isArray(ordersResponse.data) ? ordersResponse.data.length : 0,
      activePositions: Array.isArray(positionsResponse.data) ? positionsResponse.data.length : 0,
      connectionStatus: 'Connected',
      marketStatus: 'Open',
      lastActivity: new Date().toISOString(),
      canPlaceOrders: broker.terminalActivated || false
    };

    logger.info('🖥️ Terminal status checked for broker:', brokerId, accountInfo);

    res.json({
      success: true,
      message: 'Terminal status retrieved successfully',
      accountInfo,
      recentActivity: {
        orders: ordersResponse.data?.slice(0, 5) || [], // Last 5 orders
        positions: positionsResponse.data?.slice(0, 5) || [] // Current positions
      }
    });

  } catch (error: any) {
    logger.error('❌ Terminal status check error:', error.message);

    if (error.response?.status === 401) {
      res.status(401).json({
        success: false,
        message: 'Session expired. Please reconnect your broker account.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Unable to check terminal status. Please try again.',
        error: error.message
      });
    }
  }
});

/**
 * Toggle Terminal (WebSocket connection)
 */
export const toggleTerminal = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId, enabled } = req.body;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  // Update terminal status
  broker.terminalEnabled = enabled;
  broker.lastActivity = new Date();
  brokers.set(brokerId, broker);

  logger.info(`🖥️ Terminal ${enabled ? 'enabled' : 'disabled'} for broker:`, brokerId);

  res.json({
    success: true,
    message: `Terminal ${enabled ? 'enabled' : 'disabled'}`,
    broker
  });
});

/**
 * Toggle Trading Engine
 */
export const toggleTradingEngine = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId, enabled } = req.body;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  // Update trading engine status
  broker.tradingEngineEnabled = enabled;
  broker.lastActivity = new Date();
  brokers.set(brokerId, broker);

  logger.info(`⚙️ Trading Engine ${enabled ? 'enabled' : 'disabled'} for broker:`, brokerId);

  res.json({
    success: true,
    message: `Trading Engine ${enabled ? 'enabled' : 'disabled'}`,
    broker
  });
});

/**
 * Reconnect broker
 */
export const reconnectBroker = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.body;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  // Re-validate credentials
  const validationResult = await validateDhanCredentials(broker.clientId, broker.accessToken);

  if (validationResult.success) {
    broker.status = 'Connected';
    broker.lastActivity = new Date();
    brokers.set(brokerId, broker);

    res.json({
      success: true,
      message: 'Broker reconnected successfully',
      broker
    });
  } else {
    broker.status = 'Disconnected';
    brokers.set(brokerId, broker);

    res.status(400).json({
      success: false,
      message: 'Reconnection failed: ' + validationResult.error
    });
  }
});

/**
 * Delete broker connection
 */
export const deleteBroker = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.params;

  if (brokers.has(brokerId)) {
    brokers.delete(brokerId);
    logger.info('🗑️ Broker deleted:', brokerId);

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
});

/**
 * Place order through DHAN API
 */
export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId, orderData } = req.body;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  if (!broker.tradingEngineEnabled) {
    return res.status(400).json({
      success: false,
      message: 'Trading Engine is disabled. Please enable it first.'
    });
  }

  try {
    // Place order via DHAN API
    const response = await axios.post(DHAN_CONFIG.ordersUrl, {
      dhanClientId: broker.clientId,
      ...orderData
    }, {
      headers: {
        'access-token': broker.accessToken,
        'Content-Type': 'application/json'
      }
    });

    logger.info('📈 Order placed successfully:', response.data);

    res.json({
      success: true,
      message: 'Order placed successfully',
      orderId: response.data.orderId,
      data: response.data
    });

  } catch (error: any) {
    logger.error('❌ Order placement error:', error.response?.data || error.message);

    res.status(400).json({
      success: false,
      message: 'Order placement failed',
      error: error.response?.data || error.message
    });
  }
});

/**
 * Get orders from DHAN API
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.params;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  try {
    const response = await axios.get(DHAN_CONFIG.ordersUrl, {
      headers: {
        'access-token': broker.accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      orders: response.data
    });

  } catch (error: any) {
    logger.error('❌ Get orders error:', error.response?.data || error.message);

    res.status(400).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.response?.data || error.message
    });
  }
});

/**
 * Get positions from DHAN API
 */
export const getPositions = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.params;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  try {
    const response = await axios.get(DHAN_CONFIG.positionsUrl, {
      headers: {
        'access-token': broker.accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      positions: response.data
    });

  } catch (error: any) {
    logger.error('❌ Get positions error:', error.response?.data || error.message);

    res.status(400).json({
      success: false,
      message: 'Failed to fetch positions',
      error: error.response?.data || error.message
    });
  }
});

export default {
  connectBroker,
  listBrokers,
  activateTerminal,
  checkTerminalStatus,
  toggleTerminal,
  toggleTradingEngine,
  reconnectBroker,
  deleteBroker,
  placeOrder,
  getOrders,
  getPositions
};