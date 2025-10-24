/**
 * First Candle Breakout Strategy
 * Based on TradingView Pine Script logic
 * 
 * Strategy Logic:
 * 1. Capture the first 5-minute candle after market open (9:15 AM)
 * 2. Calculate upper level: close * 1.0009 (+0.09%)
 * 3. Calculate lower level: close * 0.9991 (-0.09%)
 * 4. Buy when price breaks above upper level
 * 5. Sell when price breaks below lower level
 * 6. Active until market close (3:25 PM)
 */

export interface FirstCandleBreakoutConfig {
  symbol: string;
  upperPercentage: number; // Default: 0.09
  lowerPercentage: number; // Default: 0.09
  marketOpenTime: string; // Default: "09:15"
  marketCloseTime: string; // Default: "15:25"
  candleInterval: number; // Default: 5 minutes
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class FirstCandleBreakoutStrategy {
  private config: FirstCandleBreakoutConfig;
  private firstCandleClose: number | null = null;
  private upperLevel: number | null = null;
  private lowerLevel: number | null = null;
  private isFirstCandleCaptured: boolean = false;
  private hasEnteredPosition: boolean = false;
  private currentPosition: 'LONG' | 'SHORT' | null = null;

  constructor(config: FirstCandleBreakoutConfig) {
    this.config = config;
  }

  /**
   * Check if current time is the first candle after market open
   */
  private isFirstCandle(timestamp: number): boolean {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    const [openHour, openMinute] = this.config.marketOpenTime.split(':').map(Number);
    
    // Check if this is within the first candle interval after market open
    const timeInMinutes = hours * 60 + minutes;
    const openTimeInMinutes = openHour * 60 + openMinute;
    
    return timeInMinutes >= openTimeInMinutes && 
           timeInMinutes < openTimeInMinutes + this.config.candleInterval;
  }

  /**
   * Check if current time is within trading hours
   */
  private isWithinTradingHours(timestamp: number): boolean {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    const [openHour, openMinute] = this.config.marketOpenTime.split(':').map(Number);
    const [closeHour, closeMinute] = this.config.marketCloseTime.split(':').map(Number);
    
    const timeInMinutes = hours * 60 + minutes;
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;
    
    return timeInMinutes >= openTimeInMinutes && timeInMinutes <= closeTimeInMinutes;
  }

  /**
   * Calculate support and resistance levels from first candle
   */
  private calculateLevels(closePrice: number): void {
    const upperMultiplier = 1 + (this.config.upperPercentage / 100);
    const lowerMultiplier = 1 - (this.config.lowerPercentage / 100);
    
    this.upperLevel = closePrice * upperMultiplier;
    this.lowerLevel = closePrice * lowerMultiplier;
    
    console.log(`First Candle Close: ${closePrice}`);
    console.log(`Upper Level: ${this.upperLevel} (+${this.config.upperPercentage}%)`);
    console.log(`Lower Level: ${this.lowerLevel} (-${this.config.lowerPercentage}%)`);
  }

  /**
   * Process incoming candle data and generate signals
   */
  public processCandle(candle: CandleData): {
    signal: 'BUY' | 'SELL' | 'HOLD' | 'EXIT';
    reason: string;
    price: number;
    levels?: { upper: number; lower: number };
  } {
    // Reset daily state if new day
    const candleDate = new Date(candle.timestamp).toDateString();
    const today = new Date().toDateString();
    if (candleDate !== today) {
      this.reset();
    }

    // Capture first candle levels
    if (!this.isFirstCandleCaptured && this.isFirstCandle(candle.timestamp)) {
      this.firstCandleClose = candle.close;
      this.calculateLevels(candle.close);
      this.isFirstCandleCaptured = true;
      
      return {
        signal: 'HOLD',
        reason: 'First candle captured, waiting for breakout',
        price: candle.close,
        levels: { upper: this.upperLevel!, lower: this.lowerLevel! }
      };
    }

    // Wait until first candle is captured
    if (!this.isFirstCandleCaptured || !this.upperLevel || !this.lowerLevel) {
      return {
        signal: 'HOLD',
        reason: 'Waiting for first candle',
        price: candle.close
      };
    }

    // Check if within trading hours
    if (!this.isWithinTradingHours(candle.timestamp)) {
      if (this.hasEnteredPosition) {
        return {
          signal: 'EXIT',
          reason: 'Market closing, exiting position',
          price: candle.close
        };
      }
      return {
        signal: 'HOLD',
        reason: 'Outside trading hours',
        price: candle.close
      };
    }

    // Generate trading signals based on breakouts
    const currentPrice = candle.close;

    // Long signal: Price breaks above upper level
    if (currentPrice > this.upperLevel && !this.hasEnteredPosition) {
      this.hasEnteredPosition = true;
      this.currentPosition = 'LONG';
      return {
        signal: 'BUY',
        reason: `Breakout above upper level (${this.upperLevel.toFixed(2)})`,
        price: currentPrice,
        levels: { upper: this.upperLevel, lower: this.lowerLevel }
      };
    }

    // Short signal: Price breaks below lower level
    if (currentPrice < this.lowerLevel && !this.hasEnteredPosition) {
      this.hasEnteredPosition = true;
      this.currentPosition = 'SHORT';
      return {
        signal: 'SELL',
        reason: `Breakdown below lower level (${this.lowerLevel.toFixed(2)})`,
        price: currentPrice,
        levels: { upper: this.upperLevel, lower: this.lowerLevel }
      };
    }

    // Exit long position if price falls back below upper level
    if (this.currentPosition === 'LONG' && currentPrice < this.upperLevel) {
      this.hasEnteredPosition = false;
      this.currentPosition = null;
      return {
        signal: 'EXIT',
        reason: 'Price fell back below upper level',
        price: currentPrice
      };
    }

    // Exit short position if price rises back above lower level
    if (this.currentPosition === 'SHORT' && currentPrice > this.lowerLevel) {
      this.hasEnteredPosition = false;
      this.currentPosition = null;
      return {
        signal: 'EXIT',
        reason: 'Price rose back above lower level',
        price: currentPrice
      };
    }

    return {
      signal: 'HOLD',
      reason: 'Waiting for breakout or within position',
      price: currentPrice,
      levels: { upper: this.upperLevel, lower: this.lowerLevel }
    };
  }

  /**
   * Reset strategy state for new day
   */
  public reset(): void {
    this.firstCandleClose = null;
    this.upperLevel = null;
    this.lowerLevel = null;
    this.isFirstCandleCaptured = false;
    this.hasEnteredPosition = false;
    this.currentPosition = null;
  }

  /**
   * Get current strategy state
   */
  public getState() {
    return {
      firstCandleClose: this.firstCandleClose,
      upperLevel: this.upperLevel,
      lowerLevel: this.lowerLevel,
      isFirstCandleCaptured: this.isFirstCandleCaptured,
      hasEnteredPosition: this.hasEnteredPosition,
      currentPosition: this.currentPosition
    };
  }
}

/**
 * Backtest the strategy with historical data
 */
export function backtestFirstCandleBreakout(
  historicalData: CandleData[],
  config: FirstCandleBreakoutConfig
): {
  trades: Array<{
    entryTime: number;
    entryPrice: number;
    exitTime: number;
    exitPrice: number;
    type: 'LONG' | 'SHORT';
    pnl: number;
    pnlPercent: number;
  }>;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
} {
  const strategy = new FirstCandleBreakoutStrategy(config);
  const trades: any[] = [];
  let currentTrade: any = null;

  for (const candle of historicalData) {
    const result = strategy.processCandle(candle);

    if (result.signal === 'BUY' || result.signal === 'SELL') {
      currentTrade = {
        entryTime: candle.timestamp,
        entryPrice: result.price,
        type: result.signal === 'BUY' ? 'LONG' : 'SHORT'
      };
    }

    if (result.signal === 'EXIT' && currentTrade) {
      const exitPrice = result.price;
      const pnl = currentTrade.type === 'LONG'
        ? (exitPrice - currentTrade.entryPrice) * config.quantity
        : (currentTrade.entryPrice - exitPrice) * config.quantity;
      
      const pnlPercent = currentTrade.type === 'LONG'
        ? ((exitPrice - currentTrade.entryPrice) / currentTrade.entryPrice) * 100
        : ((currentTrade.entryPrice - exitPrice) / currentTrade.entryPrice) * 100;

      trades.push({
        ...currentTrade,
        exitTime: candle.timestamp,
        exitPrice,
        pnl,
        pnlPercent
      });

      currentTrade = null;
    }
  }

  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const losingTrades = trades.filter(t => t.pnl < 0).length;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  return {
    trades,
    totalTrades,
    winningTrades,
    losingTrades,
    totalPnL,
    winRate
  };
}
