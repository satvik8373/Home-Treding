import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { Candle } from './CandleEngine';
import { LockedAtm } from './AtmResolver';

export type StrategyState =
  | 'IDLE'
  | 'WAITING_FOR_MARKET'
  | 'CAPTURING_REFERENCE_CANDLE'
  | 'REFERENCE_CANDLE_COMPLETED'
  | 'CALCULATE_LEVELS'
  | 'SELECT_ATM'
  | 'WAITING_FOR_SIGNAL'
  | 'CE_ACTIVE'
  | 'PE_ACTIVE'
  | 'SQUARE_OFF_PENDING'
  | 'DAY_COMPLETED'
  | 'HALTED';

export interface StrategyConfig {
  lotSize: number;
  capitalAllocation: number;
  squareOffTime: string; // HH:MM in IST (default: '15:10')
  maxTradesPerDay: number; // default: 3
  maxDailyLoss: number; // default: 5000
  enableReEntry: boolean; // default: true
}

export const DEFAULT_CONFIG: StrategyConfig = {
  lotSize: 1,
  capitalAllocation: 100000,
  squareOffTime: '15:10',
  maxTradesPerDay: 3,
  maxDailyLoss: 5000,
  enableReEntry: true
};

export interface StrategySignal {
  id: string;
  type: 'BUY_CE' | 'BUY_PE' | 'EXIT_CE' | 'EXIT_PE' | 'SQUARE_OFF';
  triggerReason: string;
  niftyClose: number;
  timestamp: string;
  upperLevel: number;
  lowerLevel: number;
}

export interface ActivePositionState {
  type: 'CE' | 'PE';
  symbol: string;
  strike: number;
  entryPrice: number;
  quantity: number;
  entryTime: string;
  currentLtp: number;
  unrealizedPnl: number;
}

export class StrategyStateMachine extends EventEmitter {
  private state: StrategyState = 'IDLE';
  private config: StrategyConfig = { ...DEFAULT_CONFIG };
  private sessionDate: string = '';
  private referenceClose: number | null = null;
  private upperLevel: number | null = null;
  private lowerLevel: number | null = null;
  private lockedAtm: LockedAtm | null = null;
  private activePosition: ActivePositionState | null = null;
  private tradeCount: number = 0;
  private processedSignals: Set<string> = new Set();
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

  public getState(): StrategyState {
    return this.state;
  }

  public getLevels(): { referenceClose: number | null; upperLevel: number | null; lowerLevel: number | null } {
    return {
      referenceClose: this.referenceClose,
      upperLevel: this.upperLevel,
      lowerLevel: this.lowerLevel
    };
  }

  public getActivePosition(): ActivePositionState | null {
    return this.activePosition ? { ...this.activePosition } : null;
  }

  public getTradeCount(): number {
    return this.tradeCount;
  }

  public start(dateStr?: string): void {
    this.sessionDate = dateStr || new Date().toISOString().split('T')[0];
    this.tradeCount = 0;
    this.processedSignals.clear();
    this.signalsHistory = [];
    this.referenceClose = null;
    this.upperLevel = null;
    this.lowerLevel = null;
    this.activePosition = null;

    this.transitionTo('WAITING_FOR_MARKET', { reason: 'Strategy engine started' });
  }

  public pause(): void {
    if (this.state !== 'DAY_COMPLETED' && this.state !== 'HALTED') {
      this.transitionTo('HALTED', { reason: 'Strategy paused by user' });
    }
  }

  public resume(): void {
    if (this.state === 'HALTED') {
      if (this.activePosition) {
        this.transitionTo(this.activePosition.type === 'CE' ? 'CE_ACTIVE' : 'PE_ACTIVE', { reason: 'Resumed with open position' });
      } else if (this.upperLevel && this.lowerLevel && this.lockedAtm) {
        this.transitionTo('WAITING_FOR_SIGNAL', { reason: 'Resumed and waiting for signals' });
      } else {
        this.transitionTo('WAITING_FOR_MARKET', { reason: 'Resumed' });
      }
    }
  }

  public onReferenceCandleClosed(candle: Candle): void {
    if (this.state === 'IDLE' || this.state === 'HALTED' || this.state === 'DAY_COMPLETED') return;

    this.referenceClose = candle.close;
    // 0.09% calculation: upper = close * 1.0009, lower = close * 0.9991
    this.upperLevel = Math.round((this.referenceClose * 1.0009) * 1000) / 1000;
    this.lowerLevel = Math.round((this.referenceClose * 0.9991) * 1000) / 1000;

    logger.info(`[StateMachine] 🎯 Reference Candle Closed: Close=${this.referenceClose} | Upper Level=${this.upperLevel} (+0.09%) | Lower Level=${this.lowerLevel} (-0.09%)`);
    this.transitionTo('CALCULATE_LEVELS', { referenceClose: this.referenceClose, upper: this.upperLevel, lower: this.lowerLevel });
    this.transitionTo('SELECT_ATM', { spot: this.referenceClose });
  }

  public onAtmResolved(lockedAtm: LockedAtm): void {
    this.lockedAtm = lockedAtm;
    if (this.state === 'SELECT_ATM' || this.state === 'CALCULATE_LEVELS') {
      this.transitionTo('WAITING_FOR_SIGNAL', { lockedAtm });
    }
  }

  /**
   * Evaluate completed 5-minute candle against breakout levels.
   * Only completed candle close triggers entry / exit. Intrabar touch does not.
   */
  public onCandleClosed(candle: Candle): StrategySignal | null {
    if (this.state === 'IDLE' || this.state === 'HALTED' || this.state === 'DAY_COMPLETED') {
      return null;
    }

    if (!this.upperLevel || !this.lowerLevel || !this.lockedAtm) {
      return null;
    }

    const closePrice = candle.close;
    const isAboveUpper = closePrice > this.upperLevel;
    const isBelowLower = closePrice < this.lowerLevel;

    // Check Max Trades Limit
    const maxTradesReached = this.tradeCount >= this.config.maxTradesPerDay;

    let emittedSignal: StrategySignal | null = null;

    // ───────────────────────────────────────────────
    // State 1: WAITING_FOR_SIGNAL (No Active Position)
    // ───────────────────────────────────────────────
    if (this.state === 'WAITING_FOR_SIGNAL') {
      if (maxTradesReached) {
        logger.info(`[StateMachine] Max daily trades reached (${this.tradeCount}/${this.config.maxTradesPerDay}). No new entries allowed.`);
        return null;
      }

      if (isAboveUpper) {
        const signalId = this.generateSignalId('BUY_CE', candle.startTime);
        if (!this.processedSignals.has(signalId)) {
          this.processedSignals.add(signalId);
          emittedSignal = {
            id: signalId,
            type: 'BUY_CE',
            triggerReason: `5-Min Close (${closePrice}) > Upper Level (${this.upperLevel})`,
            niftyClose: closePrice,
            timestamp: candle.endTime,
            upperLevel: this.upperLevel,
            lowerLevel: this.lowerLevel
          };
          this.signalsHistory.push(emittedSignal);
          this.emit('signal', emittedSignal);
        }
      } else if (isBelowLower) {
        const signalId = this.generateSignalId('BUY_PE', candle.startTime);
        if (!this.processedSignals.has(signalId)) {
          this.processedSignals.add(signalId);
          emittedSignal = {
            id: signalId,
            type: 'BUY_PE',
            triggerReason: `5-Min Close (${closePrice}) < Lower Level (${this.lowerLevel})`,
            niftyClose: closePrice,
            timestamp: candle.endTime,
            upperLevel: this.upperLevel,
            lowerLevel: this.lowerLevel
          };
          this.signalsHistory.push(emittedSignal);
          this.emit('signal', emittedSignal);
        }
      }
    }

    // ───────────────────────────────────────────────
    // State 2: CE_ACTIVE (Holding Call Option)
    // ───────────────────────────────────────────────
    else if (this.state === 'CE_ACTIVE') {
      // Exit condition: 5-minute close < lowerLevel
      if (isBelowLower) {
        const signalId = this.generateSignalId('EXIT_CE', candle.startTime);
        if (!this.processedSignals.has(signalId)) {
          this.processedSignals.add(signalId);
          emittedSignal = {
            id: signalId,
            type: 'EXIT_CE',
            triggerReason: `5-Min Close (${closePrice}) < Lower Level (${this.lowerLevel}) while CE is active`,
            niftyClose: closePrice,
            timestamp: candle.endTime,
            upperLevel: this.upperLevel,
            lowerLevel: this.lowerLevel
          };
          this.signalsHistory.push(emittedSignal);
          this.emit('signal', emittedSignal);
        }
      }
    }

    // ───────────────────────────────────────────────
    // State 3: PE_ACTIVE (Holding Put Option)
    // ───────────────────────────────────────────────
    else if (this.state === 'PE_ACTIVE') {
      // Exit condition: 5-minute close > upperLevel
      if (isAboveUpper) {
        const signalId = this.generateSignalId('EXIT_PE', candle.startTime);
        if (!this.processedSignals.has(signalId)) {
          this.processedSignals.add(signalId);
          emittedSignal = {
            id: signalId,
            type: 'EXIT_PE',
            triggerReason: `5-Min Close (${closePrice}) > Upper Level (${this.upperLevel}) while PE is active`,
            niftyClose: closePrice,
            timestamp: candle.endTime,
            upperLevel: this.upperLevel,
            lowerLevel: this.lowerLevel
          };
          this.signalsHistory.push(emittedSignal);
          this.emit('signal', emittedSignal);
        }
      }
    }

    return emittedSignal;
  }

  /**
   * Called by engine when an order is filled
   */
  public onPositionOpened(position: ActivePositionState): void {
    this.activePosition = position;
    this.tradeCount += 1;
    if (position.type === 'CE') {
      this.transitionTo('CE_ACTIVE', { position });
    } else {
      this.transitionTo('PE_ACTIVE', { position });
    }
  }

  public onPositionClosed(): void {
    this.activePosition = null;
    if (this.state !== 'DAY_COMPLETED' && this.state !== 'HALTED') {
      this.transitionTo('WAITING_FOR_SIGNAL', { reason: 'Position squared off. Continuing full-day watch.' });
    }
  }

  public onForceSquareOff(): void {
    this.transitionTo('DAY_COMPLETED', { reason: '15:10 Force square-off completed for session' });
  }

  private generateSignalId(type: string, timestamp: string): string {
    return `NIFTY009_${this.sessionDate}_${timestamp}_${type}`;
  }

  private transitionTo(newState: StrategyState, data: any = {}): void {
    const prevState = this.state;
    this.state = newState;
    logger.info(`[StateMachine] 🔄 Transition: ${prevState} ➔ ${newState}`);
    this.emit('state:changed', { from: prevState, to: newState, data });
  }

  public getSummary() {
    return {
      state: this.state,
      sessionDate: this.sessionDate,
      referenceClose: this.referenceClose,
      upperLevel: this.upperLevel,
      lowerLevel: this.lowerLevel,
      lockedAtm: this.lockedAtm,
      activePosition: this.activePosition,
      tradeCount: this.tradeCount,
      maxTradesPerDay: this.config.maxTradesPerDay,
      signalsEmitted: this.signalsHistory.length,
      signals: this.signalsHistory
    };
  }
}
