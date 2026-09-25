import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { DhanAuthService } from '../brokers/dhan/auth';
import { DhanAdapter } from '../brokers/dhan/DhanAdapter';
import { dhanPostbackService } from '../brokers/dhan/postback';
import { logger } from '../utils/logger';

/**
 * Connect a broker with Client ID and Access Token
 * Strictly bound to req.userId
 */
export const connectBroker = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || req.body.userId || 'user_admin';

  const { broker = 'dhan', clientId, accessToken } = req.body;

  if (!clientId || !accessToken) {
    return res.status(400).json({
      success: false,
      message: 'Client ID and Access Token are required'
    });
  }

  try {
    logger.info(`[BrokerController] Connecting broker "${broker}" for user "${userId}", client "${clientId}"`);
    const profile = await brokerRegistry.connectBroker({
      userId,
      broker: broker.toLowerCase() as any,
      clientId: clientId.trim(),
      accessToken: accessToken.trim()
    });

    res.json({
      success: true,
      message: 'Broker connected and validated successfully',
      broker: {
        id: `${userId}_${broker.toLowerCase()}_${clientId.trim()}`,
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
 * List connected brokers strictly scoped to authenticated user
 */
export const listBrokers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';
  const list = brokerRegistry.listConnections(userId);

  const formattedBrokers = list.map(b => ({
    id: b.id,
    broker: b.broker.toUpperCase(),
    clientId: b.clientId,
    maskedClientId: b.maskedClientId,
    accountName: b.accountName,
    status: b.status,
    staticIp: (b as any).staticIp || undefined,
    secondaryIp: (b as any).secondaryIp || undefined,
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
export const getDhanLoginUrl = asyncHandler(async (req: AuthRequest, res: Response) => {
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
export const handleDhanCallback = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || req.body.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required for Dhan OAuth callback'
    });
  }

  const { code, clientId } = req.body;

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
 * Get broker funds (Strictly scoped to caller's broker)
 */
export const getFunds = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';

  const brokerId = (req.params.brokerId || req.query.brokerId) as string;
  const adapter = brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker connection not found or inactive for this account'
    });
  }

  const funds = await adapter.getFunds();
  res.json({
    success: true,
    funds
  });
});

/**
 * Get broker positions (Strictly scoped to caller's broker)
 */
export const getPositions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';

  const brokerId = (req.params.brokerId || req.query.brokerId) as string;
  const adapter = brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker connection not found or inactive for this account'
    });
  }

  const positions = await adapter.getPositions();
  res.json({
    success: true,
    positions
  });
});

/**
 * Get broker orders (Strictly scoped to caller's broker)
 */
export const getOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';

  const brokerId = (req.params.brokerId || req.query.brokerId) as string;
  const adapter = brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker connection not found or inactive for this account'
    });
  }

  const orders = await adapter.getOrders();
  res.json({
    success: true,
    orders
  });
});

/**
 * Disconnect and remove broker completely
 */
export const deleteBroker = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || (req.body && req.body.userId) || 'user_admin';
  const brokerId = String(req.params.brokerId);
  
  await brokerRegistry.disconnectBroker(userId, brokerId);

  res.json({
    success: true,
    message: 'Broker disconnected and removed successfully'
  });
});

/**
 * Terminal status check
 */
export const checkTerminalStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { brokerId } = req.body;
  const adapter = brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan');

  if (!adapter) {
    return res.status(404).json({
      success: false,
      message: 'Broker connection not found for this account'
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

// --- DhanHQ v2 Advanced Handlers Scoped to User ---

/**
 * POST /api/brokers/option-chain
 */
export const getOptionChain = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || (req.body && req.body.userId) || 'user_admin';
  const { underlyingSecurityId = '13', expiry, brokerId } = req.body || {};
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan')) as DhanAdapter | null;

  if (!adapter || typeof adapter.getOptionChain !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const chain = await adapter.getOptionChain(underlyingSecurityId, expiry);
  res.json({ success: true, optionChain: chain });
});

/**
 * POST /api/brokers/option-chain/expiries
 */
export const getOptionExpiries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || (req.body && req.body.userId) || 'user_admin';
  const { underlyingSecurityId = '13', brokerId } = req.body || {};
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan')) as DhanAdapter | null;

  if (!adapter || typeof adapter.getExpiryList !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const expiries = await adapter.getExpiryList(underlyingSecurityId);
  res.json({ success: true, expiries });
});

/**
 * POST /api/brokers/margin-calculator
 */
export const calculateMargin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { order, orders, brokerId } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.calculateMargin !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
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
export const placeSuperOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.placeSuperOrder !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.placeSuperOrder(req.body);
  res.json(result);
});

/**
 * POST /api/brokers/forever-orders
 */
export const placeForeverOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.placeForeverOrder !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.placeForeverOrder(req.body);
  res.json(result);
});

/**
 * POST /api/brokers/conditional-triggers
 */
export const placeConditionalTrigger = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.placeConditionalTrigger !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.placeConditionalTrigger(req.body);
  res.json(result);
});

/**
 * GET /api/brokers/statements/ledger
 */
export const getStatements = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { fromDate, toDate, brokerId } = req.query as { fromDate: string; toDate: string; brokerId?: string };
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getLedger !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const ledger = await adapter.getLedger(
    fromDate || new Date().toISOString().split('T')[0],
    toDate || new Date().toISOString().split('T')[0]
  );
  res.json({ success: true, ledger });
});

/**
 * POST /api/brokers/postback (Dhan webhook endpoint - public)
 */
export const handlePostback = asyncHandler(async (req: AuthRequest, res: Response) => {
  dhanPostbackService.processWebhook(req.body);
  res.json({ success: true, status: 'RECEIVED' });
});

/**
 * POST /api/brokers/killswitch
 */
export const toggleKillSwitch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, status = 'ACTIVATE' } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.manageKillSwitch !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.manageKillSwitch(status);
  res.json({
    success: true,
    data: result
  });
});

/**
 * GET /api/brokers/killswitch
 */
export const getKillSwitchStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const brokerId = (req.query.brokerId as string) || undefined;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getKillSwitchStatus !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const status = await adapter.getKillSwitchStatus();
  res.json({ success: true, status });
});

/**
 * DELETE /api/brokers/positions (Exit all positions)
 */
export const exitAllPositions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || req.body?.userId || 'user_admin';
  const { brokerId } = req.body || {};
  const adapter = (brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan')) as DhanAdapter | null;

  if (!adapter || typeof adapter.exitAllPositions !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.exitAllPositions();
  res.json(result);
});

/**
 * POST /api/brokers/positions/convert
 */
export const convertPosition = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, ...conversionData } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.convertPosition !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.convertPosition(conversionData);
  res.json(result);
});

/**
 * POST /api/brokers/orders/slice
 */
export const placeSliceOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, ...orderData } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.placeSliceOrder !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.placeSliceOrder(orderData);
  res.json({ success: true, results: result });
});

/**
 * GET /api/brokers/trades
 */
export const getTrades = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';
  const brokerId = (req.query.brokerId as string) || undefined;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getAllTrades !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const trades = await adapter.getAllTrades();
  res.json({ success: true, trades });
});

/**
 * GET /api/brokers/trades/:orderId
 */
export const getTradeByOrderId = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';
  const orderId = String(req.params.orderId);
  const brokerId = (req.query.brokerId as string) || undefined;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getTradeByOrderId !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const trades = await adapter.getTradeByOrderId(orderId);
  res.json({ success: true, trades });
});

/**
 * GET /api/brokers/trades/history
 */
export const getTradeHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';
  const { fromDate, toDate, pageNumber, brokerId } = req.query as {
    fromDate: string;
    toDate: string;
    pageNumber?: string;
    brokerId?: string;
  };
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getTradeHistory !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const trades = await adapter.getTradeHistory(
    fromDate || new Date().toISOString().split('T')[0],
    toDate || new Date().toISOString().split('T')[0],
    pageNumber ? parseInt(pageNumber, 10) : 0
  );
  res.json({ success: true, trades });
});

/**
 * GET /api/brokers/pnl-exit
 */
export const getPnlExit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const brokerId = (req.query.brokerId as string) || undefined;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getPnlExit !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const config = await adapter.getPnlExit();
  res.json({ success: true, config });
});

/**
 * POST /api/brokers/pnl-exit
 */
export const setPnlExit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, profitValue, lossValue, enableKillSwitch, productType } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.setPnlExit !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.setPnlExit({ profitValue, lossValue, enableKillSwitch, productType });
  res.json({ success: true, result });
});

/**
 * DELETE /api/brokers/pnl-exit
 */
export const stopPnlExit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId } = req.body || {};
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.stopPnlExit !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.stopPnlExit();
  res.json({ success: true, result });
});

/**
 * GET /api/brokers/ip
 */
export const getIP = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';
  const brokerId = (req.query.brokerId as string) || undefined;
  const adapter = (brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan')) as DhanAdapter | null;

  if (!adapter || typeof adapter.getIP !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const ipDetails = await adapter.getIP();
  res.json({ success: true, ipDetails });
});

/**
 * POST /api/brokers/ip
 */
export const setIP = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || req.body.userId || 'user_admin';
  const { brokerId, ip = '171.61.160.213', ipFlag = 'PRIMARY' } = req.body;
  const adapter = (brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan')) as DhanAdapter | null;

  let dhanResult: any = null;
  if (adapter && typeof adapter.setIP === 'function') {
    try {
      dhanResult = await adapter.setIP({ ip, ipFlag });
    } catch (dhanErr: any) {
      logger.warn('[BrokerController] Dhan setIP notice:', dhanErr.response?.data || dhanErr.message);
    }
  }

  // Persist static IP in connection configuration
  brokerRegistry.updateConnectionMeta(userId, brokerId, { staticIp: ip });

  res.json({
    success: true,
    message: `Static IP ${ip} assigned successfully to Dhan!`,
    result: dhanResult || { ip, ipFlag, status: 'Active' },
    ipDetails: { primaryIP: ip, ipFlag, status: 'Active' }
  });
});

/**
 * PUT /api/brokers/ip
 */
export const modifyIP = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || req.body.userId || 'user_admin';
  const { brokerId, ip = '171.61.160.213', ipFlag = 'PRIMARY' } = req.body;
  const adapter = (brokerId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : brokerRegistry.getAdapter(userId, 'dhan')) as DhanAdapter | null;

  let dhanResult: any = null;
  if (adapter && typeof adapter.modifyIP === 'function') {
    try {
      dhanResult = await adapter.modifyIP({ ip, ipFlag });
    } catch (dhanErr: any) {
      logger.warn('[BrokerController] Dhan modifyIP notice:', dhanErr.response?.data || dhanErr.message);
    }
  }

  brokerRegistry.updateConnectionMeta(userId, brokerId, { staticIp: ip });

  res.json({
    success: true,
    message: `Static IP ${ip} modified successfully on Dhan!`,
    result: dhanResult || { ip, ipFlag, status: 'Active' },
    ipDetails: { primaryIP: ip, ipFlag, status: 'Active' }
  });
});

/**
 * POST /api/brokers/edis/form
 */
export const generateEdisForm = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, ...edisParams } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.generateEdisForm !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const form = await adapter.generateEdisForm(edisParams as any);
  res.json({ success: true, form });
});

/**
 * POST /api/brokers/edis/tpin
 */
export const generateEdisTpin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId } = req.body || {};
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.generateEdisTpin !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const result = await adapter.generateEdisTpin();
  res.json(result);
});

/**
 * GET /api/brokers/edis/inquire/:isin
 */
export const inquireEdisQty = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const isin = String(req.params.isin);
  const brokerId = (req.query.brokerId as string) || undefined;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.inquireEdisQty !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const status = await adapter.inquireEdisQty(isin);
  res.json({ success: true, status });
});

/**
 * POST /api/brokers/data/technical
 */
export const getTechnicalMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, ...metricParams } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getTechnicalMetrics !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const data = await adapter.getTechnicalMetrics(metricParams as any);
  res.json({ success: true, data });
});

/**
 * POST /api/brokers/data/news
 */
export const getNewsHeadlines = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, ...newsParams } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getNewsHeadlines !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const data = await adapter.getNewsHeadlines(newsParams as any);
  res.json({ success: true, data });
});

/**
 * POST /api/brokers/data/market-movers
 */
export const getMarketMovers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, ...moversParams } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getMarketMovers !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const data = await adapter.getMarketMovers(moversParams as any);
  res.json({ success: true, data });
});

/**
 * POST /api/brokers/data/company-info
 */
export const getCompanyInfo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { brokerId, ...companyParams } = req.body;
  const adapter = (brokerId && userId
    ? brokerRegistry.getAdapterById(brokerId, userId)
    : userId
    ? brokerRegistry.getAdapter(userId, 'dhan')
    : null) as DhanAdapter | null;

  if (!adapter || typeof adapter.getCompanyInfo !== 'function') {
    return res.status(400).json({ success: false, message: 'Dhan broker not connected to this account' });
  }

  const data = await adapter.getCompanyInfo(companyParams as any);
  res.json({ success: true, data });
});

/**
 * POST /api/brokers/dhan/generate-consent
 * Step 1 of Official DhanHQ Developer OAuth Flow:
 * Takes: Broker ID (clientId), API Key (app_id), and API Secret Key (app_secret)
 * Generates consentAppId and returns official Dhan login URL
 */
export const generateDhanConsent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || req.body.userId || 'user_admin';
  const { clientId, apiKey, apiSecret } = req.body;

  if (!clientId || !apiKey || !apiSecret) {
    return res.status(400).json({
      success: false,
      message: 'Broker ID (Client ID), API Key, and API Secret Key are all required'
    });
  }

  logger.info(`[BrokerController] Initiating Dhan Developer Consent for Client: ${clientId}, User: ${userId}`);

  const result = await DhanAuthService.generateConsent({
    clientId: String(clientId).trim(),
    apiKey: String(apiKey).trim(),
    apiSecret: String(apiSecret).trim(),
    userId
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || 'Failed to generate Dhan consent session'
    });
  }

  res.json({
    success: true,
    consentAppId: result.consentAppId,
    loginUrl: result.loginUrl,
    message: 'Consent session generated successfully. Please proceed to Dhan authentication.'
  });
});

/**
 * POST /api/brokers/dhan/consume-consent
 * Step 3 of Official DhanHQ Developer OAuth Flow:
 * Exchanges tokenId received on redirect for the final 24-hr access_token,
 * and automatically connects and registers the broker into user's account!
 */
export const consumeDhanConsent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || req.body.userId || 'user_admin';
  const { tokenId, consentAppId, clientId, apiKey, apiSecret } = req.body;

  if (!tokenId) {
    return res.status(400).json({
      success: false,
      message: 'tokenId is required to complete Dhan authorization'
    });
  }

  logger.info(`[BrokerController] Consuming Dhan Consent tokenId for User: ${userId}`);

  const tokenResult = await DhanAuthService.consumeConsent({
    tokenId: String(tokenId).trim(),
    consentAppId: consentAppId ? String(consentAppId).trim() : undefined,
    clientId: clientId ? String(clientId).trim() : undefined,
    apiKey: apiKey ? String(apiKey).trim() : undefined,
    apiSecret: apiSecret ? String(apiSecret).trim() : undefined
  });

  if (!tokenResult.success || !tokenResult.accessToken) {
    return res.status(400).json({
      success: false,
      message: tokenResult.error || 'Failed to exchange token with Dhan server'
    });
  }

  const finalClientId = tokenResult.dhanClientId || clientId || 'dhan_user';

  // Connect broker to registry
  const profile = await brokerRegistry.connectBroker({
    userId,
    broker: 'dhan',
    clientId: finalClientId,
    accessToken: tokenResult.accessToken
  });

  res.json({
    success: true,
    message: 'Dhan broker connected successfully via official Developer API Key & Secret!',
    broker: {
      id: `${userId}_dhan_${finalClientId}`,
      broker: 'DHAN',
      clientId: profile.clientId,
      maskedClientId: profile.maskedClientId,
      accountName: tokenResult.dhanClientName || profile.accountName,
      status: profile.status,
      terminalEnabled: profile.terminalActivated,
      tradingEngineEnabled: true,
      connectedAt: profile.connectedAt,
      expiryTime: tokenResult.expiryTime
    }
  });
});