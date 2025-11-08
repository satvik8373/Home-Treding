/**
 * First Candle Breakout Strategy with 0.09% Bands and Gap Filter
 * 
 * Logic:
 * 1. Gap Filter: Check if market opens within ±150 points of previous close
 * 2. Wait for first 5-min candle (9:20 AM) and get Close price (A)
 * 3. Calculate Upper Trigger = A × 1.0009 and Lower Trigger = A × 0.9991
 * 4. Identify trigger candles:
 *    - Call Trigger: First candle that closes above Upper Trigger
 *    - Put Trigger: First candle that closes below Lower Trigger
 * 5. Entry:
 *    - Buy ATM Call when price breaks above Call Trigger Candle High
 *    - Buy ATM Put when price breaks below Put Trigger Candle Low
 * 6. Stop Loss:
 *    - Call: Day Low of index
 *    - Put: Day High of index
 * 7. Target: Fixed profit points on premium
 */

interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StrategyConfig {
  gapFilterPoints: number;
  upperBandMultiplier: number;
  lowerBandMultiplier: number;
  firstCandleTime: string;
  targetProfitPoints: number;
  atmStrikeOffset: number;
}

interface TradeState {
  isGapFilterValid: boolean;
  previousClose: number | null;
  firstCandleClose: number | null;
  upperTrigger: number | null;
  lowerTrigger: number | null;
  callTriggerCandle: CandleData | null;
  putTriggerCandle: CandleData | null;
  dayHigh: number;
  dayLow: number;
  callEntryPrice: number | null;
  putEntryPrice: number | null;
  callPosition: boolean;
  putPosition: boolean;
}

export class FirstCandleBreakout009Strategy {
  private config: StrategyConfig;
  private state: TradeState;

  constructor(config: Partial<StrategyConfig> = {}) {
    this.config = {
      gapFilterPoints: config.gapFilterPoints || 150,
      upperBandMultiplier: config.upperBandMultiplier || 1.0009,
      lowerBandMultiplier: config.lowerBandMultiplier || 0.9991,
      firstCandleTime: config.firstCandleTime || '09:20',
      targetProfitPoints: config.targetProfitPoints || 50,
      atmStrikeOffset: config.atmStrikeOffset || 0
    };

    this.state = {
      isGapFilterValid: false,
      previousClose: null,
      firstCandleClose: null,
      upperTrigger: null,
      lowerTrigger: null,
      callTriggerCandle: null,
      putTriggerCandle: null,
      dayHigh: 0,
      dayLow: Infinity,
      callEntryPrice: null,
      putEntryPrice: null,
      callPosition: false,
      putPosition: false
    };
  }

  checkGapFilter(openPrice: number, previousClose: number): boolean {
    const gap = Math.abs(openPrice - previousClose);
    this.state.previousClose = previousClose;
    this.state.isGapFilterValid = gap <= this.config.gapFilterPoints;
    return this.state.isGapFilterValid;
  }

  processFirstCandle(candle: CandleData): void {
    if (!this.state.isGapFilterValid) return;
    this.state.firstCandleClose = candle.close;
    this.state.upperTrigger = candle.close * this.config.upperBandMultiplier;
    this.state.lowerTrigger = candle.close * this.config.lowerBandMultiplier;
  }

  identifyTriggerCandles(candle: CandleData): void {
    if (!this.state.upperTrigger || !this.state.lowerTrigger) return;
    this.state.dayHigh = Math.max(this.state.dayHigh, candle.high);
    this.state.dayLow = Math.min(this.state.dayLow, candle.low);

    if (!this.state.callTriggerCandle && candle.close > this.state.upperTrigger) {
      this.state.callTriggerCandle = candle;
    }
    if (!this.state.putTriggerCandle && candle.close < this.state.lowerTrigger) {
      this.state.putTriggerCandle = candle;
    }
  }

  checkEntrySignals(currentPrice: number, currentHigh: number, currentLow: number): {
    callEntry: boolean;
    putEntry: boolean;
  } {
    let callEntry = false;
    let putEntry = false;

    if (this.state.callTriggerCandle && !this.state.callPosition && currentPrice > this.state.callTriggerCandle.high) {
      callEntry = true;
      this.state.callPosition = true;
      this.state.callEntryPrice = currentPrice;
    }

    if (this.state.putTriggerCandle && !this.state.putPosition && currentPrice < this.state.putTriggerCandle.low) {
      putEntry = true;
      this.state.putPosition = true;
      this.state.putEntryPrice = currentPrice;
    }

    return { callEntry, putEntry };
  }

  checkExitConditions(currentPrice: number): {
    exitCall: boolean;
    exitPut: boolean;
    reason: string;
  } {
    let exitCall = false;
    let exitPut = false;
    let reason = '';

    if (this.state.callPosition && this.state.callEntryPrice) {
      if (currentPrice <= this.state.dayLow) {
        exitCall = true;
        reason = `Call SL hit at Day Low (${this.state.dayLow})`;
      } else if (currentPrice >= this.state.callEntryPrice + this.config.targetProfitPoints) {
        exitCall = true;
        reason = `Call Target hit (${this.config.targetProfitPoints} points profit)`;
      }
    }

    if (this.state.putPosition && this.state.putEntryPrice) {
      if (currentPrice >= this.state.dayHigh) {
        exitPut = true;
        reason = `Put SL hit at Day High (${this.state.dayHigh})`;
      } else if (currentPrice <= this.state.putEntryPrice - this.config.targetProfitPoints) {
        exitPut = true;
        reason = `Put Target hit (${this.config.targetProfitPoints} points profit)`;
      }
    }

    if (exitCall) this.state.callPosition = false;
    if (exitPut) this.state.putPosition = false;

    return { exitCall, exitPut, reason };
  }

  processCandle(candle: CandleData, isFirstCandle: boolean = false): {
    action: 'none' | 'call_entry' | 'put_entry' | 'call_exit' | 'put_exit';
    price: number;
    reason: string;
  } {
    if (isFirstCandle) {
      this.processFirstCandle(candle);
      return { action: 'none', price: 0, reason: 'First candle processed' };
    }

    this.identifyTriggerCandles(candle);
    const { callEntry, putEntry } = this.checkEntrySignals(candle.close, candle.high, candle.low);

    if (callEntry) return { action: 'call_entry', price: candle.close, reason: 'Call trigger breakout' };
    if (putEntry) return { action: 'put_entry', price: candle.close, reason: 'Put trigger breakout' };

    const { exitCall, exitPut, reason } = this.checkExitConditions(candle.close);

    if (exitCall) return { action: 'call_exit', price: candle.close, reason };
    if (exitPut) return { action: 'put_exit', price: candle.close, reason };

    return { action: 'none', price: 0, reason: 'No action' };
  }

  getState(): TradeState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      isGapFilterValid: false,
      previousClose: null,
      firstCandleClose: null,
      upperTrigger: null,
      lowerTrigger: null,
      callTriggerCandle: null,
      putTriggerCandle: null,
      dayHigh: 0,
      dayLow: Infinity,
      callEntryPrice: null,
      putEntryPrice: null,
      callPosition: false,
      putPosition: false
    };
  }
}

export default FirstCandleBreakout009Strategy;
