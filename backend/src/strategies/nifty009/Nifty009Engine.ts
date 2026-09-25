import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { CandleEngine, Candle } from './CandleEngine';
import { AtmResolver, LockedAtm } from './AtmResolver';
import { StrategyStateMachine, StrategyConfig, StrategySignal, LegPosition, DEFAULT_CONFIG } from './StrategyStateMachine';
import { getStrategyConfig } from '../../config/strategyConfig';
import { BrokerRegistry } from '../../brokers/BrokerRegistry';
import { paperTradingManager } from '../../execution/PaperTradingManager';
import { OrderRequest } from '../../brokers/types';
import { calculateOptionPricing } from '../../utils/blackScholes';
import { MarketStreamer } from '../../services/marketStreamer';
import fs from 'fs';
import path from 'path';

const STRATEGY_ID = 'nifty-009-atm-breakout';
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

  private niftyLtp: number = 26180.00;
  private ceLtp: number = 168.50;
  private peLtp: number = 168.50;

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
      if (ceLevels.referenceClose === null) {
        this.stateMachine.setCeReferenceCandle(candle);
      }

      // Process CE completed candle in state machine
      const signal = this.stateMachine.onCeCandleClosed(candle);
      if (signal) {
        await this.handleCeSignal(signal);
      }

      this.updateStatusAndEmit();
    });

    // 2. PE 5-Minute Candle Closed Listener
    this.peCandleEngine.on('candle:closed', async (candle: Candle) => {
      this.emit('candle:pe', candle);
      this.logEvent('PE_CANDLE_CLOSED', { time: candle.startTime, close: candle.close });

      // Check if PE reference candle is needed
      const peLevels = this.stateMachine.getPeLevels();
      if (peLevels.referenceClose === null) {
        this.stateMachine.setPeReferenceCandle(candle);
      }

      // Process PE completed candle in state machine
      const signal = this.stateMachine.onPeCandleClosed(candle);
      if (signal) {
        await this.handlePeSignal(signal);
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

    this.isRunning = true;
    this.isPaused = false;
    this.isHalted = false;
    this.mode = mode;
    this.userId = userId;

    this.ceCandleEngine.reset();
    this.peCandleEngine.reset();
    this.spotCandleEngine.reset();
    this.atmResolver.reset();
    this.stateMachine.setConfig(config);
    this.stateMachine.start();
    this.eventsLog = [];
    this.sessionPnl = 0;

    this.logEvent('STRATEGY_STARTED', { mode: this.mode.toUpperCase(), config: this.stateMachine.getConfig() });
    logger.info(`[Nifty009Engine] 🚀 NIFTY ATM CE/PE Independent Breakout Started (${this.mode.toUpperCase()} MODE)`);

    // 1. Identify current NIFTY 50 spot & lock ATM CE + ATM PE contracts
    const streamerPrice = MarketStreamer.getInstance()?.getPrice('NIFTY 50');
    const baseSpot = streamerPrice || this.niftyLtp || 0;
    
    if (baseSpot > 0) {
      this.niftyLtp = baseSpot;
    }

    const lockedAtm = await this.atmResolver.resolveAndLockAtm(
      baseSpot > 0 ? baseSpot : 24100, // Safe default strike center if completely offline
      getStrategyConfig().niftyLotSize,
      this.userId
    );
    this.stateMachine.onAtmResolved(lockedAtm);

    if (lockedAtm.ceLtp > 0) {
      this.ceLtp = lockedAtm.ceLtp;
    }
    if (lockedAtm.peLtp > 0) {
      this.peLtp = lockedAtm.peLtp;
    }

    // 2. Lock 09:15-09:20 Reference Candles if session is already active
    if (this.ceLtp > 0) {
      const refCeCandle: Candle = {
        startTime: '09:15',
        endTime: '09:20',
        open: this.ceLtp,
        high: this.ceLtp,
        low: this.ceLtp,
        close: this.ceLtp,
        volume: 0,
        isClosed: true
      };
      this.stateMachine.setCeReferenceCandle(refCeCandle);
    }

    if (this.peLtp > 0) {
      const refPeCandle: Candle = {
        startTime: '09:15',
        endTime: '09:20',
        open: this.peLtp,
        high: this.peLtp,
        low: this.peLtp,
        close: this.peLtp,
        volume: 0,
        isClosed: true
      };
      this.stateMachine.setPeReferenceCandle(refPeCandle);
    }

    // 3. Schedule 15:10 IST Force Square-Off
    this.scheduleSquareOffTimer();

    // 4. Subscribe to Dhan market feed if connected
    this.subscribeDhanMarketFeed();

    this.updateStatusAndEmit();
    this.saveSession();
  }

  public setMode(mode: 'paper' | 'live'): void {
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

      // Update Option Premiums dynamically based on official Black-Scholes model
      const locked = this.atmResolver.getLockedAtm();
      if (locked) {
        const pricing = calculateOptionPricing(price, locked.atmStrike);
        this.ceLtp = pricing.callPrice;
        this.peLtp = pricing.putPrice;

        this.atmResolver.updateOptionLtp('CE', this.ceLtp);
        this.atmResolver.updateOptionLtp('PE', this.peLtp);

        // Feed ticks into independent 5m candle engines
        this.ceCandleEngine.processTick(this.ceLtp, volume, new Date());
        this.peCandleEngine.processTick(this.peLtp, volume, new Date());

        // Update active positions' LTP & unrealized PnL
        this.stateMachine.updateLtp('CE', this.ceLtp);
        this.stateMachine.updateLtp('PE', this.peLtp);
      }

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

    this.updateStatusAndEmit();
  }

  /**
   * Handle CE Signals (BUY_CE / EXIT_CE)
   */
  private async handleCeSignal(signal: StrategySignal): Promise<void> {
    const lockedAtm = this.atmResolver.getLockedAtm();
    if (!lockedAtm) return;

    const qty = signal.quantity;

    if (signal.type === 'BUY_CE') {
      this.logEvent('CE_ENTRY_SIGNAL', signal);
      const fillPrice = this.ceLtp;
      const target1Pts = getStrategyConfig().target1Pts || 20.0;
      const target2Pts = getStrategyConfig().target2Pts || 40.0;

      const position: LegPosition = {
        leg: 'CE',
        symbol: lockedAtm.ceSymbol,
        securityId: lockedAtm.ceSecurityId,
        strike: lockedAtm.atmStrike,
        entryPrice: fillPrice,
        quantity: qty,
        totalQty: qty,
        remainingQty: qty,
        entryTime: new Date().toISOString(),
        currentLtp: fillPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        target1Price: Number((fillPrice + target1Pts).toFixed(2)),
        target2Price: Number((fillPrice + target2Pts).toFixed(2)),
        target1Hit: false
      };

      const orderReq: OrderRequest = {
        symbol: lockedAtm.ceSymbol,
        securityId: lockedAtm.ceSecurityId,
        exchange: 'NFO',
        side: 'BUY',
        quantity: qty,
        price: fillPrice,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };

      if (this.mode === 'live') {
        const isLiveAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';
        if (!isLiveAllowed) {
          logger.warn('[Nifty009Engine] Safety Block: Live real-money trading is disabled. Live CE order blocked.');
          this.logEvent('LIVE_ORDER_BLOCKED', { reason: 'LIVE_TRADING_ENABLED is false', leg: 'CE' });
          return;
        }

        const primary = BrokerRegistry.getInstance().getPrimaryAdapter(this.userId);
        if (primary && primary.getStatus()) {
          try {
            await primary.placeOrder(orderReq);
            this.logEvent('CE_ENTRY_ORDER', { symbol: lockedAtm.ceSymbol, qty, price: fillPrice });
          } catch (e: any) {
            logger.error('[Nifty009Engine] Live CE Order placement failed:', e);
          }
        }
      } else {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
        this.logEvent('CE_ENTRY_ORDER', { mode: 'PAPER', symbol: lockedAtm.ceSymbol, qty, price: fillPrice });
      }

      this.stateMachine.onCePositionOpened(position);
      this.emit('order', { leg: 'CE', type: 'BUY', symbol: lockedAtm.ceSymbol, quantity: qty, price: fillPrice });
    } else if (signal.type === 'TARGET_1_CE') {
      this.logEvent('CE_TARGET_1_SIGNAL', signal);
      const pos = this.stateMachine.getCePosition();
      if (!pos) return;

      const exitPrice = signal.triggerPrice || this.ceLtp;
      const exitQty = signal.quantity; // 1 lot = 65 qty
      const realized = (exitPrice - pos.entryPrice) * exitQty;
      this.sessionPnl += realized;

      const orderReq: OrderRequest = {
        symbol: pos.symbol,
        securityId: pos.securityId,
        exchange: 'NFO',
        side: 'SELL',
        quantity: exitQty,
        price: exitPrice,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };

      if (this.mode === 'live') {
        const isLiveAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';
        if (isLiveAllowed) {
          const primary = BrokerRegistry.getInstance().getPrimaryAdapter(this.userId);
          if (primary && primary.getStatus()) {
            try {
              await primary.placeOrder(orderReq);
              this.logEvent('CE_TARGET_1_ORDER', { symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
            } catch (e: any) {
              logger.error('[Nifty009Engine] Live CE Target 1 Exit failed:', e);
            }
          }
        }
      } else {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
        this.logEvent('CE_TARGET_1_ORDER', { mode: 'PAPER', symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
      }

      this.stateMachine.onCeTarget1Filled(exitPrice, exitQty);
      this.emit('order', { leg: 'CE', type: 'SELL', symbol: pos.symbol, quantity: exitQty, price: exitPrice, realizedPnl: realized, reason: 'TARGET_1 (+20 pts)' });
    } else if (signal.type === 'TARGET_2_CE' || signal.type === 'EXIT_CE') {
      this.logEvent(signal.type === 'TARGET_2_CE' ? 'CE_TARGET_2_SIGNAL' : 'CE_EXIT_SIGNAL', signal);
      const pos = this.stateMachine.getCePosition();
      if (!pos) return;

      const exitPrice = signal.triggerPrice || this.ceLtp;
      const exitQty = signal.quantity || pos.quantity;
      const realized = (exitPrice - pos.entryPrice) * exitQty;
      this.sessionPnl += realized;

      const orderReq: OrderRequest = {
        symbol: pos.symbol,
        securityId: pos.securityId,
        exchange: 'NFO',
        side: 'SELL',
        quantity: exitQty,
        price: exitPrice,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };

      if (this.mode === 'live') {
        const isLiveAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';
        if (!isLiveAllowed) {
          logger.warn('[Nifty009Engine] Safety Block: Live real-money trading is disabled. Live CE exit blocked.');
          return;
        }

        const primary = BrokerRegistry.getInstance().getPrimaryAdapter(this.userId);
        if (primary && primary.getStatus()) {
          try {
            await primary.placeOrder(orderReq);
            this.logEvent('CE_EXIT_ORDER', { symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
          } catch (e: any) {
            logger.error('[Nifty009Engine] Live CE Exit failed:', e);
          }
        }
      } else {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
        this.logEvent('CE_EXIT_ORDER', { mode: 'PAPER', symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
      }

      this.stateMachine.onCePositionClosed();
      this.emit('order', { leg: 'CE', type: 'SELL', symbol: pos.symbol, quantity: exitQty, price: exitPrice, realizedPnl: realized, reason: signal.triggerReason });
    }
  }

  /**
   * Handle PE Signals (BUY_PE / TARGET_1_PE / TARGET_2_PE / EXIT_PE)
   */
  private async handlePeSignal(signal: StrategySignal): Promise<void> {
    const lockedAtm = this.atmResolver.getLockedAtm();
    if (!lockedAtm) return;

    const qty = signal.quantity;

    if (signal.type === 'BUY_PE') {
      this.logEvent('PE_ENTRY_SIGNAL', signal);
      const fillPrice = this.peLtp;
      const target1Pts = getStrategyConfig().target1Pts || 20.0;
      const target2Pts = getStrategyConfig().target2Pts || 40.0;

      const position: LegPosition = {
        leg: 'PE',
        symbol: lockedAtm.peSymbol,
        securityId: lockedAtm.peSecurityId,
        strike: lockedAtm.atmStrike,
        entryPrice: fillPrice,
        quantity: qty,
        totalQty: qty,
        remainingQty: qty,
        entryTime: new Date().toISOString(),
        currentLtp: fillPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        target1Price: Number((fillPrice + target1Pts).toFixed(2)),
        target2Price: Number((fillPrice + target2Pts).toFixed(2)),
        target1Hit: false
      };

      const orderReq: OrderRequest = {
        symbol: lockedAtm.peSymbol,
        securityId: lockedAtm.peSecurityId,
        exchange: 'NFO',
        side: 'BUY',
        quantity: qty,
        price: fillPrice,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };

      if (this.mode === 'live') {
        const isLiveAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';
        if (!isLiveAllowed) {
          logger.warn('[Nifty009Engine] Safety Block: Live real-money trading is disabled. Live PE order blocked.');
          this.logEvent('LIVE_ORDER_BLOCKED', { reason: 'LIVE_TRADING_ENABLED is false', leg: 'PE' });
          return;
        }

        const primary = BrokerRegistry.getInstance().getPrimaryAdapter(this.userId);
        if (primary && primary.getStatus()) {
          try {
            await primary.placeOrder(orderReq);
            this.logEvent('PE_ENTRY_ORDER', { symbol: lockedAtm.peSymbol, qty, price: fillPrice });
          } catch (e: any) {
            logger.error('[Nifty009Engine] Live PE Order placement failed:', e);
          }
        }
      } else {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
        this.logEvent('PE_ENTRY_ORDER', { mode: 'PAPER', symbol: lockedAtm.peSymbol, qty, price: fillPrice });
      }

      this.stateMachine.onPePositionOpened(position);
      this.emit('order', { leg: 'PE', type: 'BUY', symbol: lockedAtm.peSymbol, quantity: qty, price: fillPrice });
    } else if (signal.type === 'TARGET_1_PE') {
      this.logEvent('PE_TARGET_1_SIGNAL', signal);
      const pos = this.stateMachine.getPePosition();
      if (!pos) return;

      const exitPrice = signal.triggerPrice || this.peLtp;
      const exitQty = signal.quantity; // 1 lot = 65 qty
      const realized = (exitPrice - pos.entryPrice) * exitQty;
      this.sessionPnl += realized;

      const orderReq: OrderRequest = {
        symbol: pos.symbol,
        securityId: pos.securityId,
        exchange: 'NFO',
        side: 'SELL',
        quantity: exitQty,
        price: exitPrice,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };

      if (this.mode === 'live') {
        const isLiveAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';
        if (isLiveAllowed) {
          const primary = BrokerRegistry.getInstance().getPrimaryAdapter(this.userId);
          if (primary && primary.getStatus()) {
            try {
              await primary.placeOrder(orderReq);
              this.logEvent('PE_TARGET_1_ORDER', { symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
            } catch (e: any) {
              logger.error('[Nifty009Engine] Live PE Target 1 Exit failed:', e);
            }
          }
        }
      } else {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
        this.logEvent('PE_TARGET_1_ORDER', { mode: 'PAPER', symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
      }

      this.stateMachine.onPeTarget1Filled(exitPrice, exitQty);
      this.emit('order', { leg: 'PE', type: 'SELL', symbol: pos.symbol, quantity: exitQty, price: exitPrice, realizedPnl: realized, reason: 'TARGET_1 (+20 pts)' });
    } else if (signal.type === 'TARGET_2_PE' || signal.type === 'EXIT_PE') {
      this.logEvent(signal.type === 'TARGET_2_PE' ? 'PE_TARGET_2_SIGNAL' : 'PE_EXIT_SIGNAL', signal);
      const pos = this.stateMachine.getPePosition();
      if (!pos) return;

      const exitPrice = signal.triggerPrice || this.peLtp;
      const exitQty = signal.quantity || pos.quantity;
      const realized = (exitPrice - pos.entryPrice) * exitQty;
      this.sessionPnl += realized;

      const orderReq: OrderRequest = {
        symbol: pos.symbol,
        securityId: pos.securityId,
        exchange: 'NFO',
        side: 'SELL',
        quantity: exitQty,
        price: exitPrice,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };

      if (this.mode === 'live') {
        const isLiveAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';
        if (!isLiveAllowed) {
          logger.warn('[Nifty009Engine] Safety Block: Live real-money trading is disabled. Live PE exit blocked.');
          return;
        }

        const primary = BrokerRegistry.getInstance().getPrimaryAdapter(this.userId);
        if (primary && primary.getStatus()) {
          try {
            await primary.placeOrder(orderReq);
            this.logEvent('PE_EXIT_ORDER', { symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
          } catch (e: any) {
            logger.error('[Nifty009Engine] Live PE Exit failed:', e);
          }
        }
      } else {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
        this.logEvent('PE_EXIT_ORDER', { mode: 'PAPER', symbol: pos.symbol, qty: exitQty, exitPrice, realizedPnl: realized });
      }

      this.stateMachine.onPePositionClosed();
      this.emit('order', { leg: 'PE', type: 'SELL', symbol: pos.symbol, quantity: exitQty, price: exitPrice, realizedPnl: realized, reason: signal.triggerReason });
    }
  }

  /**
   * 15:10 Force Square-Off
   */
  public async forceSquareOff(): Promise<void> {
    logger.info('[Nifty009Engine] 🛑 15:10 Force Square-Off Triggered');
    const { exitCe, exitPe } = this.stateMachine.onForceSquareOff();

    const cePos = this.stateMachine.getCePosition();
    const pePos = this.stateMachine.getPePosition();

    if (exitCe && cePos) {
      const pnl = (this.ceLtp - cePos.entryPrice) * cePos.quantity;
      this.sessionPnl += pnl;
      const orderReq: OrderRequest = {
        symbol: cePos.symbol,
        securityId: cePos.securityId,
        exchange: 'NFO',
        side: 'SELL',
        quantity: cePos.quantity,
        price: this.ceLtp,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };
      if (this.mode === 'paper') {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
      }
    }

    if (exitPe && pePos) {
      const pnl = (this.peLtp - pePos.entryPrice) * pePos.quantity;
      this.sessionPnl += pnl;
      const orderReq: OrderRequest = {
        symbol: pePos.symbol,
        securityId: pePos.securityId,
        exchange: 'NFO',
        side: 'SELL',
        quantity: pePos.quantity,
        price: this.peLtp,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        validity: 'DAY',
        strategyId: STRATEGY_ID,
        userId: this.userId,
        isPaper: this.mode === 'paper'
      };
      if (this.mode === 'paper') {
        await paperTradingManager.getExecutor(this.userId).executeOrder(orderReq);
      }
    }

    this.logEvent('FORCED_SQUAREOFF', { exitCe, exitPe, sessionPnl: this.sessionPnl });
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
        this.forceSquareOff();
      }, delay);
      logger.info(`[Nifty009Engine] 15:10 IST force square-off scheduled in ${Math.round(delay / 60000)} minutes`);
    } else {
      logger.info('[Nifty009Engine] Current time is past 15:10 IST for today');
    }
  }

  private subscribeDhanMarketFeed(): void {
    // Managed via primary adapter
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
      netPnl: this.sessionPnl - (summary.combined.totalTrades * 40),
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
      firstCandleClose: this.niftyLtp || 26180.00,
      upperLevel: ceLevels.upperLevel,
      lowerLevel: peLevels.lowerLevel,
      spotUpperLevel: Number(((this.niftyLtp || 26180.00) * (1 + getStrategyConfig().breakoutPct)).toFixed(2)),
      spotLowerLevel: Number(((this.niftyLtp || 26180.00) * (1 - getStrategyConfig().breakoutPct)).toFixed(2)),
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
