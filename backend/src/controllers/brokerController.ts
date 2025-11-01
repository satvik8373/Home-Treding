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
 * Generate Dhan Partner Login URL for Terminal Activation (OAuth Flow)
 */
export const getDhanLoginUrl = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.body;

  const broker = brokers.get(brokerId);
  if (!broker) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  try {
    // Generate secure state token for OAuth flow
    const state = Math.random().toString(36).substring(2, 15);
    const redirectUri = 'http://localhost:3000/dhan-callback';
    
    // Store state for verification
    broker.loginState = state;
    broker.oauthRedirectUri = redirectUri;
    brokers.set(brokerId, broker);

    // Use Dhan Partner Login URL with consent flow
    // This is the official Dhan OAuth URL for partner integrations
    const loginUrl = `https://partner-login.dhan.co/?consentID=17effb14-7a79-4137-8063-4b656c53d465&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&client_id=${broker.clientId}`;

    logger.info('🔗 Generated Dhan Partner OAuth login URL for terminal activation:', brokerId);

    res.json({
      success: true,
      loginUrl,
      state,
      redirectUri,
      message: 'Dhan Partner OAuth login URL generated for terminal activation'
    });

  } catch (error: any) {
    logger.error('❌ OAuth login URL generation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to generate OAuth login URL',
      error: error.message
    });
  }
});

/**
 * Handle Dhan OAuth Callback and Exchange Code for Access Token
 */
export const handleDhanCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state, brokerId } = req.body;

  try {
    logger.info('🔄 Processing Dhan OAuth callback:', { code: code?.substring(0, 10) + '...', state, brokerId });

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state parameter'
      });
    }

    // Find broker by state if brokerId not provided
    let broker;
    if (brokerId) {
      broker = brokers.get(brokerId);
    } else {
      // Find broker by state
      for (const [id, b] of brokers.entries()) {
        if (b.loginState === state) {
          broker = b;
          break;
        }
      }
    }

    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found or invalid state parameter'
      });
    }

    // Verify state matches
    if (broker.loginState !== state) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter - possible CSRF attack'
      });
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code, broker.oauthRedirectUri);

    if (tokenResponse.success) {
      // Update broker with new access token
      broker.accessToken = tokenResponse.accessToken;
      broker.refreshToken = tokenResponse.refreshToken;
      broker.tokenExpiresAt = tokenResponse.expiresAt;
      broker.terminalActivated = true;
      broker.terminalEnabled = true;
      broker.status = 'Connected';
      broker.lastActivity = new Date();
      
      // Clear OAuth state
      delete broker.loginState;
      delete broker.oauthRedirectUri;
      
      brokers.set(broker.id, broker);

      logger.info('✅ Dhan OAuth flow completed successfully for broker:', broker.id);

      res.json({
        success: true,
        message: 'Terminal activated successfully via OAuth!',
        broker: {
          id: broker.id,
          broker: broker.broker,
          clientId: broker.clientId,
          status: broker.status,
          terminalActivated: broker.terminalActivated,
          terminalEnabled: broker.terminalEnabled
        }
      });
    } else {
      logger.error('❌ Token exchange failed:', tokenResponse.error);
      
      res.status(400).json({
        success: false,
        message: 'Failed to exchange authorization code for access token',
        error: tokenResponse.error
      });
    }

  } catch (error: any) {
    logger.error('❌ OAuth callback processing error:', error.message);
    res.status(500).json({
      success: false,
      message: 'OAuth callback processing failed',
      error: error.message
    });
  }
});

/**
 * Exchange authorization code for access token (Dhan OAuth)
 */
async function exchangeCodeForToken(code: string, redirectUri: string) {
  try {
    // Dhan OAuth token exchange endpoint
    const tokenUrl = 'https://api.dhan.co/v2/oauth/token';
    
    const response = await axios.post(tokenUrl, {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: process.env.DHAN_CLIENT_ID, // Your registered client ID
      client_secret: process.env.DHAN_CLIENT_SECRET // Your client secret
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.access_token) {
      return {
        success: true,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + (response.data.expires_in * 1000))
      };
    } else {
      return {
        success: false,
        error: 'No access token received from Dhan'
      };
    }

  } catch (error: any) {
    logger.error('Token exchange error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.error_description || error.message
    };
  }
}

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

  if (!broker.terminalActivated) {
    return res.status(400).json({
      success: false,
      message: 'Terminal not activated. Please activate terminal first.'
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

    // Handle different Dhan API response formats
    let rawOrders = [];
    if (Array.isArray(response.data)) {
      rawOrders = response.data;
    } else if (response.data.data && Array.isArray(response.data.data)) {
      rawOrders = response.data.data;
    } else if (response.data.orders && Array.isArray(response.data.orders)) {
      rawOrders = response.data.orders;
    } else if (response.data) {
      rawOrders = [response.data];
    }

    // Map Dhan API fields to frontend expected format
    const orders = rawOrders.map((order: any) => ({
      orderId: order.orderId || order.order_id || order.id || order.DHAN_ORDER_ID || '',
      symbol: order.securityId || order.symbol || order.symbol || '',
      side: order.transactionType || order.side || (order.orderType === 'BUY' ? 'BUY' : 'SELL'),
      quantity: order.quantity || order.qty || order.orderQuantity || 0,
      price: order.price || order.orderPrice || order.limitPrice || 0,
      status: order.orderStatus || order.status || (order.status === 'FILLED' ? 'EXECUTED' : order.status || 'PENDING'),
      time: order.orderTimestamp || order.timestamp || order.time || new Date().toLocaleTimeString(),
      orderType: order.orderType || order.type || 'LIMIT'
    }));

    logger.info(`📋 Fetched ${orders.length} orders for broker ${brokerId}`);

    res.json({
      success: true,
      orders: orders
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
  getDhanLoginUrl,
  checkTerminalStatus,
  toggleTerminal,
  toggleTradingEngine,
  reconnectBroker,
  deleteBroker,
  placeOrder,
  getOrders,
  getPositions
};