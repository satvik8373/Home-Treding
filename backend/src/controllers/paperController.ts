import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { paperTradingManager } from '../execution/PaperTradingManager';
import { riskEngine } from '../risk/RiskEngine';

/**
 * Place a paper trading virtual order strictly for authenticated user
 */
export const placePaperOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default';
  const executor = paperTradingManager.getExecutor(userId);

  const { symbol, side, quantity, price, orderType = 'MARKET', productType = 'INTRADAY', strategyId } = req.body;

  if (!symbol || !side || !quantity) {
    return res.status(400).json({
      success: false,
      message: 'Symbol, side, and quantity are required.'
    });
  }

  const orderRequest = {
    symbol,
    side,
    quantity: Number(quantity),
    price: price ? Number(price) : undefined,
    orderType,
    productType,
    validity: 'DAY' as const,
    exchange: 'NSE' as const,
    strategyId,
    isPaper: true
  };

  // Run pre-trade risk validation for this user's current positions
  const positions = await executor.getPositions();
  const currentPos = positions.find(p => p.symbol === symbol)?.quantity || 0;
  const riskCheck = riskEngine.validateOrder(orderRequest, currentPos);

  if (!riskCheck.passed) {
    return res.status(400).json({
      success: false,
      message: `Risk check rejected order: ${riskCheck.reason}`,
      ruleViolated: riskCheck.ruleViolated
    });
  }

  const result = await executor.executeOrder(orderRequest);

  res.json({
    success: result.success,
    order: result
  });
});

/**
 * Get paper orders for authenticated user
 */
export const getPaperOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'default';
  const executor = paperTradingManager.getExecutor(userId);

  const status = req.query.status as string | undefined;
  const strategyId = req.query.strategyId as string | undefined;

  const orders = await executor.getOrders({ status, strategyId });
  res.json({
    success: true,
    orders
  });
});

/**
 * Get active paper positions for authenticated user
 */
export const getPaperPositions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'default';
  const executor = paperTradingManager.getExecutor(userId);

  const positions = await executor.getPositions();
  res.json({
    success: true,
    positions
  });
});

/**
 * Get paper portfolio summary & metrics for authenticated user
 */
export const getPaperPortfolio = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'default';
  const executor = paperTradingManager.getExecutor(userId);

  const portfolio = await executor.getPortfolio();
  res.json({
    success: true,
    portfolio
  });
});

/**
 * Get daily paper trading report for authenticated user
 */
export const getPaperDailyReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'default';
  const executor = paperTradingManager.getExecutor(userId);

  const report = await executor.getDailyReport();
  res.json({
    success: true,
    report
  });
});

/**
 * Get paper execution audit logs for authenticated user
 */
export const getPaperAuditLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'default';
  const executor = paperTradingManager.getExecutor(userId);

  const logs = executor.getAuditLogs();
  res.json({
    success: true,
    logs
  });
});

/**
 * Reset paper portfolio to initial capital for authenticated user
 */
export const resetPaperPortfolio = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default';
  const executor = paperTradingManager.getExecutor(userId);

  const capital = req.body.initialCapital ? Number(req.body.initialCapital) : 100000;
  executor.resetPortfolio(capital);

  res.json({
    success: true,
    message: `Paper portfolio reset with ₹${capital.toLocaleString()}`
  });
});
