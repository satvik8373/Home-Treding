import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { paperExecutor } from '../execution/PaperExecutor';
import { riskEngine } from '../risk/RiskEngine';
import { killSwitch } from '../risk/KillSwitch';
import { logger } from '../utils/logger';

const router = Router();

let isEngineRunning = true;

/**
 * GET /api/trading/orders
 */
router.get('/orders', asyncHandler(async (req: Request, res: Response) => {
  const brokerId = req.query.brokerId as string | undefined;
  const adapter = brokerId ? brokerRegistry.getAdapterById(brokerId) : brokerRegistry.getPrimaryAdapter();

  if (adapter && process.env.TRADING_MODE === 'live') {
    try {
      const orders = await adapter.getOrders();
      return res.json({ success: true, orders, source: 'DhanHQ' });
    } catch (e) {
      // fallback to paper orders
    }
  }

  const paperOrders = await paperExecutor.getOrders();
  res.json({
    success: true,
    orders: paperOrders,
    source: 'Paper Execution Engine'
  });
}));

/**
 * POST /api/trading/orders
 */
router.post('/orders', asyncHandler(async (req: Request, res: Response) => {
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

  // Pre-trade risk check
  const positions = await paperExecutor.getPositions();
  const currentPos = positions.find(p => p.symbol === symbol)?.quantity || 0;
  const riskCheck = riskEngine.validateOrder(orderReq, currentPos);

  if (!riskCheck.passed) {
    return res.status(400).json({
      success: false,
      message: `Risk check rejected order: ${riskCheck.reason}`,
      ruleViolated: riskCheck.ruleViolated
    });
  }

  // Execute on Paper
  const result = await paperExecutor.executeOrder(orderReq);
  res.json({
    success: result.success,
    order: result,
    message: 'Paper order executed successfully'
  });
}));

/**
 * DELETE /api/trading/orders/:orderId
 */
router.delete('/orders/:orderId', asyncHandler(async (req: Request, res: Response) => {
  const orderId = String(req.params.orderId);
  const success = await paperExecutor.cancelOrder(orderId);
  res.json({ success, message: success ? 'Order cancelled' : 'Failed to cancel order' });
}));

/**
 * GET /api/trading/engine/status
 */
router.get('/engine/status', asyncHandler(async (_req: Request, res: Response) => {
  const primary = brokerRegistry.getPrimaryAdapter();
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
router.post('/engine/start', asyncHandler(async (_req: Request, res: Response) => {
  isEngineRunning = true;
  logger.info('▶️ [Trading Engine] Started');
  res.json({ success: true, isRunning: true, message: 'Trading engine started' });
}));

/**
 * POST /api/trading/engine/stop
 */
router.post('/engine/stop', asyncHandler(async (_req: Request, res: Response) => {
  isEngineRunning = false;
  logger.info('⏹️ [Trading Engine] Stopped');
  res.json({ success: true, isRunning: false, message: 'Trading engine stopped' });
}));

export default router;