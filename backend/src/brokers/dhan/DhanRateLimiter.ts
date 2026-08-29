import { logger } from '../../utils/logger';

/**
 * DhanRateLimiter
 * Enforces official DhanHQ API v2 rate limits:
 * - Order APIs: 10/sec (250/min, 25 modifications per order)
 * - Data APIs: 5/sec (100,000/day)
 * - Quote APIs: 1/sec
 * - Option Chain: 1 unique request every 3 seconds
 * - Non-Trading: 20/sec
 */
export class DhanRateLimiter {
  private static instance: DhanRateLimiter;

  private orderTimestamps: number[] = [];
  private dataTimestamps: number[] = [];
  private quoteTimestamps: number[] = [];
  private optionChainLastCall: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): DhanRateLimiter {
    if (!DhanRateLimiter.instance) {
      DhanRateLimiter.instance = new DhanRateLimiter();
    }
    return DhanRateLimiter.instance;
  }

  /**
   * Acquire order execution token (max 10/sec)
   */
  public async acquireOrderSlot(): Promise<void> {
    await this.throttle(this.orderTimestamps, 10, 1000, 'ORDER_API');
  }

  /**
   * Acquire market data token (max 5/sec)
   */
  public async acquireDataSlot(): Promise<void> {
    await this.throttle(this.dataTimestamps, 5, 1000, 'DATA_API');
  }

  /**
   * Acquire market quote token (max 1/sec)
   */
  public async acquireQuoteSlot(): Promise<void> {
    await this.throttle(this.quoteTimestamps, 1, 1000, 'QUOTE_API');
  }

  /**
   * Enforce 3-second throttle on unique option chain requests
   */
  public async checkOptionChainThrottle(key: string): Promise<void> {
    const now = Date.now();
    const last = this.optionChainLastCall.get(key) || 0;
    const diff = now - last;
    if (diff < 3000) {
      const waitMs = 3000 - diff;
      logger.info(`[DhanRateLimiter] Throttling Option Chain for ${key}: waiting ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.optionChainLastCall.set(key, Date.now());
  }

  private async throttle(timestamps: number[], maxLimit: number, windowMs: number, apiType: string): Promise<void> {
    const now = Date.now();
    // Purge expired timestamps
    while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
      timestamps.shift();
    }

    if (timestamps.length >= maxLimit) {
      const oldest = timestamps[0];
      const waitTime = windowMs - (now - oldest) + 15;
      logger.debug(`[DhanRateLimiter] Rate limit reached for ${apiType}. Waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.throttle(timestamps, maxLimit, windowMs, apiType);
    }

    timestamps.push(Date.now());
  }
}

export const dhanRateLimiter = DhanRateLimiter.getInstance();
