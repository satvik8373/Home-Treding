import { Router, Response } from 'express';
import { AuthRequest, authenticate, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { paperTradingManager } from '../execution/PaperTradingManager';
import { riskEngine } from '../risk/RiskEngine';
import { killSwitch } from '../risk/KillSwitch';
import { logger } from '../utils/logger';

const router = Router();

let isEngineRunning = true;

/**
 * GET /api/trading/orders
 */
router.get('/orders', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'default';
  const brokerId = req.query.brokerId as string | undefined;
  const adapter = brokerId ? brokerRegistry.getAdapterById(brokerId, userId) : brokerRegistry.getPrimaryAdapter(userId);

  if (adapter && process.env.TRADING_MODE === 'live') {
    try {
      const orders = await adapter.getOrders();
      return res.json({ success: true, orders, source: 'DhanHQ' });
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
router.post('/orders', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default';
  const executor = paperTradingManager.getExecutor(userId);
  const { symbol, side, quantity, price, orderType = 'MARKET', productType = 'INTRADAY', brokerId } = req.body;

  if (!symbol || !side || !quantity) {
    return res.status(400).json({ success: false, message: 'Symbol, side, and quantity are required' });
  }

  const orderReq = {
    symbol,
    side,
    quantity: Number(quantity),
    price: price ? Number(price) : undefined,
    orderType,
    productType,
    validity: 'DAY' as const,
    exchange: 'NSE' as const,
    isPaper: process.env.TRADING_MODE !== 'live'
  };

  // Pre-trade risk check for this specific user's current positions
  const positions = await executor.getPositions();
  const currentPos = positions.find(p => p.symbol === symbol)?.quantity || 0;
  const riskCheck = riskEngine.validateOrder(orderReq, currentPos);

  if (!riskCheck.passed) {
    return res.status(400).json({
      success: false,
      message: `Risk check rejected order: ${riskCheck.reason}`,
      ruleViolated: riskCheck.ruleViolated
    });
  }

  // Execute on Live Dhan if live mode and adapter connected
  if (process.env.TRADING_MODE === 'live') {
    const adapter = brokerId
      ? brokerRegistry.getAdapterById(brokerId, userId)
      : brokerRegistry.getPrimaryAdapter(userId);

    if (adapter) {
      try {
        const liveResult = await adapter.placeOrder(orderReq);
        return res.json({
          success: liveResult.success,
          order: liveResult,
          message: 'Live order executed via DhanHQ'
        });
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: `DhanHQ order failed: ${err.message}`
        });
      }
    }
  }

  // Execute on Paper
  const result = await executor.executeOrder(orderReq);
  res.json({
    success: result.success,
    order: result,
    message: 'Paper order executed successfully'
  });
}));

/**
 * DELETE /api/trading/orders/:orderId
 */
router.delete('/orders/:orderId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default';
  const executor = paperTradingManager.getExecutor(userId);
  const orderId = String(req.params.orderId);
  const success = await executor.cancelOrder(orderId);
  res.json({ success, message: success ? 'Order cancelled' : 'Failed to cancel order' });
}));

/**
 * GET /api/trading/engine/status
 */
router.get('/engine/status', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string);
  const primary = userId ? brokerRegistry.getPrimaryAdapter(userId) : null;
  let accountName = 'None (Paper Mode Active)';
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
    mode: process.env.TRADING_MODE || 'paper',
    liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === 'true',
    connectedBroker: accountName,
    killSwitch: killSwitch.getStatus(),
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/trading/engine/start
 */
router.post('/engine/start', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  isEngineRunning = true;
  logger.info(`▶️ [Trading Engine] Started by user ${req.userId}`);
  res.json({ success: true, isRunning: true, message: 'Trading engine started' });
}));

/**
 * POST /api/trading/engine/stop
 */
router.post('/engine/stop', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  isEngineRunning = false;
  logger.info(`⏹️ [Trading Engine] Stopped by user ${req.userId}`);
  res.json({ success: true, isRunning: false, message: 'Trading engine stopped' });
}));

export default router;