export type Side = 'BUY' | 'SELL';
export type IntrabarPolicy = 'CONSERVATIVE' | 'OPTIMISTIC' | 'OPEN_PROXIMITY';

export interface Fill {
  timestamp: number;
  isoTime: string;
  price: number;
  quantity: number;
  side: Side;
  candleIndex: number;
  slippagePercent: number;
  slippageAmount: number;
}

/**
 * ExecutionSimulator — fills orders at the NEXT candle open price after a signal.
 *
 * Signal at candle[i] close → execution at candle[i+1] open
 *
 * This is the correct production model for a backtesting system:
 * you cannot trade on the same candle that generated the signal.
 */
export class ExecutionSimulator {
  private readonly slippagePercent: number;
  private readonly intrabarPolicy: IntrabarPolicy;

  constructor(slippagePercent = 0.05, intrabarPolicy: IntrabarPolicy = 'CONSERVATIVE') {
    this.slippagePercent = slippagePercent;
    this.intrabarPolicy = intrabarPolicy;
  }

  /**
   * Fill an order at the next candle's open price, adjusted for slippage.
   *
   * For SELL orders: fill at open * (1 - slippage%)   — adverse slippage
   * For BUY  orders: fill at open * (1 + slippage%)   — adverse slippage
   */
  fillAtNextOpen(
    candles: Array<{ timestamp: number; open: number; isoTime?: string }>,
    signalIndex: number,
    side: Side,
    quantity: number
  ): Fill {
    const nextIndex = signalIndex + 1;
    if (nextIndex >= candles.length) {
      throw new Error('NO_NEXT_CANDLE_FOR_EXECUTION: Signal was on last available candle');
    }

    const candle = candles[nextIndex];
    const slipFrac = this.slippagePercent / 100;
    const rawPrice = candle.open;
    const price =
      side === 'BUY'
        ? Number((rawPrice * (1 + slipFrac)).toFixed(2))
        : Number((rawPrice * (1 - slipFrac)).toFixed(2));

    const slippageAmount = Number(Math.abs(price - rawPrice).toFixed(2));

    return {
      timestamp: candle.timestamp,
      isoTime: (candle as any).isoTime ?? '',
      price,
      quantity,
      side,
      candleIndex: nextIndex,
      slippagePercent: this.slippagePercent,
      slippageAmount
    };
  }

  /**
   * Check if a short position's stop-loss is triggered on a given candle.
   * For SELL positions: stop is hit when candle.high >= entryPrice * (1 + slPct/100)
   */
  checkShortStopLoss(
    entryPrice: number,
    candle: { high: number; low: number },
    stopLossPercent: number
  ): boolean {
    if (stopLossPercent <= 0) return false;
    const stopPrice = entryPrice * (1 + stopLossPercent / 100);
    return candle.high >= stopPrice;
  }

  /**
   * Check if a long position's stop-loss is triggered on a given candle.
   * For BUY positions: stop is hit when candle.low <= entryPrice * (1 - slPct/100)
   */
  checkLongStopLoss(
    entryPrice: number,
    candle: { high: number; low: number },
    stopLossPercent: number
  ): boolean {
    if (stopLossPercent <= 0) return false;
    const stopPrice = entryPrice * (1 - stopLossPercent / 100);
    return candle.low <= stopPrice;
  }

  /**
   * Resolve intrabar ambiguity: when both stop-loss and target are hit in the same
   * 5-minute candle (high >= SL AND low <= Target), we cannot know which happened first
   * from OHLC alone.
   *
   * CONSERVATIVE: assume stop-loss hits first (worst case for PnL — recommended)
   * OPTIMISTIC:   assume target hits first (best case for PnL — not recommended)
   * OPEN_PROXIMITY: compare open price proximity to high/low to estimate order
   */
  resolveIntrabarAmbiguity(
    candle: { open: number; high: number; low: number },
    stopPrice: number,
    targetPrice: number,
    side: Side
  ): 'STOP_LOSS' | 'TARGET' {
    switch (this.intrabarPolicy) {
      case 'OPTIMISTIC':
        return 'TARGET';
      case 'OPEN_PROXIMITY':
        // If open is closer to stop price → stop hit first, else target first
        const distToStop = Math.abs(candle.open - stopPrice);
        const distToTarget = Math.abs(candle.open - targetPrice);
        return distToStop <= distToTarget ? 'STOP_LOSS' : 'TARGET';
      case 'CONSERVATIVE':
      default:
        return 'STOP_LOSS';
    }
  }
}

export const executionSimulator = new ExecutionSimulator(0.05, 'CONSERVATIVE');