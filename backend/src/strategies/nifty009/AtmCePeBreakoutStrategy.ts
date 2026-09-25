/**
 * NIFTY ATM CE/PE Independent Breakout Strategy
 * -----------------------------------------------
 * Direct TypeScript implementation of the updated reference specification:
 * - Each leg (CE and PE) is an independent LegBreakout tracker.
 * - Breakout levels (+0.09% / -0.09%) are computed from each option premium's 09:15-09:20 5m close.
 * - Both legs can be FLAT, one active, or BOTH active at the same time.
 * - Re-entries allowed throughout 09:20-15:10 IST without recalculating levels.
 * - 15:10 IST force square-off.
 */
import { getStrategyConfig } from '../../config/strategyConfig';

/**
 * Re-exported for legacy consumers — all values now driven by central config at runtime.
 * Do NOT hardcode these; always call getStrategyConfig() for live values.
 */
export const BREAKOUT_PCT         = () => getStrategyConfig().breakoutPct;
export const FORCE_SQUAREOFF_TIME = () => getStrategyConfig().forceSquareOffTime;
export const DEFAULT_LOT_SIZE     = () => getStrategyConfig().niftyLotSize;
export const ENTRY_LOTS           = () => getStrategyConfig().entryLots;

export type LegState = 'FLAT' | 'LONG';

export interface StrategyCandle {
  ts: string; // candle close time (e.g. '09:20', '09:25', '15:10' or ISO)
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export type OrderCallback = (leg: 'CE' | 'PE', price: number, ts: string, qty: number, reason?: string) => void;

/**
 * Independent breakout tracker for one leg (CE or PE).
 */
export class LegBreakout {
  public readonly name: 'CE' | 'PE';
  private onBuy: OrderCallback;
  private onExit: OrderCallback;

  public referenceClose: number | null = null;
  public upperLevel: number | null = null;
  public lowerLevel: number | null = null;
  public state: LegState = 'FLAT';
  public levelsLocked: boolean = false;
  public entryCount: number = 0;
  public exitCount: number = 0;
  public lotSize: number = getStrategyConfig().niftyLotSize;

  // 3-Lot Position Tracking
  public entryPrice: number | null = null;
  public totalQty: number = 0;
  public remainingQty: number = 0;
  public target1Price: number | null = null;
  public target2Price: number | null = null;
  public target1Hit: boolean = false;

  constructor(
    name: 'CE' | 'PE',
    onBuy: OrderCallback,
    onExit: OrderCallback,
    lotSize: number = getStrategyConfig().niftyLotSize
  ) {
    this.name = name;
    this.onBuy = onBuy;
    this.onExit = onExit;
    this.lotSize = lotSize;
  }

  /**
   * Call once, at the 09:15-09:20 candle close, with that candle's close price for this leg.
   * Levels are then fixed for the day.
   */
  public lockLevels(referenceClose: number): void {
    if (this.levelsLocked) return;
    const cfg = getStrategyConfig();
    this.referenceClose = Number(referenceClose.toFixed(2));
    this.upperLevel = Number((referenceClose * (1 + cfg.breakoutPct)).toFixed(2));
    this.lowerLevel = Number((referenceClose * (1 - cfg.breakoutPct)).toFixed(2));
    this.levelsLocked = true;
  }

  private isAfterOrAtSquareOff(ts: string): boolean {
    if (!ts) return false;
    let minutes = 0;
    const squareOffTime = getStrategyConfig().forceSquareOffTime;
    const [soH, soM] = squareOffTime.split(':').map(Number);
    const squareOffMinutes = soH * 60 + soM;
    if (ts.includes('T')) {
      const d = new Date(ts);
      const istTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (5.5 * 3600 * 1000));
      minutes = istTime.getHours() * 60 + istTime.getMinutes();
    } else {
      const parts = ts.split(':').map(Number);
      minutes = parts[0] * 60 + (parts[1] || 0);
    }
    return minutes >= squareOffMinutes;
  }

  public onCandleClose(candle: StrategyCandle): void {
    if (!this.levelsLocked || this.upperLevel === null || this.lowerLevel === null) {
      return; // levels not yet locked (before 09:20)
    }

    const cfg = getStrategyConfig();
    const entryQty = this.lotSize * cfg.entryLots; // 3 lots = 195 qty
    const t1Pts = cfg.target1Pts || 20.0;
    const t2Pts = cfg.target2Pts || 40.0;

    // 15:10 Force Square-Off
    if (this.isAfterOrAtSquareOff(candle.ts)) {
      if (this.state === 'LONG' && this.remainingQty > 0) {
        this.onExit(this.name, candle.close, candle.ts, this.remainingQty, 'FORCE_SQUARE_OFF_15_10');
        this.state = 'FLAT';
        this.remainingQty = 0;
        this.exitCount++;
      }
      return;
    }

    // Re-entry is allowed: when FLAT and candle.close >= upperLevel -> BUY 3 LOTS
    if (this.state === 'FLAT') {
      if (candle.close >= this.upperLevel) {
        this.entryPrice = candle.close;
        this.totalQty = entryQty;
        this.remainingQty = entryQty;
        this.target1Price = Number((candle.close + t1Pts).toFixed(2));
        this.target2Price = Number((candle.close + t2Pts).toFixed(2));
        this.target1Hit = false;

        this.onBuy(this.name, candle.close, candle.ts, entryQty, 'BREAKOUT_ENTRY');
        this.state = 'LONG';
        this.entryCount++;
      }
    } else if (this.state === 'LONG') {
      const high = candle.high !== undefined ? candle.high : candle.close;

      // 1. Target 2 (+40 pts from entry) -> Sell remaining 2 lots (130 qty), state becomes FLAT
      if (this.target2Price !== null && (high >= this.target2Price || candle.close >= this.target2Price)) {
        this.onExit(this.name, this.target2Price, candle.ts, this.remainingQty, 'TARGET_2_FULL_EXIT');
        this.state = 'FLAT';
        this.remainingQty = 0;
        this.exitCount++;
        return;
      }

      // 2. Target 1 (+20 pts from entry) -> Sell 1 lot (65 qty), remaining 130 qty
      if (!this.target1Hit && this.target1Price !== null && (high >= this.target1Price || candle.close >= this.target1Price)) {
        this.onExit(this.name, this.target1Price, candle.ts, this.lotSize, 'TARGET_1_PARTIAL_EXIT');
        this.remainingQty -= this.lotSize;
        this.target1Hit = true;
      }

      // 3. Lower Level Exit (Close < Lower Level) -> Sell whatever quantity remains
      if (candle.close < this.lowerLevel) {
        if (this.remainingQty > 0) {
          this.onExit(this.name, candle.close, candle.ts, this.remainingQty, 'LOWER_LEVEL_EXIT');
          this.exitCount++;
        }
        this.state = 'FLAT';
        this.remainingQty = 0;
      }
    }
  }

  public reset(): void {
    this.referenceClose = null;
    this.upperLevel = null;
    this.lowerLevel = null;
    this.state = 'FLAT';
    this.levelsLocked = false;
    this.entryCount = 0;
    this.exitCount = 0;
    this.entryPrice = null;
    this.totalQty = 0;
    this.remainingQty = 0;
    this.target1Price = null;
    this.target2Price = null;
    this.target1Hit = false;
  }
}

/**
 * Runs two independent LegBreakout trackers: one for ATM CE, one for ATM PE.
 * Feed each leg's own 5-min candles as they close.
 */
export class AtmCePeBreakoutStrategy {
  public readonly ce: LegBreakout;
  public readonly pe: LegBreakout;

  constructor(
    onBuy: OrderCallback,
    onExit: OrderCallback,
    lotSize: number = getStrategyConfig().niftyLotSize
  ) {
    this.ce = new LegBreakout('CE', onBuy, onExit, lotSize);
    this.pe = new LegBreakout('PE', onBuy, onExit, lotSize);
  }

  public lockCeReference(close0915_0920: number): void {
    this.ce.lockLevels(close0915_0920);
  }

  public lockPeReference(close0915_0920: number): void {
    this.pe.lockLevels(close0915_0920);
  }

  public onCeCandle(candle: StrategyCandle): void {
    this.ce.onCandleClose(candle);
  }

  public onPeCandle(candle: StrategyCandle): void {
    this.pe.onCandleClose(candle);
  }

  public resetDaily(): void {
    this.ce.reset();
    this.pe.reset();
  }
}
