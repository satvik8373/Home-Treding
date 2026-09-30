import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { CandleEngine, Candle } from './CandleEngine';
import { AtmResolver, LockedAtm } from './AtmResolver';
import { StrategyStateMachine, StrategyConfig, StrategySignal, LegPosition } from './StrategyStateMachine';
import { getStrategyConfig } from '../../config/strategyConfig';
import { BrokerRegistry } from '../../brokers/BrokerRegistry';
import { paperTradingManager } from '../../execution/PaperTradingManager';
import { OrderRequest } from '../../brokers/types';
import { DhanAdapter } from '../../brokers/dhan/DhanAdapter';
import { DhanHistoricalDataService } from '../../backtest/DhanHistoricalDataService';
import fs from 'fs';
import path from 'path';

const STRATEGY_ID = 'nifty-atm-independent-breakout';
const SESSION_FILE = path.join(__dirname, '../../../data/nifty009_session.json');

export interface StrategyEvent {
  timestamp: string;
  type: string;
  data?: any;
}

export class Nifty009Engine extends EventEmitter {
  private static instance: Nifty009Engine;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isHalted: boolean = false;
  private mode: 'paper' | 'live' = 'paper';
  private userId: string = 'user_admin';

  // Dual independent candle engines for ATM CE and ATM PE
  private ceCandleEngine: CandleEngine;
  private peCandleEngine: CandleEngine;
  private spotCandleEngine: CandleEngine;

  private atmResolver: AtmResolver;
  private stateMachine: StrategyStateMachine;

  private niftyLtp: number = 0;
  private ceLtp: number = 0;
  private peLtp: number = 0;
  private feedAdapter: DhanAdapter | null = null;
  private optionFeedListener: ((tick: any) => void) | null = null;
  private targetProcessing = new Set<'CE' | 'PE'>();

  private eventsLog: StrategyEvent[] = [];
  private squareOffTimer: NodeJS.Timeout | null = null;
  private sessionPnl: number = 0;

  constructor() {
    super();
    this.ceCandleEngine = new CandleEngine();
    this.peCandleEngine = new CandleEngine();
    this.spotCandleEngine = new CandleEngine();
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
    // 1. CE 5-Minute Candle Closed Listener
    this.ceCandleEngine.on('candle:closed', async (candle: Candle) => {
      this.emit('candle:ce', candle);
      this.logEvent('CE_CANDLE_CLOSED', { time: candle.startTime, close: candle.close });

      // Check if CE reference candle is needed
      const ceLevels = this.stateMachine.getCeLevels();
      if (ceLevels.referenceClose === null && new Date(candle.startTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) === '09:15') {
        this.stateMachine.setCeReferenceCandle(candle);
      }

      // Process CE completed candle in state machine
      const signal = this.stateMachine.onCeCandleClosed(candle);
      if (signal) {
        try { await this.handleCeSignal(signal); }
        catch (error: any) { this.pause(); this.logEvent('EXECUTION_FAILED', { leg: 'CE', reason: error.message }); }
      }

      this.updateStatusAndEmit();
    });

    // 2. PE 5-Minute Candle Closed Listener
    this.peCandleEngine.on('candle:closed', async (candle: Candle) => {
      this.emit('candle:pe', candle);
      this.logEvent('PE_CANDLE_CLOSED', { time: candle.startTime, close: candle.close });

      // Check if PE reference candle is needed
      const peLevels = this.stateMachine.getPeLevels();
      if (peLevels.referenceClose === null && new Date(candle.startTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) === '09:15') {
        this.stateMachine.setPeReferenceCandle(candle);
      }

      // Process PE completed candle in state machine
      const signal = this.stateMachine.onPeCandleClosed(candle);
      if (signal) {
        try { await this.handlePeSignal(signal); }
        catch (error: any) { this.pause(); this.logEvent('EXECUTION_FAILED', { leg: 'PE', reason: error.message }); }
      }

      this.updateStatusAndEmit();
    });

    // 3. State Machine Events
    this.stateMachine.on('event', (evt: { type: string; data?: any }) => {
      this.logEvent(evt.type, evt.data);
      this.emit('event', evt);
    });

    this.stateMachine.on('state:changed', (summary: any) => {
      this.emit('status', this.getStatus());
      this.saveSession();
    });

    this.stateMachine.on('signal', (signal: StrategySignal) => {
      this.emit('signal', signal);
    });
  }

  /**
   * Start Strategy Session
   */
  public async start(
    config: Partial<StrategyConfig> = {},
    mode: 'paper' | 'live' = 'paper',
    userId: string = 'user_admin'
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Nifty009Engine] Strategy is already running');
      return;
    }

    if (mode === 'live') {
      throw new Error('LIVE_EXECUTION_NOT_READY: Broker fills and partial fills are not safely reconciled. Live trading is blocked.');
    }
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    if (time < '09:20' || time >= '15:10') throw new Error('STRATEGY_SESSION_CLOSED: Start between 09:20 and 15:10 IST.');
    const auth = DhanHistoricalDataService.resolveAuth(userId);
    if (!auth) throw new Error('DHAN_AUTH_REQUIRED: Connect Dhan before starting the strategy.');
    const dhan = new DhanHistoricalDataService(auth);
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const toDate = tomorrow.toISOString().slice(0, 10);
    const spot = await dhan.getIntradayCandles({ securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX', fromDate: today, toDate, interval: 5 });
    const spotRef = spot.find(c => c.date === today && c.time === '09:15');
    if (!spotRef || spotRef.close <= 0) throw new Error('DHAN_REFERENCE_UNAVAILABLE: Missing NIFTY 09:15–09:20 close.');
    this.atmResolver.reset();
    const lockedAtm = await this.atmResolver.resolveAndLockAtm(spotRef.close, getStrategyConfig().niftyLotSize, userId);
    const [ceCandles, peCandles] = await Promise.all([
      dhan.getIntradayCandles({ securityId: lockedAtm.ceSecurityId, exchangeSegment: 'NSE_FNO', instrument: 'OPTIDX', fromDate: today, toDate, interval: 5 }),
      dhan.getIntradayCandles({ securityId: lockedAtm.peSecurityId, exchangeSegment: 'NSE_FNO', instrument: 'OPTIDX', fromDate: today, toDate, interval: 5 })
    ]);
    const ceRef = ceCandles.find(c => c.date === today && c.time === '09:15');
    const peRef = peCandles.find(c => c.date === today && c.time === '09:15');
    if (!ceRef || !peRef || ceRef.close <= 0 || peRef.close <= 0 || ceRef.volume <= 0 || peRef.volume <= 0) {
      this.atmResolver.reset();
      throw new Error('DHAN_REFERENCE_UNAVAILABLE: Missing traded 09:15–09:20 ATM option candles.');
    }
    const adapter = BrokerRegistry.getInstance().getPrimaryAdapter(userId) as DhanAdapter | null;
    if (!adapter?.getStatus()) throw new Error('DHAN_AUTH_REQUIRED: Dhan market feed is disconnected.');

    this.isRunning = true;
    this.isPaused = false;
    this.isHalted = false;
    this.mode = mode;
    this.userId = userId;

    this.ceCandleEngine.reset();
    this.peCandleEngine.reset();
    this.spotCandleEngine.reset();
    this.stateMachine.setConfig(config);
    this.stateMachine.start(today);
    this.eventsLog = [];
    this.sessionPnl = 0;
    this.targetProcessing.clear();

    this.logEvent('STRATEGY_STARTED', { mode: this.mode.toUpperCase(), config: this.stateMachine.getConfig() });
    logger.info(`[Nifty009Engine] 🚀 NIFTY ATM CE/PE Independent Breakout Started (${this.mode.toUpperCase()} MODE)`);

    // 1. Identify current NIFTY 50 spot & lock ATM CE + ATM PE contracts
    this.niftyLtp = spotRef.close;
    this.ceLtp = lockedAtm.ceLtp;
    this.peLtp = lockedAtm.peLtp;
    this.stateMachine.onAtmResolved(lockedAtm);
    const toReference = (c: typeof ceRef): Candle => ({ startTime: `${today}T09:15:00+05:30`, endTime: `${today}T09:20:00+05:30`,
      open: c!.open, high: c!.high, low: c!.low, close: c!.close, volume: c!.volume, isClosed: true });
    this.stateMachine.setCeReferenceCandle(toReference(ceRef));
    this.stateMachine.setPeReferenceCandle(toReference(peRef));

    // 3. Schedule 15:10 IST Force Square-Off
    this.scheduleSquareOffTimer();

    // 4. Subscribe to Dhan market feed if connected
    this.subscribeDhanMarketFeed(adapter, lockedAtm);

    this.updateStatusAndEmit();
    this.saveSession();
  }

  public setMode(mode: 'paper' | 'live'): void {
    if (mode === 'live') throw new Error('LIVE_EXECUTION_NOT_READY: Broker fill reconciliation is required before live trading.');
    const old = this.mode;
    this.mode = mode;
    this.logEvent('TRADING_MODE_CHANGED', { from: old, to: mode });
    logger.info(`[Nifty009Engine] Mode changed: ${old.toUpperCase()} -> ${mode.toUpperCase()}`);
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
   * Process Real-Time Market Ticks
   */
  public onMarketTick(symbol: string, price: number, volume: number = 0): void {
    if (!this.isRunning || price <= 0) return;

    if (symbol === 'NIFTY 50' || symbol === 'NIFTY') {
      this.niftyLtp = price;
      this.spotCandleEngine.processTick(price, volume, new Date());


      const ceLevels = this.stateMachine.getCeLevels();
      const peLevels = this.stateMachine.getPeLevels();

      // Emit high-speed live tick
      this.emit('strategy_tick', {
        niftyLtp: this.niftyLtp,
        ceLtp: this.ceLtp,
        peLtp: this.peLtp,
        ceReference: ceLevels.referenceClose,
        ceUpper: ceLevels.upperLevel,
        ceLower: ceLevels.lowerLevel,
        peReference: peLevels.referenceClose,
        peUpper: peLevels.upperLevel,
        peLower: peLevels.lowerLevel,
        ceState: this.stateMachine.getCeState(),
        peState: this.stateMachine.getPeState(),
        timestamp: new Date().toISOString()
      });

      this.updateStatusAndEmit();
    }
  }

  public onOptionTick(type: 'CE' | 'PE', price: number, volume: number = 0): void {
    if (!this.isRunning || price <= 0) return;

    if (type === 'CE') {
      this.ceLtp = price;
      this.atmResolver.updateOptionLtp('CE', price);
      this.ceCandleEngine.processTick(price, volume, new Date());
      this.stateMachine.updateLtp('CE', price);
    } else {
      this.peLtp = price;
      this.atmResolver.updateOptionLtp('PE', price);
      this.peCandleEngine.processTick(price, volume, new Date());
      this.stateMachine.updateLtp('PE', price);
    }

    void this.handleTickTarget(type, price);

    this.updateStatusAndEmit();
  }

  private async handleTickTarget(type: 'CE' | 'PE', price: number): Promise<void> {
    if (this.isPaused || this.mode !== 'paper' || this.targetProcessing.has(type)) return;
    this.targetProcessing.add(type);
    try {
      for (let i = 0; i < 2; i++) {
        const pos = type === 'CE' ? this.stateMachine.getCePosition() : this.stateMachine.getPePosition();
        if (!pos) break;
        const target1 = !pos.target1Hit && pos.target1Price && price >= pos.target1Price;
        const target2 = pos.target2Price && price >= pos.target2Price;
        if (!target1 && !target2) break;
        const levels = type === 'CE' ? this.stateMachine.getCeLevels() : this.stateMachine.getPeLevels();
        const signal: StrategySignal = {
          id: `${type}_${target1 ? 'TARGET_1' : 'TARGET_2'}_${Date.now()}`,
          leg: type,
          type: `${target1 ? 'TARGET_1' : 'TARGET_2'}_${type}` as StrategySignal['type'],
          triggerReason: `${type} option tick reached ${target1 ? 'target 1' : 'target 2'}`,
          triggerPrice: target1 ? pos.target1Price! : pos.target2Price!,
          timestamp: new Date().toISOString(),
          upperLevel: levels.upperLevel!,
          lowerLevel: levels.lowerLevel!,
          quantity: target1 ? Math.min(this.atmResolver.getLockedAtm()!.lotSize, pos.quantity) : pos.quantity
        };
        if (type === 'CE') await this.handleCeSignal(signal);
        else await this.handlePeSignal(signal);
      }
    } catch (error: any) {
      this.pause();
      this.logEvent('EXECUTION_FAILED', { leg: type, reason: error.message });
    } finally {
      this.targetProcessing.delete(type);
    }
  }

  private async executePaperOrder(orderReq: OrderRequest): Promise<number> {
    const result = await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
    if (!result.success || result.status !== 'FILLED' || !Number.isFinite(result.averagePrice) || result.averagePrice! <= 0) {
      throw new Error(`PAPER_ORDER_NOT_FILLED: ${result.rejectionReason || result.status}`);
    }
    return result.averagePrice!;
  }

  private async handleCeSignal(signal: StrategySignal): Promise<void> {
    await this.handlePaperSignal(signal, 'CE');
  }

  private async handlePeSignal(signal: StrategySignal): Promise<void> {
    await this.handlePaperSignal(signal, 'PE');
  }

  private async handlePaperSignal(signal: StrategySignal, type: 'CE' | 'PE'): Promise<void> {
    if (this.mode !== 'paper') throw new Error('LIVE_EXECUTION_NOT_READY');
    const locked = this.atmResolver.getLockedAtm();
    if (!locked) throw new Error('DHAN_ATM_CONTRACT_UNAVAILABLE');
    const ltp = type === 'CE' ? this.ceLtp : this.peLtp;
    if (!Number.isFinite(ltp) || ltp <= 0) throw new Error(`OPTION_PRICE_UNAVAILABLE: ${type}`);
    const symbol = type === 'CE' ? locked.ceSymbol : locked.peSymbol;
    const securityId = type === 'CE' ? locked.ceSecurityId : locked.peSecurityId;
    const isEntry = signal.type === `BUY_${type}`;
    const existing = type === 'CE' ? this.stateMachine.getCePosition() : this.stateMachine.getPePosition();
    if (isEntry && existing) return;
    if (!isEntry && !existing) return;
    const isTarget1 = signal.type === `TARGET_1_${type}`;
    const quantity = isEntry ? signal.quantity : Math.min(isTarget1 ? locked.lotSize : (signal.quantity || existing!.quantity), existing!.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('INVALID_ORDER_QUANTITY');
    const orderReq: OrderRequest = {
      symbol, securityId, exchange: 'NFO', side: isEntry ? 'BUY' : 'SELL', quantity,
      price: ltp, orderType: 'MARKET', productType: 'INTRADAY', validity: 'DAY',
      strategyId: STRATEGY_ID, userId: this.userId, isPaper: true
    };
    const fillPrice = await this.executePaperOrder(orderReq);
    if (isEntry) {
      const position: LegPosition = {
        leg: type, symbol, securityId, strike: locked.atmStrike, entryPrice: fillPrice,
        quantity, totalQty: quantity, remainingQty: quantity, entryTime: new Date().toISOString(),
        currentLtp: fillPrice, unrealizedPnl: 0, realizedPnl: 0,
        target1Price: Number((fillPrice + getStrategyConfig().target1Pts).toFixed(2)),
        target2Price: Number((fillPrice + getStrategyConfig().target2Pts).toFixed(2)), target1Hit: false
      };
      if (type === 'CE') this.stateMachine.onCePositionOpened(position);
      else this.stateMachine.onPePositionOpened(position);
    } else {
      this.sessionPnl += (fillPrice - existing!.entryPrice) * quantity;
      if (isTarget1 && quantity < existing!.quantity) {
        if (type === 'CE') this.stateMachine.onCeTarget1Filled(fillPrice, quantity);
        else this.stateMachine.onPeTarget1Filled(fillPrice, quantity);
      } else if (type === 'CE') this.stateMachine.onCePositionClosed();
      else this.stateMachine.onPePositionClosed();
    }
    this.logEvent('PAPER_ORDER_FILLED', { leg: type, side: orderReq.side, quantity, fillPrice, reason: signal.triggerReason });
    this.emit('order', { leg: type, type: orderReq.side, symbol, quantity, price: fillPrice, reason: signal.triggerReason });
  }

  /**
   * 15:10 Force Square-Off
   */
  public async forceSquareOff(): Promise<void> {
    if (!this.isRunning) return;
    const cePos = this.stateMachine.getCePosition();
    const pePos = this.stateMachine.getPePosition();
    if (this.mode !== 'paper') throw new Error('LIVE_EXECUTION_NOT_READY');
    for (const pos of [cePos, pePos]) {
      if (!pos) continue;
      const price = pos.leg === 'CE' ? this.ceLtp : this.peLtp;
      if (!Number.isFinite(price) || price <= 0) throw new Error(`OPTION_PRICE_UNAVAILABLE: ${pos.leg}`);
      const orderReq: OrderRequest = { symbol: pos.symbol, securityId: pos.securityId, exchange: 'NFO', side: 'SELL',
        quantity: pos.quantity, price, orderType: 'MARKET', productType: 'INTRADAY', validity: 'DAY',
        strategyId: STRATEGY_ID, userId: this.userId, isPaper: true };
      const filledPrice = await this.executePaperOrder(orderReq);
      this.sessionPnl += (filledPrice - pos.entryPrice) * pos.quantity;
      if (pos.leg === 'CE') this.stateMachine.onCePositionClosed();
      else this.stateMachine.onPePositionClosed();
    }
    this.stateMachine.onForceSquareOff();
    this.logEvent('FORCED_SQUAREOFF', { exitCe: !!cePos, exitPe: !!pePos, sessionPnl: this.sessionPnl });
    this.updateStatusAndEmit();
    this.saveSession();
  }

  public async manualSquareOff(): Promise<void> {
    return this.forceSquareOff();
  }

  public async emergencyStop(): Promise<void> {
    await this.forceSquareOff();
    this.stop();
  }

  public stop(reason: string = 'Strategy stopped'): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.isPaused = false;
    if (this.feedAdapter && this.optionFeedListener) {
      this.feedAdapter.off('tick', this.optionFeedListener);
      const locked = this.atmResolver.getLockedAtm();
      if (locked) void this.feedAdapter.unsubscribeMarketData(['IDX_I:13', `NSE_FNO:${locked.ceSecurityId}`, `NSE_FNO:${locked.peSecurityId}`]);
    }
    this.feedAdapter = null;
    this.optionFeedListener = null;
    if (this.squareOffTimer) {
      clearTimeout(this.squareOffTimer);
      this.squareOffTimer = null;
    }
    this.logEvent('STRATEGY_STOPPED', { reason, sessionPnl: this.sessionPnl });
    this.updateStatusAndEmit();
    this.saveSession();
  }

  private scheduleSquareOffTimer(): void {
    if (this.squareOffTimer) clearTimeout(this.squareOffTimer);

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    // Target is today 15:10 IST
    const istTarget = new Date(now.getTime() + istOffset);
    istTarget.setUTCHours(15, 10, 0, 0);

    const delay = istTarget.getTime() - istNow.getTime();
    if (delay > 0) {
      this.squareOffTimer = setTimeout(() => {
        void this.forceSquareOff().catch((error: any) => {
          this.pause();
          this.logEvent('SQUARE_OFF_FAILED', { reason: error.message });
        });
      }, delay);
      logger.info(`[Nifty009Engine] 15:10 IST force square-off scheduled in ${Math.round(delay / 60000)} minutes`);
    } else {
      logger.info('[Nifty009Engine] Current time is past 15:10 IST for today');
    }
  }

  private subscribeDhanMarketFeed(adapter: DhanAdapter, locked: LockedAtm): void {
    this.feedAdapter = adapter;
    this.optionFeedListener = (tick: any) => {
      if (!Number.isFinite(tick?.ltp) || tick.ltp <= 0) return;
      if (tick.exchange === 'IDX_I' && String(tick.securityId) === '13') {
        this.onMarketTick('NIFTY 50', tick.ltp, tick.volume || 0);
        return;
      }
      if (tick.exchange !== 'NSE_FNO') return;
      if (String(tick.securityId) === locked.ceSecurityId) this.onOptionTick('CE', tick.ltp, tick.volume || 0);
      else if (String(tick.securityId) === locked.peSecurityId) this.onOptionTick('PE', tick.ltp, tick.volume || 0);
    };
    adapter.on('tick', this.optionFeedListener);
    void adapter.subscribeMarketData(['IDX_I:13', `NSE_FNO:${locked.ceSecurityId}`, `NSE_FNO:${locked.peSecurityId}`]);
  }

  public async getDailyReport(): Promise<any> {
    const summary = this.stateMachine.getSummary();
    return {
      strategyId: STRATEGY_ID,
      strategyName: 'NIFTY ATM CE/PE Independent Breakout',
      date: summary.sessionDate,
      ceReference: summary.ce.referenceClose,
      ceUpper: summary.ce.upperLevel,
      ceLower: summary.ce.lowerLevel,
      peReference: summary.pe.referenceClose,
      peUpper: summary.pe.upperLevel,
      peLower: summary.pe.lowerLevel,
      ceTrades: summary.ce.entryCount,
      peTrades: summary.pe.entryCount,
      totalTrades: summary.combined.totalTrades,
      grossPnl: this.sessionPnl,
      netPnl: null,
      status: this.isRunning ? 'RUNNING' : 'COMPLETED'
    };
  }

  public getStatus() {
    const summary = this.stateMachine.getSummary();
    const ceLevels = this.stateMachine.getCeLevels();
    const peLevels = this.stateMachine.getPeLevels();

    if (summary.ce) {
      summary.ce.currentLtp = this.ceLtp || summary.ce.currentLtp;
    }
    if (summary.pe) {
      summary.pe.currentLtp = this.peLtp || summary.pe.currentLtp;
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    const currentIstMinutes = istTime.getHours() * 60 + istTime.getMinutes();
    const targetSquareOffMinutes = 15 * 60 + 10; // 15:10 IST

    let timeRemaining = 'Session Closed';
    if (currentIstMinutes < 9 * 60 + 20) {
      const diff = (9 * 60 + 20) - currentIstMinutes;
      timeRemaining = `Starts in ${Math.floor(diff / 60)}h ${diff % 60}m`;
    } else if (currentIstMinutes < targetSquareOffMinutes) {
      const diff = targetSquareOffMinutes - currentIstMinutes;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      timeRemaining = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
    }

    const lastExec = this.eventsLog.find(e => e.type.includes('ORDER') || e.type.includes('FILL') || e.type.includes('SIGNAL'));

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isHalted: this.isHalted,
      mode: this.mode,
      niftyLtp: this.niftyLtp,
      ceLtp: this.ceLtp,
      peLtp: this.peLtp,
      sessionPnl: Number(this.sessionPnl.toFixed(2)),
      events: this.eventsLog.slice(0, 50),
      lastUpdated: new Date().toISOString(),

      // Independent Breakout Specification Data
      strategyName: 'NIFTY ATM CE/PE Independent Breakout',
      status: summary.status,
      sessionDate: summary.sessionDate,
      tradingWindow: '09:20–15:10',
      lockedAtm: summary.lockedAtm,
      ce: summary.ce,
      pe: summary.pe,
      combined: {
        ...summary.combined,
        totalPnl: Number((this.sessionPnl + summary.combined.totalUnrealizedPnl).toFixed(2)),
        timeRemaining,
        lastExecutionTime: lastExec?.timestamp || summary.sessionDate
      },

      // Backwards-compatible fields for UI/charts
      firstCandleClose: this.niftyLtp,
      upperLevel: ceLevels.upperLevel,
      lowerLevel: peLevels.lowerLevel,
      spotUpperLevel: this.niftyLtp > 0 ? Number((this.niftyLtp * (1 + getStrategyConfig().breakoutPct)).toFixed(2)) : null,
      spotLowerLevel: this.niftyLtp > 0 ? Number((this.niftyLtp * (1 - getStrategyConfig().breakoutPct)).toFixed(2)) : null,
      state: summary.status,
      activePosition: summary.ce.position || summary.pe.position || null
    };
  }

  private updateStatusAndEmit(): void {
    const status = this.getStatus();
    this.emit('status', status);
  }

  private logEvent(type: string, data?: any): void {
    const event: StrategyEvent = {
      timestamp: new Date().toISOString(),
      type,
      data
    };
    this.eventsLog.unshift(event);
    if (this.eventsLog.length > 200) {
      this.eventsLog.pop();
    }
    this.emit('event', event);
  }

  private saveSession(): void {
    try {
      const dataDir = path.dirname(SESSION_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(SESSION_FILE, JSON.stringify(this.getStatus(), null, 2), 'utf-8');
    } catch (e: any) {
      logger.error('[Nifty009Engine] Failed to save session:', e.message);
    }
  }
}

export const nifty009Engine = Nifty009Engine.getInstance();
