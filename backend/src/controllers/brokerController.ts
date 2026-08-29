import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { DhanAuthService } from '../brokers/dhan/auth';
import { DhanAdapter } from '../brokers/dhan/DhanAdapter';
import { dhanPostbackService } from '../brokers/dhan/postback';
import { logger } from '../utils/logger';

/**
 * Connect a broker with Client ID and Access Token
 */
export const connectBroker = asyncHandler(async (req: Request, res: Response) => {
  const { broker = 'dhan', clientId, accessToken, userId = 'default' } = req.body;

  if (!clientId || !accessToken) {
    return res.status(400).json({
      success: false,
      message: 'Client ID and Access Token are required'
    });
  }

  try {
    logger.info(`[BrokerController] Connecting broker "${broker}" for client "${clientId}"`);
    const profile = await brokerRegistry.connectBroker({
      userId,
      broker: broker.toLowerCase() as any,
      clientId,
      accessToken
    });

    res.json({
      success: true,
      message: 'Broker connected and validated successfully',
      broker: {
        id: `${userId}_${broker.toLowerCase()}_${clientId}`,
        broker: broker,
        clientId: profile.clientId,
        maskedClientId: profile.maskedClientId,
        accountName: profile.accountName,
        status: profile.status,
        terminalEnabled: profile.terminalActivated,
        tradingEngineEnabled: true,
        connectedAt: profile.connectedAt
      }
    });
  } catch (error: any) {
    logger.error('[BrokerController] Connection failed:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to connect broker'
    });
  }
});

/**
 * List all connected brokers (Sanitized - no plaintext tokens)
 */
export const listBrokers = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || undefined;
  const list = brokerRegistry.listConnections(userId);

  const formattedBrokers = list.map(b => ({
    id: b.id,
    broker: b.broker.toUpperCase(),
    clientId: b.clientId,
    maskedClientId: b.maskedClientId,
    accountName: b.accountName,
    status: b.status,
    terminalEnabled: b.terminalActivated,
    tradingEngineEnabled: true,
    connectedAt: b.connectedAt,
    lastActivity: b.lastHeartbeat
  }));

  res.json({
    success: true,
    brokers: formattedBrokers
  });
});

/**
 * Generate Dhan Partner OAuth Login URL
 */
export const getDhanLoginUrl = asyncHandler(async (req: Request, res: Response) => {
  const { clientId } = req.body;
  const state = Math.random().toString(36).substring(2, 15);
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dhan-callback`;
  const consentId = process.env.DHAN_CONSENT_ID || '17effb14-7a79-4137-8063-4b656c53d465';

  const loginUrl = DhanAuthService.generateConsentUrl({
    consentId,
    redirectUri,
    state,
    clientId
  });

  res.json({
    success: true,
    loginUrl,
    state,
    redirectUri,
    message: 'Dhan Partner OAuth login URL generated'
  });
});

/**
 * Handle Dhan OAuth Callback
 */
export const handleDhanCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, userId = 'default', clientId } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code is required'
    });
  }

  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dhan-callback`;
  const tokenResult = await DhanAuthService.exchangeCodeForToken({
    code,
    redirectUri,
    partnerClientId: process.env.DHAN_PARTNER_ID || clientId || 'partner_id',
    partnerClientSecret: process.env.DHAN_PARTNER_SECRET || 'partner_secret'
  });

  if (!tokenResult.success || !tokenResult.accessToken) {
    return res.status(400).json({
      success: false,
      message: tokenResult.error || 'Token exchange failed'
    });
  }

  const profile = await brokerRegistry.connectBroker({
    userId,
    broker: 'dhan',
    clientId: clientId || 'dhan_user',
    accessToken: tokenResult.accessToken
  });

  res.json({
    success: true,
    message: 'Dhan OAuth authentication successful',
    profile
  });
});

/**
 * Get broker funds
 */
export const getFunds = asyncHandler(async (req: Request, res: Response) => {
  const brokerId = (req.params.brokerId || req.query.brokerId) as string;
  const adapter = brokerId ? brokerRegistry.getAdapterById(brokerId) : brokerRegistry.getAdapter('default', 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker adapter not found or not connected'
    });
  }

  const funds = await adapter.getFunds();
  res.json({
    success: true,
    funds
  });
});

/**
 * Get broker positions
 */
export const getPositions = asyncHandler(async (req: Request, res: Response) => {
  const brokerId = (req.params.brokerId || req.query.brokerId) as string;
  const adapter = brokerId ? brokerRegistry.getAdapterById(brokerId) : brokerRegistry.getAdapter('default', 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker adapter not found or not connected'
    });
  }

  const positions = await adapter.getPositions();
  res.json({
    success: true,
    positions
  });
});

/**
 * Get broker orders
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const brokerId = (req.params.brokerId || req.query.brokerId) as string;
  const adapter = brokerId ? brokerRegistry.getAdapterById(brokerId) : brokerRegistry.getAdapter('default', 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker adapter not found or not connected'
    });
  }

  const orders = await adapter.getOrders();
  res.json({
    success: true,
    orders
  });
});

/**
 * Disconnect and remove broker
 */
export const deleteBroker = asyncHandler(async (req: Request, res: Response) => {
  const brokerId = String(req.params.brokerId);
  await brokerRegistry.disconnectBroker('default', brokerId);

  res.json({
    success: true,
    message: 'Broker disconnected and removed successfully'
  });
});

/**
 * Terminal status check
 */
export const checkTerminalStatus = asyncHandler(async (req: Request, res: Response) => {
  const { brokerId } = req.body;
  const adapter = brokerId ? brokerRegistry.getAdapterById(brokerId) : brokerRegistry.getAdapter('default', 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker not found'
    });
  }

  try {
    const profile = await adapter.getProfile();
    const funds = await adapter.getFunds();
    const positions = await adapter.getPositions();
    const orders = await adapter.getOrders();

    res.json({
      success: true,
      accountInfo: {
        clientId: profile.clientId,
        maskedClientId: profile.maskedClientId,
        status: 'Connected',
        terminalActivated: profile.terminalActivated,
        availableMargin: funds.availableMargin,
        totalOrders: orders.length,
        activePositions: positions.length,
        lastActivity: new Date().toISOString()
      },
      recentActivity: {
        orders: orders.slice(0, 5),
        positions: positions.slice(0, 5)
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to check terminal status'
    });
  }
});

// --- DhanHQ v2 Advanced Handlers ---

/**
 * POST /api/brokers/option-chain
 */
export const getOptionChain = asyncHandler(async (req: Request, res: Response) => {
  const { underlyingSecurityId = '13', expiry } = req.body;
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;

  if (!adapter || typeof adapter.getOptionChain !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  const chain = await adapter.getOptionChain(underlyingSecurityId, expiry);
  res.json({ success: true, optionChain: chain });
});

/**
 * POST /api/brokers/option-chain/expiries
 */
export const getOptionExpiries = asyncHandler(async (req: Request, res: Response) => {
  const { underlyingSecurityId = '13' } = req.body;
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;

  if (!adapter || typeof adapter.getExpiryList !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  const expiries = await adapter.getExpiryList(underlyingSecurityId);
  res.json({ success: true, expiries });
});

/**
 * POST /api/brokers/margin-calculator
 */
export const calculateMargin = asyncHandler(async (req: Request, res: Response) => {
  const { order, orders } = req.body;
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;

  if (!adapter || typeof adapter.calculateMargin !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  if (orders && Array.isArray(orders)) {
    const margin = await adapter.calculateMultiMargin(orders);
    return res.json({ success: true, margin });
  }

  const margin = await adapter.calculateMargin(order);
  res.json({ success: true, margin });
});

/**
 * POST /api/brokers/super-orders
 */
export const placeSuperOrder = asyncHandler(async (req: Request, res: Response) => {
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;
  if (!adapter || typeof adapter.placeSuperOrder !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  const result = await adapter.placeSuperOrder(req.body);
  res.json(result);
});

/**
 * POST /api/brokers/forever-orders
 */
export const placeForeverOrder = asyncHandler(async (req: Request, res: Response) => {
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;
  if (!adapter || typeof adapter.placeForeverOrder !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  const result = await adapter.placeForeverOrder(req.body);
  res.json(result);
});

/**
 * POST /api/brokers/conditional-triggers
 */
export const placeConditionalTrigger = asyncHandler(async (req: Request, res: Response) => {
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;
  if (!adapter || typeof adapter.placeConditionalTrigger !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  const result = await adapter.placeConditionalTrigger(req.body);
  res.json(result);
});

/**
 * GET /api/brokers/statements/ledger
 */
export const getStatements = asyncHandler(async (req: Request, res: Response) => {
  const { fromDate, toDate } = req.query as { fromDate: string; toDate: string };
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;

  if (!adapter || typeof adapter.getLedger !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  const ledger = await adapter.getLedger(fromDate || new Date().toISOString().split('T')[0], toDate || new Date().toISOString().split('T')[0]);
  res.json({ success: true, ledger });
});

/**
 * POST /api/brokers/postback (Dhan webhook endpoint)
 */
export const handlePostback = asyncHandler(async (req: Request, res: Response) => {
  dhanPostbackService.processWebhook(req.body);
  res.json({ success: true, status: 'RECEIVED' });
});

/**
 * POST /api/brokers/killswitch
 */
export const toggleKillSwitch = asyncHandler(async (req: Request, res: Response) => {
  const adapter = brokerRegistry.getPrimaryAdapter() as DhanAdapter;
  if (!adapter || typeof adapter.activateKillSwitch !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker adapter not connected' });
  }

  const result = await adapter.activateKillSwitch();
  res.json({ success: result, message: result ? 'Kill switch activated on Dhan' : 'Failed to activate kill switch' });
});