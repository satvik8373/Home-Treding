import { OrderRequest } from '../brokers/types';
import { killSwitch } from './KillSwitch';
import { logger } from '../utils/logger';

export interface RiskConfig {
  maxOrderQuantity: number;
  maxPositionQuantity: number;
  maxDailyLoss: number;
  maxTradesPerDay: number;
  maxPriceDeviationPercent: number;
  enforceMarketHours: boolean;
  duplicateWindowSeconds: number;
}

export interface RiskCheckResult {
  passed: boolean;
  reason?: string;
  ruleViolated?: string;
}

export class RiskEngine {
  private static instance: RiskEngine;
  private config: RiskConfig = {
    maxOrderQuantity: 1800, // 36 lots of Nifty (50)
    maxPositionQuantity: 5000,
    maxDailyLoss: 25000, // ₹25,000 max daily loss
    maxTradesPerDay: 50,
    maxPriceDeviationPercent: 10,
    enforceMarketHours: false, // Default false for paper/dev testing
    duplicateWindowSeconds: 2
  };

  private dailyLossAccumulator: number = 0;
  private dailyTradeCount: number = 0;
  private recentOrderSignatures: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine();
    }
    return RiskEngine.instance;
  }

  public updateConfig(newConfig: Partial<RiskConfig>): RiskConfig {
    this.config = { ...this.config, ...newConfig };
    logger.info('🛡️ [RiskEngine] Updated risk configuration:', this.config);
    return this.config;
  }

  public getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Pre-trade risk validation pipeline
   */
  public validateOrder(order: OrderRequest, currentPositionQty: number = 0): RiskCheckResult {
    // 1. Kill Switch Check
    if (killSwitch.isTradingBlocked()) {
      return {
        passed: false,
        reason: 'Trading is currently blocked by Emergency Stop Kill Switch.',
        ruleViolated: 'KILL_SWITCH_ACTIVE'
      };
    }

    // 2. Max Daily Loss Limit
    if (this.dailyLossAccumulator >= this.config.maxDailyLoss) {
      return {
        passed: false,
        reason: `Maximum daily loss limit of ₹${this.config.maxDailyLoss.toLocaleString()} reached.`,
        ruleViolated: 'MAX_DAILY_LOSS'
      };
    }

    // 3. Max Trades Per Day
    if (this.dailyTradeCount >= this.config.maxTradesPerDay) {
      return {
        passed: false,
        reason: `Maximum daily trade limit of ${this.config.maxTradesPerDay} reached.`,
        ruleViolated: 'MAX_DAILY_TRADES'
      };
    }

    // 4. Max Order Quantity
    if (order.quantity <= 0 || order.quantity > this.config.maxOrderQuantity) {
      return {
        passed: false,
        reason: `Order quantity ${order.quantity} exceeds maximum allowed limit of ${this.config.maxOrderQuantity}.`,
        ruleViolated: 'MAX_ORDER_QTY'
      };
    }

    // 5. Position Quantity Limit
    const prospectiveQty = Math.abs(currentPositionQty + (order.side === 'BUY' ? order.quantity : -order.quantity));
    if (prospectiveQty > this.config.maxPositionQuantity) {
      return {
        passed: false,
        reason: `Prospective position ${prospectiveQty} exceeds max position limit of ${this.config.maxPositionQuantity}.`,
        ruleViolated: 'MAX_POSITION_QTY'
      };
    }

    // 6. Duplicate / Idempotency Check
    const signature = `${order.symbol}_${order.side}_${order.quantity}_${order.strategyId || 'manual'}`;
    const now = Date.now();
    const lastTime = this.recentOrderSignatures.get(signature);

    if (lastTime && now - lastTime < this.config.duplicateWindowSeconds * 1000) {
      return {
        passed: false,
        reason: `Duplicate order detected within ${this.config.duplicateWindowSeconds}s window.`,
        ruleViolated: 'DUPLICATE_ORDER_IDEMPOTENCY'
      };
    }
    this.recentOrderSignatures.set(signature, now);

    return { passed: true };
  }

  public recordTradePnl(pnl: number): void {
    this.dailyTradeCount++;
    if (pnl < 0) {
      this.dailyLossAccumulator += Math.abs(pnl);
    }
  }

  public resetDailyStats(): void {
    this.dailyLossAccumulator = 0;
    this.dailyTradeCount = 0;
    this.recentOrderSignatures.clear();
    logger.info('🔄 [RiskEngine] Daily stats reset');
  }
}

export const riskEngine = RiskEngine.getInstance();
