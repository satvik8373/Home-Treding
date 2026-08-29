import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { paperExecutor } from '../execution/PaperExecutor';
import { riskEngine } from '../risk/RiskEngine';

/**
 * Place a paper trading virtual order
 */
export const placePaperOrder = asyncHandler(async (req: Request, res: Response) => {
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

  // Run pre-trade risk validation
  const positions = await paperExecutor.getPositions();
  const currentPos = positions.find(p => p.symbol === symbol)?.quantity || 0;
  const riskCheck = riskEngine.validateOrder(orderRequest, currentPos);

  if (!riskCheck.passed) {
    return res.status(400).json({
      success: false,
      message: `Risk check rejected order: ${riskCheck.reason}`,
      ruleViolated: riskCheck.ruleViolated
    });
  }

  const result = await paperExecutor.executeOrder(orderRequest);

  res.json({
    success: result.success,
    order: result
  });
});

/**
 * Get all paper orders
 */
export const getPaperOrders = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const strategyId = req.query.strategyId as string | undefined;

  const orders = await paperExecutor.getOrders({ status, strategyId });
  res.json({
    success: true,
    orders
  });
});

/**
 * Get active paper positions
 */
export const getPaperPositions = asyncHandler(async (_req: Request, res: Response) => {
  const positions = await paperExecutor.getPositions();
  res.json({
    success: true,
    positions
  });
});

/**
 * Get paper portfolio summary & metrics
 */
export const getPaperPortfolio = asyncHandler(async (_req: Request, res: Response) => {
  const portfolio = await paperExecutor.getPortfolio();
  res.json({
    success: true,
    portfolio
  });
});

/**
 * Get daily paper trading report (Gross P&L, Brokerage, Slippage, Net P&L, Win Rate)
 */
export const getPaperDailyReport = asyncHandler(async (_req: Request, res: Response) => {
  const report = await paperExecutor.getDailyReport();
  res.json({
    success: true,
    report
  });
});

/**
 * Get paper execution audit logs (Tick -> Signal -> Order -> Fill -> Position)
 */
export const getPaperAuditLogs = asyncHandler(async (_req: Request, res: Response) => {
  const logs = paperExecutor.getAuditLogs();
  res.json({
    success: true,
    logs
  });
});

/**
 * Reset paper portfolio to initial capital
 */
export const resetPaperPortfolio = asyncHandler(async (req: Request, res: Response) => {
  const capital = req.body.initialCapital ? Number(req.body.initialCapital) : 100000;
  paperExecutor.resetPortfolio(capital);

  res.json({
    success: true,
    message: `Paper portfolio reset with ₹${capital.toLocaleString()}`
  });
});
