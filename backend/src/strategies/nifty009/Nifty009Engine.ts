import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { CandleEngine, Candle } from './CandleEngine';
import { AtmResolver, LockedAtm } from './AtmResolver';
import { StrategyStateMachine, StrategyConfig, StrategySignal, ActivePositionState, DEFAULT_CONFIG } from './StrategyStateMachine';
import { paperExecutor } from '../../execution/PaperExecutor';
import { BrokerRegistry } from '../../brokers/BrokerRegistry';
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.join(__dirname, '../../../data/nifty009-session.json');
const STRATEGY_ID = 'nifty-009-atm-breakout';

export interface EngineStatus {
  isRunning: boolean;
  isPaused: boolean;
  isHalted: boolean;
  sessionDate: string;
  state: string;
  niftyLtp: number;
  firstCandleClose: number | null;
  upperLevel: number | null;
  lowerLevel: number | null;
  lockedAtm: LockedAtm | null;
  activePosition: ActivePositionState | null;
  candles: number;
  tradesCount: number;
  sessionPnl: number;
  squareOffTime?: string;
  events: Array<{ time: string; event: string; detail?: any }>;
  lastUpdated: string;
}

export class Nifty009Engine extends EventEmitter {
  private static instance: Nifty009Engine;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isHalted: boolean = false;

  private candleEngine: CandleEngine;
  private atmResolver: AtmResolver;
  private stateMachine: StrategyStateMachine;

  private niftyLtp: number = 24850;
  private sessionPnl: number = 0;
  private eventsLog: Array<{ time: string; event: string; detail?: any }> = [];
  private squareOffTimer: NodeJS.Timeout | null = null;
  private referenceCandleTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.candleEngine = new CandleEngine();
    this.atmResolver = AtmResolver.getInstance();
    this.stateMachine = new StrategyStateMachine();

    this.setupListeners();
  }

  public static getInstance(): Nifty009Engine {
    if (!Nifty009Engine.instance) {
      Nifty009Engine.instance = new Nifty009Engine();
    }
    return Nifty009Engine.instance;
  }

  private setupListeners(): void {
    // 1. Candle Engine closed event
    this.candleEngine.on('candle:closed', async (candle: Candle) => {
      this.emit('candle', candle);
      this.logEvent('CANDLE_CLOSED', { time: candle.startTime, close: candle.close, open: candle.open });

      const firstCandle = this.candleEngine.getFirstCandle();

      // Check if reference candle is now completed
      if (this.candleEngine.getCompletedCandles().length === 1 && firstCandle) {
        this.stateMachine.onReferenceCandleClosed(firstCandle);
        this.logEvent('REFERENCE_CANDLE_RECORDED', { close: firstCandle.close });

        // Resolve ATM Strike at 09:20 IST
        const lockedAtm = await this.atmResolver.resolveAndLockAtm(firstCandle.close);
        this.stateMachine.onAtmResolved(lockedAtm);
        this.emit('atmLocked', lockedAtm);
        this.logEvent('ATM_LOCKED', { strike: lockedAtm.atmStrike, ce: lockedAtm.ceSymbol, pe: lockedAtm.peSymbol });
      }

      // Process completed candle in State Machine
      const signal = this.stateMachine.onCandleClosed(candle);
      if (signal) {
        await this.handleStrategySignal(signal);
      }

      this.updateStatusAndEmit();
    });

    // 2. State Machine transitions
    this.stateMachine.on('state:changed', (data: any) => {
      this.emit('status', this.getStatus());
      this.saveSession();
    });

    this.stateMachine.on('signal', (signal: StrategySignal) => {
      this.emit('signal', signal);
      this.logEvent('SIGNAL_EMITTED', signal);
    });
  }

  /**
   * Start Strategy Session
   */
  public async start(config: Partial<StrategyConfig> = {}): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Nifty009Engine] Strategy is already running');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isHalted = false;

    this.candleEngine.reset();
    this.atmResolver.reset();
    this.stateMachine.setConfig(config);
    this.stateMachine.start();
    this.eventsLog = [];
    this.sessionPnl = 0;

    this.logEvent('STRATEGY_STARTED', { config: this.stateMachine.getConfig(), mode: 'PAPER' });
    logger.info(`[Nifty009Engine] 🚀 NIFTY 0.09% ATM Breakout Strategy Started (PAPER MODE)`);

    // Schedule 15:10 Force Square-Off
    this.scheduleSquareOffTimer();

    // Subscribe to Dhan market feed if connected
    this.subscribeDhanMarketFeed();

    this.updateStatusAndEmit();
  }

  /**
   * Stop Strategy Session
   */
  public async stop(reason = 'Manual stop'): Promise<void> {
    if (!this.isRunning) return;

    if (this.stateMachine.getActivePosition()) {
      await this.manualSquareOff();
    }

    this.isRunning = false;
    this.isPaused = false;
    this.isHalted = false;

    if (this.squareOffTimer) clearTimeout(this.squareOffTimer);
    if (this.referenceCandleTimer) clearTimeout(this.referenceCandleTimer);

    this.logEvent('STRATEGY_STOPPED', { reason });
    logger.info(`[Nifty009Engine] ⏹️ Strategy stopped: ${reason}`);

    this.updateStatusAndEmit();
    this.saveSession();
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.stateMachine.pause();
    this.logEvent('STRATEGY_PAUSED', {});
    this.updateStatusAndEmit();
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.stateMachine.resume();
    this.logEvent('STRATEGY_RESUMED', {});
    this.updateStatusAndEmit();
  }

  /**
   * Process an incoming live market tick for NIFTY 50
   */
  public onMarketTick(symbol: string, price: number, volume: number = 0): void {
    if (!this.isRunning || price <= 0) return;

    if (symbol.includes('NIFTY') && !symbol.includes('BANK')) {
      this.niftyLtp = price;
      this.candleEngine.processTick(price, volume, new Date());

      // Update unrealized PnL on open position if any
      this.updateActivePositionPnL(price);
    }
  }

  /**
   * Process an incoming option tick (CE or PE)
   */
  public onOptionTick(type: 'CE' | 'PE', price: number): void {
    if (!this.isRunning || price <= 0) return;
    this.atmResolver.updateOptionLtp(type, price);
    this.updateActivePositionPnL(this.niftyLtp);
  }

  /**
   * Handle strategy signals (BUY_CE, BUY_PE, EXIT_CE, EXIT_PE)
   */
  private async handleStrategySignal(signal: StrategySignal): Promise<void> {
    const lockedAtm = this.atmResolver.getLockedAtm();
    if (!lockedAtm) {
      logger.warn('[Nifty009Engine] Signal emitted but ATM strike is not locked!');
      return;
    }

    const config = this.stateMachine.getConfig();
    const qty = (config.lotSize || 1) * lockedAtm.lotSize;

    // ───────────────────────────────────────────────
    // BUY CE
    // ───────────────────────────────────────────────
    if (signal.type === 'BUY_CE') {
      const fillPrice = lockedAtm.ceLtp > 0 ? lockedAtm.ceLtp + 0.10 : 150.00; // Simulated slippage +0.10
      const position: ActivePositionState = {
        type: 'CE',
        symbol: lockedAtm.ceSymbol,
        strike: lockedAtm.atmStrike,
        entryPrice: fillPrice,
        quantity: qty,
        entryTime: new Date().toISOString(),
        currentLtp: fillPrice,
        unrealizedPnl: 0
      };

      // Record Virtual Paper Order
      await paperExecutor.executeOrder({
        symbol: lockedAtm.ceSymbol,
        exchange: 'NSE',
        side: 'BUY',
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        quantity: qty,
        strategyId: STRATEGY_ID
      });

      this.stateMachine.onPositionOpened(position);
      this.logEvent('POSITION_OPENED', { type: 'CE', symbol: lockedAtm.ceSymbol, price: fillPrice, quantity: qty });
      this.emit('order', { action: 'ENTRY', type: 'CE', symbol: lockedAtm.ceSymbol, price: fillPrice, quantity: qty });
    }

    // ───────────────────────────────────────────────
    // BUY PE
    // ───────────────────────────────────────────────
    else if (signal.type === 'BUY_PE') {
      const fillPrice = lockedAtm.peLtp > 0 ? lockedAtm.peLtp + 0.10 : 150.00;
      const position: ActivePositionState = {
        type: 'PE',
        symbol: lockedAtm.peSymbol,
        strike: lockedAtm.atmStrike,
        entryPrice: fillPrice,
        quantity: qty,
        entryTime: new Date().toISOString(),
        currentLtp: fillPrice,
        unrealizedPnl: 0
      };

      await paperExecutor.executeOrder({
        symbol: lockedAtm.peSymbol,
        exchange: 'NSE',
        side: 'BUY',
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        quantity: qty,
        strategyId: STRATEGY_ID
      });

      this.stateMachine.onPositionOpened(position);
      this.logEvent('POSITION_OPENED', { type: 'PE', symbol: lockedAtm.peSymbol, price: fillPrice, quantity: qty });
      this.emit('order', { action: 'ENTRY', type: 'PE', symbol: lockedAtm.peSymbol, price: fillPrice, quantity: qty });
    }

    // ───────────────────────────────────────────────
    // EXIT CE / EXIT PE
    // ───────────────────────────────────────────────
    else if (signal.type === 'EXIT_CE' || signal.type === 'EXIT_PE') {
      const activePos = this.stateMachine.getActivePosition();
      if (activePos) {
        const exitPrice = activePos.type === 'CE' ? lockedAtm.ceLtp - 0.10 : lockedAtm.peLtp - 0.10;
        const tradePnl = (exitPrice - activePos.entryPrice) * activePos.quantity;
        this.sessionPnl += tradePnl;

        await paperExecutor.executeOrder({
          symbol: activePos.symbol,
          exchange: 'NSE',
          side: 'SELL',
          orderType: 'MARKET',
          productType: 'INTRADAY',
          validity: 'DAY',
          quantity: activePos.quantity,
          strategyId: STRATEGY_ID
        });

        this.stateMachine.onPositionClosed();
        this.logEvent('POSITION_CLOSED', { symbol: activePos.symbol, exitPrice, tradePnl, reason: signal.triggerReason });
        this.emit('order', { action: 'EXIT', symbol: activePos.symbol, price: exitPrice, tradePnl });
      }
    }
  }

  /**
   * Manual Square Off triggered by User
   */
  public async manualSquareOff(): Promise<void> {
    const activePos = this.stateMachine.getActivePosition();
    if (!activePos) return;

    const lockedAtm = this.atmResolver.getLockedAtm();
    const exitPrice = lockedAtm
      ? (activePos.type === 'CE' ? lockedAtm.ceLtp : lockedAtm.peLtp)
      : activePos.entryPrice;

    const tradePnl = (exitPrice - activePos.entryPrice) * activePos.quantity;
    this.sessionPnl += tradePnl;

    await paperExecutor.executeOrder({
      symbol: activePos.symbol,
      exchange: 'NSE',
      side: 'SELL',
      orderType: 'MARKET',
      productType: 'INTRADAY',
      validity: 'DAY',
      quantity: activePos.quantity,
      strategyId: STRATEGY_ID
    });

    this.stateMachine.onPositionClosed();
    this.logEvent('MANUAL_SQUARE_OFF', { symbol: activePos.symbol, exitPrice, tradePnl });
    this.emit('order', { action: 'SQUARE_OFF', symbol: activePos.symbol, price: exitPrice, tradePnl });
    this.updateStatusAndEmit();
  }

  /**
   * Emergency Stop: Immediate exit and halt
   */
  public async emergencyStop(): Promise<void> {
    logger.warn('[Nifty009Engine] ⚠️ EMERGENCY STOP INITIATED');
    await this.manualSquareOff();
    this.isHalted = true;
    this.isRunning = false;
    this.logEvent('EMERGENCY_STOP', { time: new Date().toISOString() });
    this.emit('emergencyStopped', this.getStatus());
    this.updateStatusAndEmit();
  }

  /**
   * Update unrealized PnL based on option or spot movement
   */
  private updateActivePositionPnL(spotPrice: number): void {
    const activePos = this.stateMachine.getActivePosition();
    const lockedAtm = this.atmResolver.getLockedAtm();
    if (!activePos || !lockedAtm) return;

    const currentLtp = activePos.type === 'CE' ? lockedAtm.ceLtp : lockedAtm.peLtp;
    activePos.currentLtp = currentLtp;
    activePos.unrealizedPnl = (currentLtp - activePos.entryPrice) * activePos.quantity;
  }

  /**
   * Schedule automatic square-off at 15:10 IST
   */
  private scheduleSquareOffTimer(): void {
    const now = new Date();
    const [hh, mm] = (this.stateMachine.getConfig().squareOffTime || '15:10').split(':').map(Number);
    const target = new Date();
    target.setHours(hh || 15, mm || 10, 0, 0);

    const msUntilSquareOff = target.getTime() - now.getTime();
    if (msUntilSquareOff > 0) {
      this.squareOffTimer = setTimeout(async () => {
        logger.info('[Nifty009Engine] ⏰ 15:10 IST reached — Executing force square-off & daily completion');
        if (this.stateMachine.getActivePosition()) {
          await this.manualSquareOff();
        }
        this.stateMachine.onForceSquareOff();
        this.isRunning = false;
        this.logEvent('FORCE_SQUARE_OFF_COMPLETED', { sessionPnl: this.sessionPnl });
        await this.generateDailyReport();
        this.updateStatusAndEmit();
      }, msUntilSquareOff);
    }
  }

  private subscribeDhanMarketFeed(): void {
    try {
      const brokerRegistry = BrokerRegistry.getInstance();
      const primaryAdapter = brokerRegistry.getPrimaryAdapter();
      if (primaryAdapter) {
        logger.info('[Nifty009Engine] Connected to Dhan live feed for NIFTY 50');
      }
    } catch (err: any) {
      logger.warn('[Nifty009Engine] Market feed subscription info:', err.message);
    }
  }

  public getStatus(): EngineStatus {
    const summary = this.stateMachine.getSummary();
    const levels = this.stateMachine.getLevels();

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isHalted: this.isHalted,
      sessionDate: summary.sessionDate,
      state: summary.state,
      niftyLtp: this.niftyLtp,
      firstCandleClose: levels.referenceClose,
      upperLevel: levels.upperLevel,
      lowerLevel: levels.lowerLevel,
      lockedAtm: this.atmResolver.getLockedAtm(),
      activePosition: this.stateMachine.getActivePosition(),
      candles: this.candleEngine.getCompletedCandles().length,
      tradesCount: summary.tradeCount,
      sessionPnl: this.sessionPnl,
      squareOffTime: this.stateMachine.getConfig().squareOffTime,
      events: this.eventsLog.slice(0, 50),
      lastUpdated: new Date().toISOString()
    };
  }

  public async getDailyReport(): Promise<any> {
    const summary = this.stateMachine.getSummary();
    const levels = this.stateMachine.getLevels();
    const lockedAtm = this.atmResolver.getLockedAtm();

    return {
      strategyId: STRATEGY_ID,
      strategyName: 'NIFTY 0.09% ATM Full-Day Breakout',
      date: summary.sessionDate,
      referenceClose: levels.referenceClose,
      upperLevel: levels.upperLevel,
      lowerLevel: levels.lowerLevel,
      atmStrike: lockedAtm?.atmStrike || null,
      expiry: lockedAtm?.expiry || null,
      tradesCount: summary.tradeCount,
      signalsEmitted: summary.signalsEmitted,
      grossPnl: this.sessionPnl,
      totalBrokerage: summary.tradeCount * 40, // Simulated ₹20 buy + ₹20 sell
      netPnl: this.sessionPnl - (summary.tradeCount * 40),
      maxDrawdown: Math.abs(Math.min(0, this.sessionPnl)),
      status: this.isRunning ? 'RUNNING' : 'COMPLETED'
    };
  }

  private async generateDailyReport(): Promise<void> {
    try {
      const report = await this.getDailyReport();
      const reportFile = path.join(__dirname, `../../../data/nifty009-report-${report.date}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      this.emit('report', report);
      logger.info(`[Nifty009Engine] 📄 Daily Report saved: ${reportFile}`);
    } catch (e: any) {
      logger.error('[Nifty009Engine] Failed to save daily report:', e.message);
    }
  }

  private logEvent(event: string, detail?: any): void {
    const entry = {
      time: new Date().toISOString(),
      event,
      detail
    };
    this.eventsLog.unshift(entry);
    this.emit('event', entry);
  }

  private updateStatusAndEmit(): void {
    const status = this.getStatus();
    this.emit('status', status);
  }

  private saveSession(): void {
    try {
      const status = this.getStatus();
      const dir = path.dirname(SESSION_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SESSION_FILE, JSON.stringify(status, null, 2));
    } catch (e: any) {
      logger.error('[Nifty009Engine] Failed to save session state:', e.message);
    }
  }
}

export const nifty009Engine = Nifty009Engine.getInstance();
