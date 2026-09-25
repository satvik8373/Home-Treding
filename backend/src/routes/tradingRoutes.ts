import { Router, Response } from 'express';
import { AuthRequest, authenticate, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { paperTradingManager } from '../execution/PaperTradingManager';
import { riskEngine } from '../risk/RiskEngine';
import { killSwitch } from '../risk/KillSwitch';
import { nifty009Engine } from '../strategies/nifty009/Nifty009Engine';
import { logger } from '../utils/logger';

const router = Router();

let isEngineRunning = true;
let currentTradingMode: 'paper' | 'live' = (process.env.TRADING_MODE === 'live' ? 'live' : 'paper');

// Security ID mapping for common instruments
const DHAN_SECURITY_MAP: Record<string, string> = {
  'NIFTY 50': '13',
  'NIFTY': '13',
  'BANKNIFTY': '25',
  'FINNIFTY': '27',
  'RELIANCE': '2885',
  'HDFCBANK': '1333',
  'TCS': '11536',
  'INFY': '1594',
  'ICICIBANK': '4963',
  'SBIN': '3045',
  'BHARTIARTL': '10604'
};

/**
 * GET /api/trading/mode - Current Global Trading Mode
 */
router.get('/mode', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';
  const adapter = brokerRegistry.getPrimaryAdapter(userId);
  let brokerConnected = false;
  let accountName = 'None';
  let clientId = '';

  if (adapter) {
    try {
      const profile = await adapter.getProfile();
      brokerConnected = true;
      accountName = profile.accountName || 'Dhan Trader';
      clientId = profile.maskedClientId || profile.clientId;
    } catch (_) {
      brokerConnected = true;
      accountName = 'Dhan Connected';
    }
  }

  const isLiveConfigEnabled = process.env.LIVE_TRADING_ENABLED === 'true';

  res.json({
    success: true,
    mode: currentTradingMode,
    isLive: currentTradingMode === 'live',
    isPaper: currentTradingMode === 'paper',
    liveTradingEnabled: isLiveConfigEnabled,
    brokerConnected,
    accountName,
    clientId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/trading/mode - Switch Global Trading Mode
 */
router.post('/mode', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { mode } = req.body;
  if (mode !== 'paper' && mode !== 'live') {
    return res.status(400).json({ success: false, message: 'Invalid mode. Must be "paper" or "live"' });
  }

  const userId = req.userId || (req.body.userId as string) || 'user_admin';

  if (mode === 'live') {
    if (process.env.LIVE_TRADING_ENABLED !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Safety Block: Live real-money trading is disabled on this server. Set LIVE_TRADING_ENABLED=true in server environment to enable.',
        requiresServerFlag: true
      });
    }

    const adapter = brokerRegistry.getPrimaryAdapter(userId);
    if (!adapter) {
      return res.status(400).json({
        success: false,
        message: 'Cannot switch to Live Real-Money trading: No Dhan broker connection found. Please connect your broker first.',
        requiresBroker: true
      });
    }
  }

  currentTradingMode = mode;
  process.env.TRADING_MODE = mode;

  // Sync mode to strategy engines
  try {
    nifty009Engine.setMode(mode);
  } catch (err: any) {
    logger.warn('[TradingRoutes] Error syncing mode with Nifty009Engine:', err.message);
  }

  logger.info(`🌐 [Global Trading Mode] Switched to ${mode.toUpperCase()} MODE by user: ${userId}`);

  res.json({
    success: true,
    mode: currentTradingMode,
    isLive: currentTradingMode === 'live',
    isPaper: currentTradingMode === 'paper',
    liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === 'true',
    message: `Trading mode globally switched to ${mode === 'live' ? '⚡ LIVE REAL MONEY' : '🧪 PAPER TRADING'}`
  });
}));

/**
 * GET /api/trading/orders
 */
router.get('/orders', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'default';
  const brokerId = req.query.brokerId as string | undefined;
  const adapter = brokerId ? brokerRegistry.getAdapterById(brokerId, userId) : brokerRegistry.getPrimaryAdapter(userId);

  if (adapter && currentTradingMode === 'live') {
    try {
      const orders = await adapter.getOrders();
      return res.json({ success: true, orders, source: 'DhanHQ Live Exchange' });
    } catch (e) {
      // fallback to paper orders
    }
  }

  const executor = paperTradingManager.getExecutor(userId);
  const paperOrders = await executor.getOrders();
  res.json({
    success: true,
    orders: paperOrders,
    source: 'Paper Execution Engine'
  });
}));

/**
 * POST /api/trading/orders
 */
router.post('/orders', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default';
  const executor = paperTradingManager.getExecutor(userId);
  const { 
    symbol, 
    side, 
    quantity, 
    price, 
    orderType = 'MARKET', 
    productType = 'INTRADAY', 
    brokerId,
    securityId,
    mode 
  } = req.body;

  if (!symbol || !side || !quantity) {
    return res.status(400).json({ success: false, message: 'Symbol, side, and quantity are required' });
  }

  const effectiveMode = mode || currentTradingMode;
  const cleanSymbol = String(symbol).trim().toUpperCase();
  const cleanSide = String(side).trim().toUpperCase() as 'BUY' | 'SELL';
  const cleanQty = Math.max(1, Number(quantity) || 1);
  const resolvedSecurityId = String(securityId || DHAN_SECURITY_MAP[cleanSymbol] || '13');

  const orderReq = {
    symbol: cleanSymbol,
    side: cleanSide,
    quantity: cleanQty,
    price: price ? Number(price) : undefined,
    orderType,
    productType,
    securityId: resolvedSecurityId,
    validity: 'DAY' as const,
    exchange: (cleanSymbol.includes('NIFTY') && !cleanSymbol.includes('50') ? 'NFO' : 'NSE') as any,
    isPaper: effectiveMode !== 'live'
  };

  // Pre-trade risk check against actual positions
  let currentPos = 0;
  if (effectiveMode === 'live') {
    const liveAdapter = brokerId
      ? brokerRegistry.getAdapterById(brokerId, userId)
      : brokerRegistry.getPrimaryAdapter(userId);
    if (liveAdapter) {
      try {
        const livePositions = await liveAdapter.getPositions();
        currentPos = livePositions.find(p => p.symbol === cleanSymbol || p.positionId.includes(cleanSymbol))?.quantity || 0;
      } catch (_) {}
    }
  } else {
    const positions = await executor.getPositions();
    currentPos = positions.find(p => p.symbol === cleanSymbol)?.quantity || 0;
  }
  const riskCheck = riskEngine.validateOrder(orderReq, currentPos);

  if (!riskCheck.passed) {
    return res.status(400).json({
      success: false,
      message: `Risk check rejected order: ${riskCheck.reason}`,
      ruleViolated: riskCheck.ruleViolated
    });
  }

  // Execute on Live Dhan if live mode
  if (effectiveMode === 'live') {
    const isLiveAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';
    if (!isLiveAllowed) {
      return res.status(403).json({
        success: false,
        isRealMoney: false,
        message: 'Safety Block: Real-money live trading is disabled on this server. Set LIVE_TRADING_ENABLED=true and TRADING_MODE=live in configuration.'
      });
    }

    const adapter = brokerId
      ? brokerRegistry.getAdapterById(brokerId, userId)
      : brokerRegistry.getPrimaryAdapter(userId);

    if (adapter) {
      try {
        logger.info(`[TradingRoutes LIVE] Sending REAL order to Dhan: ${cleanSide} ${cleanQty}x ${cleanSymbol}`);
        const liveResult = await adapter.placeOrder(orderReq);
        return res.json({
          success: liveResult.success,
          isRealMoney: true,
          order: liveResult,
          message: `Live real-money order executed via DhanHQ: ${cleanSide} ${cleanQty} ${cleanSymbol} (ID: ${liveResult.brokerOrderId || liveResult.orderId})`
        });
      } catch (err: any) {
        logger.error(`[TradingRoutes LIVE ERROR]: ${err.message}`);
        return res.status(400).json({
          success: false,
          isRealMoney: true,
          message: `DhanHQ live order failed: ${err.message}`
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Live mode active, but no connected Dhan broker adapter found. Please connect your broker.'
      });
    }
  }

  // Execute on Paper
  const result = await executor.executeOrder(orderReq);
  res.json({
    success: result.success,
    isRealMoney: false,
    order: result,
    message: `Paper order executed successfully: ${cleanSide} ${cleanQty} ${cleanSymbol}`
  });
}));

/**
 * DELETE /api/trading/orders/:orderId
 */
router.delete('/orders/:orderId', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default';
  const executor = paperTradingManager.getExecutor(userId);
  const orderId = String(req.params.orderId);

  if (currentTradingMode === 'live') {
    const adapter = brokerRegistry.getPrimaryAdapter(userId);
    if (adapter) {
      try {
        const success = await adapter.cancelOrder(orderId);
        return res.json({ success, message: success ? 'Live order cancelled on Dhan' : 'Failed to cancel live order' });
      } catch (e: any) {
        return res.status(400).json({ success: false, message: e.message });
      }
    }
  }

  const success = await executor.cancelOrder(orderId);
  res.json({ success, message: success ? 'Order cancelled' : 'Failed to cancel order' });
}));

/**
 * POST /api/trading/positions/squareoff
 * Square off an open position or all open positions
 */
router.post('/positions/squareoff', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default';
  const { symbol, positionId, mode } = req.body;
  const effectiveMode = mode || currentTradingMode;
  const executor = paperTradingManager.getExecutor(userId);

  if (effectiveMode === 'live') {
    const adapter = brokerRegistry.getPrimaryAdapter(userId);
    if (!adapter) {
      return res.status(400).json({ success: false, message: 'No live broker adapter found' });
    }
    const positions = await adapter.getPositions();
    const target = positions.find(p => (symbol && p.symbol === symbol) || (positionId && p.positionId === positionId));
    if (!target || target.quantity === 0) {
      return res.status(404).json({ success: false, message: 'No open position found to square off' });
    }
    const oppositeSide = target.quantity > 0 ? 'SELL' : 'BUY';
    const orderReq = {
      symbol: target.symbol,
      securityId: (target as any).securityId || DHAN_SECURITY_MAP[target.symbol] || '13',
      side: oppositeSide as 'BUY' | 'SELL',
      quantity: Math.abs(target.quantity),
      orderType: 'MARKET' as const,
      productType: (target.productType || 'INTRADAY') as any,
      exchange: (target.symbol.includes('NIFTY') && !target.symbol.includes('50') ? 'NFO' : 'NSE') as any,
      validity: 'DAY' as const,
      isPaper: false
    };
    const orderRes = await adapter.placeOrder(orderReq);
    return res.json({ success: true, message: `Live position ${target.symbol} squared off`, order: orderRes });
  }

  // Paper Mode Square-Off
  const positions = await executor.getPositions();
  const target = positions.find(p => (symbol && p.symbol === symbol) || (positionId && p.positionId === positionId));
  if (!target || target.quantity === 0) {
    return res.status(404).json({ success: false, message: 'No open paper position found to square off' });
  }
  const oppositeSide = target.quantity > 0 ? 'SELL' : 'BUY';
  const orderReq = {
    symbol: target.symbol,
    securityId: (target as any).securityId || DHAN_SECURITY_MAP[target.symbol] || '13',
    side: oppositeSide as 'BUY' | 'SELL',
    quantity: Math.abs(target.quantity),
    orderType: 'MARKET' as const,
    productType: (target.productType || 'INTRADAY') as any,
    exchange: (target.symbol.includes('NIFTY') && !target.symbol.includes('50') ? 'NFO' : 'NSE') as any,
    validity: 'DAY' as const,
    isPaper: true
  };
  const orderRes = await executor.executeOrder(orderReq);
  return res.json({ success: true, message: `Paper position ${target.symbol} squared off`, order: orderRes });
}));

/**
 * GET /api/trading/engine/status
 */
router.get('/engine/status', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string);
  const primary = userId ? brokerRegistry.getPrimaryAdapter(userId) : null;
  let accountName = currentTradingMode === 'live' ? 'Live Dhan Trader' : 'Paper Engine Active';
  if (primary) {
    try {
      const profile = await primary.getProfile();
      accountName = profile.accountName || 'Dhan Trader';
    } catch (e) {
      accountName = 'Dhan Connected';
    }
  }

  res.json({
    success: true,
    status: isEngineRunning ? 'RUNNING' : 'STOPPED',
    isRunning: isEngineRunning,
    mode: currentTradingMode,
    isLive: currentTradingMode === 'live',
    isPaper: currentTradingMode === 'paper',
    liveTradingEnabled: true,
    connectedBroker: accountName,
    killSwitch: killSwitch.getStatus(),
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/trading/engine/start
 */
router.post('/engine/start', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  isEngineRunning = true;
  logger.info(`▶️ [Trading Engine] Started by user ${req.userId || 'trader'}`);
  res.json({ success: true, isRunning: true, message: 'Trading engine started' });
}));

/**
 * POST /api/trading/engine/stop
 */
router.post('/engine/stop', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  isEngineRunning = false;
  logger.info(`⏹️ [Trading Engine] Stopped by user ${req.userId || 'trader'}`);
  res.json({ success: true, isRunning: false, message: 'Trading engine stopped' });
}));

export default router;