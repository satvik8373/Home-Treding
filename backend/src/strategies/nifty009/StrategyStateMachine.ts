import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { Candle } from './CandleEngine';
import { LockedAtm } from './AtmResolver';
import { getStrategyConfig } from '../../config/strategyConfig';

export type LegState = 'FLAT' | 'LONG';

export type StrategyOverallState =
  | 'IDLE'
  | 'RUNNING'
  | 'WAITING_FOR_MARKET'
  | 'CAPTURING_REFERENCE'
  | 'LEVELS_LOCKED'
  | 'ACTIVE_TRADING'
  | 'SQUARE_OFF_PENDING'
  | 'DAY_COMPLETED'
  | 'HALTED';

export interface StrategyConfig {
  lotMultiplier: number; // 2 lots dynamically
  lotSize?: number;
  capitalAllocation?: number;
  squareOffTime: string; // HH:MM IST (default: '15:10')
  maxDailyLoss: number; // default: 10000
  maxTradesPerDay?: number;
  enableReEntry: boolean; // default: true
}

export const DEFAULT_CONFIG: StrategyConfig = {
  get lotMultiplier()  { return getStrategyConfig().entryLots; },
  get squareOffTime()  { return getStrategyConfig().forceSquareOffTime; },
  get maxDailyLoss()   { return getStrategyConfig().maxDailyLoss; },
  get enableReEntry()  { return getStrategyConfig().enableReEntry; }
};

export interface StrategySignal {
  id: string;
  leg: 'CE' | 'PE';
  type: 'BUY_CE' | 'BUY_PE' | 'EXIT_CE' | 'EXIT_PE' | 'TARGET_1_CE' | 'TARGET_2_CE' | 'TARGET_1_PE' | 'TARGET_2_PE' | 'FORCE_SQUARE_OFF';
  triggerReason: string;
  triggerPrice: number;
  timestamp: string;
  upperLevel: number;
  lowerLevel: number;
  quantity: number;
}

export interface LegPosition {
  leg: 'CE' | 'PE';
  symbol: string;
  securityId: string;
  strike: number;
  entryPrice: number;
  quantity: number;
  totalQty?: number;
  remainingQty?: number;
  entryTime: string;
  currentLtp: number;
  unrealizedPnl: number;
  realizedPnl: number;
  target1Price?: number;
  target2Price?: number;
  target1Hit?: boolean;
}

export interface LegLevels {
  referenceClose: number | null;
  upperLevel: number | null;
  lowerLevel: number | null;
}

/**
 * NIFTY ATM CE/PE Independent Breakout State Machine
 *
 * Implements completely independent CE and PE state machines:
 * CE: FLAT ↔ LONG (Driven purely by CE 5m premium close vs CE_UPPER / CE_LOWER)
 * PE: FLAT ↔ LONG (Driven purely by PE 5m premium close vs PE_UPPER / PE_LOWER)
 *
 * All combinations allowed:
 * - CE FLAT + PE FLAT
 * - CE LONG + PE FLAT
 * - CE FLAT + PE LONG
 * - CE LONG + PE LONG
 */
export class StrategyStateMachine extends EventEmitter {
  private overallState: StrategyOverallState = 'IDLE';
  private config: StrategyConfig = { ...DEFAULT_CONFIG };
  private sessionDate: string = '';
  private lockedAtm: LockedAtm | null = null;

  // Independent CE State & Levels
  private ceState: LegState = 'FLAT';
  private ceReferenceClose: number | null = null;
  private ceUpperLevel: number | null = null;
  private ceLowerLevel: number | null = null;
  private cePosition: LegPosition | null = null;
  private ceEntryCount: number = 0;
  private ceExitCount: number = 0;
  private lastCeCandleTimestamp: string = '';
  private lastCeSignal: StrategySignal | null = null;

  // Independent PE State & Levels
  private peState: LegState = 'FLAT';
  private peReferenceClose: number | null = null;
  private peUpperLevel: number | null = null;
  private peLowerLevel: number | null = null;
  private pePosition: LegPosition | null = null;
  private peEntryCount: number = 0;
  private peExitCount: number = 0;
  private lastPeCandleTimestamp: string = '';
  private lastPeSignal: StrategySignal | null = null;

  // Signal idempotency set
  private processedCandles: Set<string> = new Set();
  private signalsHistory: StrategySignal[] = [];

  constructor() {
    super();
    this.sessionDate = new Date().toISOString().split('T')[0];
  }

  public setConfig(customConfig: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...customConfig };
  }

  public getConfig(): StrategyConfig {
    return { ...this.config };
  }

  public getOverallState(): StrategyOverallState {
    return this.overallState;
  }

  public getCeState(): LegState {
    return this.ceState;
  }

  public getPeState(): LegState {
    return this.peState;
  }

  public getCePosition(): LegPosition | null {
    return this.cePosition ? { ...this.cePosition } : null;
  }

  public getPePosition(): LegPosition | null {
    return this.pePosition ? { ...this.pePosition } : null;
  }

  public getCeLevels(): LegLevels {
    return {
      referenceClose: this.ceReferenceClose,
      upperLevel: this.ceUpperLevel,
      lowerLevel: this.ceLowerLevel
    };
  }

  public getPeLevels(): LegLevels {
    return {
      referenceClose: this.peReferenceClose,
      upperLevel: this.peUpperLevel,
      lowerLevel: this.peLowerLevel
    };
  }

  public getLockedAtm(): LockedAtm | null {
    return this.lockedAtm ? { ...this.lockedAtm } : null;
  }

  /**
   * Session Initialization (Daily Reset)
   */
  public start(dateStr?: string): void {
    this.sessionDate = dateStr || new Date().toISOString().split('T')[0];
    this.overallState = 'RUNNING';

    // Daily Reset CE
    this.ceState = 'FLAT';
    this.ceReferenceClose = null;
    this.ceUpperLevel = null;
    this.ceLowerLevel = null;
    this.cePosition = null;
    this.ceEntryCount = 0;
    this.ceExitCount = 0;
    this.lastCeCandleTimestamp = '';
    this.lastCeSignal = null;

    // Daily Reset PE
    this.peState = 'FLAT';
    this.peReferenceClose = null;
    this.peUpperLevel = null;
    this.peLowerLevel = null;
    this.pePosition = null;
    this.peEntryCount = 0;
    this.peExitCount = 0;
    this.lastPeCandleTimestamp = '';
    this.lastPeSignal = null;

    this.lockedAtm = null;
    this.processedCandles.clear();
    this.signalsHistory = [];

    logger.info(`[StateMachine] 🚀 Session started for date: ${this.sessionDate}`);
    this.emit('state:changed', this.getSummary());
  }

  public pause(): void {
    if (this.overallState !== 'DAY_COMPLETED') {
      this.overallState = 'HALTED';
      this.emit('state:changed', this.getSummary());
    }
  }

  public resume(): void {
    if (this.overallState === 'HALTED') {
      this.overallState = 'ACTIVE_TRADING';
      this.emit('state:changed', this.getSummary());
    }
  }

  /**
   * Lock ATM Contracts (09:20 IST)
   */
  public onAtmResolved(lockedAtm: LockedAtm): void {
    this.lockedAtm = lockedAtm;
    logger.info(`[StateMachine] 🔒 ATM Locked: Strike ${lockedAtm.atmStrike} | CE: ${lockedAtm.ceSymbol} | PE: ${lockedAtm.peSymbol} | Lot Size: ${lockedAtm.lotSize}`);
    this.emit('event', {
      type: 'REFERENCE_LOCKED',
      data: { strike: lockedAtm.atmStrike, expiry: lockedAtm.expiry, ce: lockedAtm.ceSymbol, pe: lockedAtm.peSymbol }
    });
  }

  /**
   * Set Reference Candle & Fixed Levels for ATM CE (09:15-09:20 5m Candle Close)
   */
  public setCeReferenceCandle(candle: Candle): void {
    if (this.ceReferenceClose !== null) {
      logger.info(`[StateMachine] CE Reference already locked at ${this.ceReferenceClose}. Skipping.`);
      return;
    }

    const cfg = getStrategyConfig();
    const mult = cfg.breakoutPct || 0.009; // +0.9% = 0.009
    this.ceReferenceClose = Number(candle.close.toFixed(2));
    this.ceUpperLevel = Number((this.ceReferenceClose * (1 + mult)).toFixed(2));
    this.ceLowerLevel = Number((this.ceReferenceClose * (1 - mult)).toFixed(2));

    logger.info(`[StateMachine] 🎯 CE 09:20 Reference Locked: Close=${this.ceReferenceClose} | Upper (+${(mult * 100).toFixed(1)}%)=${this.ceUpperLevel} | Lower (-${(mult * 100).toFixed(1)}%)=${this.ceLowerLevel}`);
    this.emit('event', {
      type: 'LEVELS_CALCULATED',
      data: { leg: 'CE', reference: this.ceReferenceClose, upper: this.ceUpperLevel, lower: this.ceLowerLevel }
    });

    this.checkBothLevelsLocked();
  }

  /**
   * Set Reference Candle & Fixed Levels for ATM PE (09:15-09:20 5m Candle Close)
   */
  public setPeReferenceCandle(candle: Candle): void {
    if (this.peReferenceClose !== null) {
      logger.info(`[StateMachine] PE Reference already locked at ${this.peReferenceClose}. Skipping.`);
      return;
    }

    const cfg = getStrategyConfig();
    const mult = cfg.breakoutPct || 0.009; // +0.9% = 0.009
    this.peReferenceClose = Number(candle.close.toFixed(2));
    this.peUpperLevel = Number((this.peReferenceClose * (1 + mult)).toFixed(2));
    this.peLowerLevel = Number((this.peReferenceClose * (1 - mult)).toFixed(2));

    logger.info(`[StateMachine] 🎯 PE 09:20 Reference Locked: Close=${this.peReferenceClose} | Upper (+${(mult * 100).toFixed(1)}%)=${this.peUpperLevel} | Lower (-${(mult * 100).toFixed(1)}%)=${this.peLowerLevel}`);
    this.emit('event', {
      type: 'LEVELS_CALCULATED',
      data: { leg: 'PE', reference: this.peReferenceClose, upper: this.peUpperLevel, lower: this.peLowerLevel }
    });

    this.checkBothLevelsLocked();
  }

  private checkBothLevelsLocked(): void {
    if (this.ceReferenceClose && this.peReferenceClose) {
      this.overallState = 'ACTIVE_TRADING';
      this.emit('state:changed', this.getSummary());
    }
  }

  private isAfterOrAtSquareOffTime(candleTimeStr: string): boolean {
    if (!candleTimeStr) return false;
    let candleMinutes = 0;
    if (candleTimeStr.includes('T')) {
      const d = new Date(candleTimeStr);
      const istTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (5.5 * 3600 * 1000));
      candleMinutes = istTime.getHours() * 60 + istTime.getMinutes();
    } else {
      const parts = candleTimeStr.split(':').map(Number);
      candleMinutes = parts[0] * 60 + (parts[1] || 0);
    }
    const [sqH, sqM] = this.config.squareOffTime.split(':').map(Number);
    const targetMinutes = sqH * 60 + (sqM || 0);
    return candleMinutes >= targetMinutes;
  }

  /**
   * Process a Completed 5-Minute ATM CE Candle.
   *
   * Logic:
   * 1. If CE_CANDLE_CLOSE >= CE_UPPER and CE is FLAT -> BUY ATM CE (2 lots)
   * 2. If CE_CANDLE_CLOSE < CE_LOWER and CE is LONG -> EXIT ATM CE
   * Completely independent of PE!
   */
  public onCeCandleClosed(candle: Candle): StrategySignal | null {
    if (this.overallState === 'IDLE' || this.overallState === 'HALTED' || this.overallState === 'DAY_COMPLETED') {
      return null;
    }
    if (!this.ceUpperLevel || !this.ceLowerLevel || !this.lockedAtm) {
      return null;
    }

    // Unique candle deduplication key: instrument + candle_start_time + timeframe
    const candleKey = `CE_${this.lockedAtm.ceSecurityId}_${candle.startTime}_5m`;
    if (this.processedCandles.has(candleKey)) {
      return null;
    }
    this.processedCandles.add(candleKey);
    this.lastCeCandleTimestamp = candle.endTime;

    const close = candle.close;
    const qty = (this.lockedAtm.lotSize || getStrategyConfig().niftyLotSize) * this.config.lotMultiplier; // lots from central config

    // Force Square-Off Check at or after 15:10 IST (matches reference: candle.ts >= FORCE_SQUAREOFF_TIME)
    if (this.isAfterOrAtSquareOffTime(candle.endTime)) {
      if (this.ceState === 'LONG') {
        const signalId = `SIG_CE_FORCE_EXIT_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'CE',
          type: 'EXIT_CE',
          triggerReason: `15:10 Force Square-Off Cutoff Reached (${candle.endTime})`,
          triggerPrice: close,
          timestamp: candle.endTime,
          upperLevel: this.ceUpperLevel,
          lowerLevel: this.ceLowerLevel,
          quantity: this.cePosition ? this.cePosition.quantity : qty
        };
        this.lastCeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🛑 CE FORCE SQUARE-OFF SIGNAL at ${candle.endTime}`);
        this.emit('event', { type: 'FORCED_SQUAREOFF', data: signal });
        this.emit('signal', signal);
        return signal;
      }
      return null;
    }

    // CE Entry Condition
    if (close >= this.ceUpperLevel && this.ceState === 'FLAT') {
      const signalId = `SIG_CE_ENTRY_${this.sessionDate}_${candle.startTime}`;
      const signal: StrategySignal = {
        id: signalId,
        leg: 'CE',
        type: 'BUY_CE',
        triggerReason: `CE 5m Close (₹${close}) >= CE Upper Level (₹${this.ceUpperLevel})`,
        triggerPrice: close,
        timestamp: candle.endTime,
        upperLevel: this.ceUpperLevel,
        lowerLevel: this.ceLowerLevel,
        quantity: qty
      };

      this.lastCeSignal = signal;
      this.signalsHistory.push(signal);
      logger.info(`[StateMachine] 🟢 CE ENTRY SIGNAL: ${signal.triggerReason} | Qty=${qty}`);
      this.emit('event', { type: 'CE_BREAKOUT_DETECTED', data: signal });
      this.emit('signal', signal);
      return signal;
    }

    // CE Exit Conditions (Target 2, Target 1, Lower Level Exit)
    if (this.ceState === 'LONG' && this.cePosition) {
      const pos = this.cePosition;

      // 1. Target 2 (+40 pts from entry fill price -> Full Exit of Remaining Quantity)
      if (pos.target2Price && (candle.high >= pos.target2Price || candle.close >= pos.target2Price)) {
        const signalId = `SIG_CE_TARGET_2_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'CE',
          type: 'TARGET_2_CE',
          triggerReason: `CE Target 2 Reached (+₹40 from entry ₹${pos.entryPrice}) @ ₹${pos.target2Price}`,
          triggerPrice: pos.target2Price,
          timestamp: candle.endTime,
          upperLevel: this.ceUpperLevel,
          lowerLevel: this.ceLowerLevel,
          quantity: pos.remainingQty || pos.quantity
        };
        this.lastCeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🎯 CE TARGET 2 HIT: ${signal.triggerReason} | Qty=${signal.quantity}`);
        this.emit('event', { type: 'CE_TARGET_2_HIT', data: signal });
        this.emit('signal', signal);
        return signal;
      }

      // 2. Target 1 (+20 pts from entry fill price -> Partial Exit of 1 lot = 65 Qty)
      if (!pos.target1Hit && pos.target1Price && (candle.high >= pos.target1Price || candle.close >= pos.target1Price)) {
        const lotSize = this.lockedAtm.lotSize || getStrategyConfig().niftyLotSize;
        const signalId = `SIG_CE_TARGET_1_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'CE',
          type: 'TARGET_1_CE',
          triggerReason: `CE Target 1 Reached (+₹20 from entry ₹${pos.entryPrice}) @ ₹${pos.target1Price} (Sell 1 lot)`,
          triggerPrice: pos.target1Price,
          timestamp: candle.endTime,
          upperLevel: this.ceUpperLevel,
          lowerLevel: this.ceLowerLevel,
          quantity: lotSize
        };
        this.lastCeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🎯 CE TARGET 1 HIT: ${signal.triggerReason} | Qty=${lotSize}`);
        this.emit('event', { type: 'CE_TARGET_1_HIT', data: signal });
        this.emit('signal', signal);
        return signal;
      }

      // 3. Lower Level Exit (Close < Lower Level -> Exit Remaining Quantity)
      if (close < this.ceLowerLevel) {
        const signalId = `SIG_CE_EXIT_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'CE',
          type: 'EXIT_CE',
          triggerReason: `CE 5m Close (₹${close}) < CE Lower Level (₹${this.ceLowerLevel})`,
          triggerPrice: close,
          timestamp: candle.endTime,
          upperLevel: this.ceUpperLevel,
          lowerLevel: this.ceLowerLevel,
          quantity: pos.remainingQty || pos.quantity
        };

        this.lastCeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🔴 CE EXIT SIGNAL: ${signal.triggerReason}`);
        this.emit('event', { type: 'CE_EXIT_SIGNAL', data: signal });
        this.emit('signal', signal);
        return signal;
      }
    }

    return null;
  }

  /**
   * Process a Completed 5-Minute ATM PE Candle.
   *
   * Logic:
   * 1. If PE_CANDLE_CLOSE >= PE_UPPER and PE is FLAT -> BUY ATM PE (3 lots)
   * 2. If Target 2 reached (+40 pts) -> Exit Remaining Quantity, FLAT
   * 3. If Target 1 reached (+20 pts) -> Exit 1 lot (65 qty), 2 lots remaining
   * 4. If PE_CANDLE_CLOSE < PE_LOWER and PE is LONG -> EXIT Remaining Quantity, FLAT
   * Completely independent of CE!
   */
  public onPeCandleClosed(candle: Candle): StrategySignal | null {
    if (this.overallState === 'IDLE' || this.overallState === 'HALTED' || this.overallState === 'DAY_COMPLETED') {
      return null;
    }
    if (!this.peUpperLevel || !this.peLowerLevel || !this.lockedAtm) {
      return null;
    }

    const candleKey = `PE_${this.lockedAtm.peSecurityId}_${candle.startTime}_5m`;
    if (this.processedCandles.has(candleKey)) {
      return null;
    }
    this.processedCandles.add(candleKey);
    this.lastPeCandleTimestamp = candle.endTime;

    const close = candle.close;
    const qty = (this.lockedAtm.lotSize || getStrategyConfig().niftyLotSize) * this.config.lotMultiplier; // 3 lots = 195 qty

    // Force Square-Off Check at or after 15:10 IST (matches reference: candle.ts >= FORCE_SQUAREOFF_TIME)
    if (this.isAfterOrAtSquareOffTime(candle.endTime)) {
      if (this.peState === 'LONG') {
        const signalId = `SIG_PE_FORCE_EXIT_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'PE',
          type: 'EXIT_PE',
          triggerReason: `15:10 Force Square-Off Cutoff Reached (${candle.endTime})`,
          triggerPrice: close,
          timestamp: candle.endTime,
          upperLevel: this.peUpperLevel,
          lowerLevel: this.peLowerLevel,
          quantity: this.pePosition ? (this.pePosition.remainingQty || this.pePosition.quantity) : qty
        };
        this.lastPeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🛑 PE FORCE SQUARE-OFF SIGNAL at ${candle.endTime}`);
        this.emit('event', { type: 'FORCED_SQUAREOFF', data: signal });
        this.emit('signal', signal);
        return signal;
      }
      return null;
    }

    // PE Entry Condition: 3 lots on breakout
    if (close >= this.peUpperLevel && this.peState === 'FLAT') {
      const signalId = `SIG_PE_ENTRY_${this.sessionDate}_${candle.startTime}`;
      const signal: StrategySignal = {
        id: signalId,
        leg: 'PE',
        type: 'BUY_PE',
        triggerReason: `PE 5m Close (₹${close}) >= PE Upper Level (₹${this.peUpperLevel})`,
        triggerPrice: close,
        timestamp: candle.endTime,
        upperLevel: this.peUpperLevel,
        lowerLevel: this.peLowerLevel,
        quantity: qty
      };

      this.lastPeSignal = signal;
      this.signalsHistory.push(signal);
      logger.info(`[StateMachine] 🟢 PE ENTRY SIGNAL: ${signal.triggerReason} | Qty=${qty}`);
      this.emit('event', { type: 'PE_BREAKOUT_DETECTED', data: signal });
      this.emit('signal', signal);
      return signal;
    }

    // PE Exit Conditions (Target 2, Target 1, Lower Level Exit)
    if (this.peState === 'LONG' && this.pePosition) {
      const pos = this.pePosition;

      // 1. Target 2 (+40 pts from entry fill price -> Full Exit of Remaining Quantity)
      if (pos.target2Price && (candle.high >= pos.target2Price || candle.close >= pos.target2Price)) {
        const signalId = `SIG_PE_TARGET_2_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'PE',
          type: 'TARGET_2_PE',
          triggerReason: `PE Target 2 Reached (+₹40 from entry ₹${pos.entryPrice}) @ ₹${pos.target2Price}`,
          triggerPrice: pos.target2Price,
          timestamp: candle.endTime,
          upperLevel: this.peUpperLevel,
          lowerLevel: this.peLowerLevel,
          quantity: pos.remainingQty || pos.quantity
        };
        this.lastPeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🎯 PE TARGET 2 HIT: ${signal.triggerReason} | Qty=${signal.quantity}`);
        this.emit('event', { type: 'PE_TARGET_2_HIT', data: signal });
        this.emit('signal', signal);
        return signal;
      }

      // 2. Target 1 (+20 pts from entry fill price -> Partial Exit of 1 lot = 65 Qty)
      if (!pos.target1Hit && pos.target1Price && (candle.high >= pos.target1Price || candle.close >= pos.target1Price)) {
        const lotSize = this.lockedAtm.lotSize || getStrategyConfig().niftyLotSize;
        const signalId = `SIG_PE_TARGET_1_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'PE',
          type: 'TARGET_1_PE',
          triggerReason: `PE Target 1 Reached (+₹20 from entry ₹${pos.entryPrice}) @ ₹${pos.target1Price} (Sell 1 lot)`,
          triggerPrice: pos.target1Price,
          timestamp: candle.endTime,
          upperLevel: this.peUpperLevel,
          lowerLevel: this.peLowerLevel,
          quantity: lotSize
        };
        this.lastPeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🎯 PE TARGET 1 HIT: ${signal.triggerReason} | Qty=${lotSize}`);
        this.emit('event', { type: 'PE_TARGET_1_HIT', data: signal });
        this.emit('signal', signal);
        return signal;
      }

      // 3. Lower Level Exit (Close < Lower Level -> Exit Remaining Quantity)
      if (close < this.peLowerLevel) {
        const signalId = `SIG_PE_EXIT_${this.sessionDate}_${candle.startTime}`;
        const signal: StrategySignal = {
          id: signalId,
          leg: 'PE',
          type: 'EXIT_PE',
          triggerReason: `PE 5m Close (₹${close}) < PE Lower Level (₹${this.peLowerLevel})`,
          triggerPrice: close,
          timestamp: candle.endTime,
          upperLevel: this.peUpperLevel,
          lowerLevel: this.peLowerLevel,
          quantity: pos.remainingQty || pos.quantity
        };

        this.lastPeSignal = signal;
        this.signalsHistory.push(signal);
        logger.info(`[StateMachine] 🔴 PE EXIT SIGNAL: ${signal.triggerReason}`);
        this.emit('event', { type: 'PE_EXIT_SIGNAL', data: signal });
        this.emit('signal', signal);
        return signal;
      }
    }

    return null;
  }

  // ───────────────────────────────────────────────
  // Position Callbacks from Executor
  // ───────────────────────────────────────────────
  public onCePositionOpened(position: LegPosition): void {
    this.ceState = 'LONG';
    this.cePosition = position;
    this.ceEntryCount += 1;
    logger.info(`[StateMachine] 📦 CE Position OPENED (LONG): ${position.symbol} @ ₹${position.entryPrice} (Total Qty: ${position.totalQty || position.quantity}, Target 1: ₹${position.target1Price}, Target 2: ₹${position.target2Price})`);
    this.emit('event', { type: 'CE_ENTRY_FILL', data: position });
    this.emit('state:changed', this.getSummary());
  }

  public onCeTarget1Filled(exitPrice: number, exitQty: number): void {
    if (this.cePosition) {
      this.cePosition.target1Hit = true;
      this.cePosition.remainingQty = (this.cePosition.remainingQty || this.cePosition.quantity) - exitQty;
      this.cePosition.quantity = this.cePosition.remainingQty;
      this.cePosition.realizedPnl += Number(((exitPrice - this.cePosition.entryPrice) * exitQty).toFixed(2));
      logger.info(`[StateMachine] 🎯 CE Target 1 FILLED @ ₹${exitPrice} (${exitQty} Qty sold, ${this.cePosition.remainingQty} Qty remaining)`);
      this.emit('event', { type: 'CE_TARGET_1_FILL', data: { exitPrice, exitQty, remainingQty: this.cePosition.remainingQty } });
      this.emit('state:changed', this.getSummary());
    }
  }

  public onCePositionClosed(): void {
    this.ceState = 'FLAT';
    this.cePosition = null;
    this.ceExitCount += 1;
    logger.info(`[StateMachine] 🚪 CE Position CLOSED -> State is FLAT (Re-entry allowed on next breakout)`);
    this.emit('event', { type: 'CE_EXIT_FILL', data: { leg: 'CE', state: 'FLAT' } });
    this.emit('state:changed', this.getSummary());
  }

  public onPePositionOpened(position: LegPosition): void {
    this.peState = 'LONG';
    this.pePosition = position;
    this.peEntryCount += 1;
    logger.info(`[StateMachine] 📦 PE Position OPENED (LONG): ${position.symbol} @ ₹${position.entryPrice} (Total Qty: ${position.totalQty || position.quantity}, Target 1: ₹${position.target1Price}, Target 2: ₹${position.target2Price})`);
    this.emit('event', { type: 'PE_ENTRY_FILL', data: position });
    this.emit('state:changed', this.getSummary());
  }

  public onPeTarget1Filled(exitPrice: number, exitQty: number): void {
    if (this.pePosition) {
      this.pePosition.target1Hit = true;
      this.pePosition.remainingQty = (this.pePosition.remainingQty || this.pePosition.quantity) - exitQty;
      this.pePosition.quantity = this.pePosition.remainingQty;
      this.pePosition.realizedPnl += Number(((exitPrice - this.pePosition.entryPrice) * exitQty).toFixed(2));
      logger.info(`[StateMachine] 🎯 PE Target 1 FILLED @ ₹${exitPrice} (${exitQty} Qty sold, ${this.pePosition.remainingQty} Qty remaining)`);
      this.emit('event', { type: 'PE_TARGET_1_FILL', data: { exitPrice, exitQty, remainingQty: this.pePosition.remainingQty } });
      this.emit('state:changed', this.getSummary());
    }
  }

  public onPePositionClosed(): void {
    this.peState = 'FLAT';
    this.pePosition = null;
    this.peExitCount += 1;
    logger.info(`[StateMachine] 🚪 PE Position CLOSED -> State is FLAT (Re-entry allowed on next breakout)`);
    this.emit('event', { type: 'PE_EXIT_FILL', data: { leg: 'PE', state: 'FLAT' } });
    this.emit('state:changed', this.getSummary());
  }

  /**
   * 15:10 Force Square-Off
   */
  public onForceSquareOff(): { exitCe: boolean; exitPe: boolean } {
    const exitCe = this.ceState === 'LONG';
    const exitPe = this.peState === 'LONG';

    this.ceState = 'FLAT';
    this.peState = 'FLAT';
    this.cePosition = null;
    this.pePosition = null;
    this.overallState = 'DAY_COMPLETED';

    logger.info(`[StateMachine] 🛑 15:10 Force Square-Off Complete: Exit CE=${exitCe} | Exit PE=${exitPe}`);
    this.emit('event', { type: 'FORCED_SQUAREOFF', data: { exitCe, exitPe, time: '15:10 IST' } });
    this.emit('state:changed', this.getSummary());

    return { exitCe, exitPe };
  }

  public updateLtp(leg: 'CE' | 'PE', ltp: number): void {
    if (leg === 'CE' && this.cePosition) {
      this.cePosition.currentLtp = ltp;
      this.cePosition.unrealizedPnl = (ltp - this.cePosition.entryPrice) * this.cePosition.quantity;
    } else if (leg === 'PE' && this.pePosition) {
      this.pePosition.currentLtp = ltp;
      this.pePosition.unrealizedPnl = (ltp - this.pePosition.entryPrice) * this.pePosition.quantity;
    }
  }

  public getSummary() {
    const totalPnl = (this.cePosition?.unrealizedPnl || 0) + (this.pePosition?.unrealizedPnl || 0);
    const activePositionsCount = (this.ceState === 'LONG' ? 1 : 0) + (this.peState === 'LONG' ? 1 : 0);

    return {
      strategyName: 'NIFTY ATM CE/PE Independent Breakout',
      status: this.overallState,
      sessionDate: this.sessionDate,
      tradingWindow: '09:20–15:10',
      lockedAtm: this.lockedAtm,

      // CE State Card Data
      ce: {
        symbol: this.lockedAtm?.ceSymbol || 'ATM CE',
        strike: this.lockedAtm?.atmStrike ? `${this.lockedAtm.atmStrike} CE` : '—',
        state: this.ceState,
        referenceClose: this.ceReferenceClose,
        upperLevel: this.ceUpperLevel,
        lowerLevel: this.ceLowerLevel,
        currentLtp: this.cePosition?.currentLtp || this.lockedAtm?.ceLtp || 0,
        position: this.cePosition,
        entryCount: this.ceEntryCount,
        exitCount: this.ceExitCount,
        lastCandleTime: this.lastCeCandleTimestamp,
        lastSignal: this.lastCeSignal
      },

      // PE State Card Data
      pe: {
        symbol: this.lockedAtm?.peSymbol || 'ATM PE',
        strike: this.lockedAtm?.atmStrike ? `${this.lockedAtm.atmStrike} PE` : '—',
        state: this.peState,
        referenceClose: this.peReferenceClose,
        upperLevel: this.peUpperLevel,
        lowerLevel: this.peLowerLevel,
        currentLtp: this.pePosition?.currentLtp || this.lockedAtm?.peLtp || 0,
        position: this.pePosition,
        entryCount: this.peEntryCount,
        exitCount: this.peExitCount,
        lastCandleTime: this.lastPeCandleTimestamp,
        lastSignal: this.lastPeSignal
      },

      // Combined Overview
      combined: {
        activePositionsCount,
        totalUnrealizedPnl: Number(totalPnl.toFixed(2)),
        totalTrades: this.ceEntryCount + this.peEntryCount,
        ceTrades: this.ceEntryCount,
        peTrades: this.peEntryCount,
        lastSignal: this.lastCeSignal || this.lastPeSignal || null
      }
    };
  }
}
