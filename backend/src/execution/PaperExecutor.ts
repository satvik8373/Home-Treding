import { ExecutionProvider } from './ExecutionProvider';
import { ExecutionMode, VirtualPortfolio, PaperTradeRecord } from './types';
import { OrderRequest, OrderResult, BrokerPosition, BrokerOrder, MarketTick, OrderStatus } from '../brokers/types';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface PaperAuditLog {
  id: string;
  timestamp: Date;
  eventType: 'MARKET_TICK' | 'CANDLE_FORMED' | 'STRATEGY_SIGNAL' | 'RISK_DECISION' | 'ORDER_PLACED' | 'ORDER_FILLED' | 'ORDER_REJECTED' | 'POSITION_EXIT' | 'KILL_SWITCH';
  symbol: string;
  details: any;
}

export interface PaperDailyReport {
  date: string;
  initialVirtualCapital: number;
  finalVirtualCapital: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossPnl: number;
  totalBrokerage: number;
  totalSlippageCost: number;
  netPnl: number;
  maxDrawdown: number;
  trades: PaperTradeRecord[];
  openPositions: BrokerPosition[];
}

export class PaperExecutor extends ExecutionProvider {
  public readonly mode: ExecutionMode = 'paper';

  private initialCapital: number = 100000;
  private availableCash: number = 100000;
  private realizedPnl: number = 0;
  private totalBrokerage: number = 0;
  private totalSlippageCost: number = 0;
  private winCount: number = 0;
  private lossCount: number = 0;
  private peakCapital: number = 100000;
  private maxDrawdown: number = 0;
  
  private orders: Map<string, BrokerOrder> = new Map();
  private positions: Map<string, BrokerPosition> = new Map();
  private trades: PaperTradeRecord[] = [];
  private auditLogs: PaperAuditLog[] = [];
  private lastKnownPrices: Map<string, number> = new Map();
  private stateFilePath: string;

  constructor(initialCapital: number = 100000) {
    super();
    this.initialCapital = initialCapital;
    this.availableCash = initialCapital;
    this.peakCapital = initialCapital;

    this.stateFilePath = path.join(__dirname, '../../data/paper-trading-state.json');

    // Seed realistic live Indian equity & index baseline prices
    this.lastKnownPrices.set('NIFTY 50', 24100.70);
    this.lastKnownPrices.set('BANKNIFTY', 57336.05);
    this.lastKnownPrices.set('FINNIFTY', 26204.00);
    this.lastKnownPrices.set('RELIANCE', 1283.60);
    this.lastKnownPrices.set('TCS', 2339.10);
    this.lastKnownPrices.set('INFY', 1137.20);
    this.lastKnownPrices.set('HDFCBANK', 714.60);
    this.lastKnownPrices.set('ICICIBANK', 1419.90);
    this.lastKnownPrices.set('SBIN', 1046.70);
    this.lastKnownPrices.set('BHARTIARTL', 1877.80);

    // Auto-restore persisted state from disk
    this.loadState();
  }

  private saveState(): void {
    try {
      const dataDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const state = {
        initialCapital: this.initialCapital,
        availableCash: this.availableCash,
        realizedPnl: this.realizedPnl,
        totalBrokerage: this.totalBrokerage,
        totalSlippageCost: this.totalSlippageCost,
        winCount: this.winCount,
        lossCount: this.lossCount,
        peakCapital: this.peakCapital,
        maxDrawdown: this.maxDrawdown,
        orders: Array.from(this.orders.entries()),
        positions: Array.from(this.positions.entries()),
        trades: this.trades,
        auditLogs: this.auditLogs.slice(-100) // Keep last 100 logs
      };

      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      logger.error('Failed to save paper trading state', e);
    }
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
        const state = JSON.parse(raw);

        this.initialCapital = state.initialCapital ?? 100000;
        this.availableCash = state.availableCash ?? 100000;
        this.realizedPnl = state.realizedPnl ?? 0;
        this.totalBrokerage = state.totalBrokerage ?? 0;
        this.totalSlippageCost = state.totalSlippageCost ?? 0;
        this.winCount = state.winCount ?? 0;
        this.lossCount = state.lossCount ?? 0;
        this.peakCapital = state.peakCapital ?? 100000;
        this.maxDrawdown = state.maxDrawdown ?? 0;

        if (Array.isArray(state.orders)) {
          this.orders = new Map(state.orders.map(([k, v]: [string, any]) => [
            k,
            { ...v, orderTimestamp: new Date(v.orderTimestamp), executionTimestamp: v.executionTimestamp ? new Date(v.executionTimestamp) : undefined }
          ]));
        }

        if (Array.isArray(state.positions)) {
          this.positions = new Map(state.positions);
        }

        if (Array.isArray(state.trades)) {
          this.trades = state.trades.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }));
        }

        if (Array.isArray(state.auditLogs)) {
          this.auditLogs = state.auditLogs.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
        }

        logger.info(`📂 [PaperExecutor] Restored ${this.orders.size} orders and ${this.positions.size} positions from disk`);
      }
    } catch (e) {
      logger.error('Failed to load paper trading state', e);
    }
  }

  public async executeOrder(orderRequest: OrderRequest): Promise<OrderResult> {
    const orderId = orderRequest.id || `paper_ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const ltp = this.lastKnownPrices.get(orderRequest.symbol) || orderRequest.price || 100;
    
    // Realistic slippage: Market orders experience 0.05% slippage
    const slippageMultiplier = orderRequest.side === 'BUY' ? 1.0005 : 0.9995;
    const executionPrice = orderRequest.orderType === 'MARKET' 
      ? Number((ltp * slippageMultiplier).toFixed(2)) 
      : (orderRequest.price || ltp);

    const slippagePerShare = Math.abs(executionPrice - ltp);
    const orderSlippageCost = slippagePerShare * orderRequest.quantity;

    // Realistic Brokerage: Flat ₹20 per executed order + 0.0125% STT / exchange fees
    const turnover = executionPrice * orderRequest.quantity;
    const brokerageFee = 20 + Number((turnover * 0.000125).toFixed(2));

    // Calculate required margin
    const orderCost = executionPrice * orderRequest.quantity + brokerageFee;
    if (orderRequest.side === 'BUY' && orderCost > this.availableCash) {
      const rejectedOrder: BrokerOrder = {
        orderId,
        brokerOrderId: `virt_${orderId}`,
        symbol: orderRequest.symbol,
        exchange: orderRequest.exchange || 'NSE',
        side: orderRequest.side,
        orderType: orderRequest.orderType,
        productType: orderRequest.productType,
        validity: orderRequest.validity || 'DAY',
        quantity: orderRequest.quantity,
        filledQuantity: 0,
        pendingQuantity: orderRequest.quantity,
        price: executionPrice,
        averagePrice: 0,
        status: 'REJECTED',
        statusMessage: `Insufficient virtual cash. Required: ₹${orderCost.toFixed(2)}, Available: ₹${this.availableCash.toFixed(2)}`,
        orderTimestamp: new Date(),
        strategyId: orderRequest.strategyId
      };

      this.orders.set(orderId, rejectedOrder);
      this.recordAudit('ORDER_REJECTED', orderRequest.symbol, { reason: rejectedOrder.statusMessage, order: rejectedOrder });
      this.emit('orderRejected', rejectedOrder);
      this.saveState();

      return {
        success: false,
        orderId,
        brokerOrderId: `virt_${orderId}`,
        status: 'REJECTED',
        rejectionReason: rejectedOrder.statusMessage,
        timestamp: new Date()
      };
    }

    // Process simulated fill
    const filledOrder: BrokerOrder = {
      orderId,
      brokerOrderId: `virt_${orderId}`,
      symbol: orderRequest.symbol,
      exchange: orderRequest.exchange || 'NSE',
      side: orderRequest.side,
      orderType: orderRequest.orderType,
      productType: orderRequest.productType,
      validity: orderRequest.validity || 'DAY',
      quantity: orderRequest.quantity,
      filledQuantity: orderRequest.quantity,
      pendingQuantity: 0,
      price: executionPrice,
      averagePrice: executionPrice,
      status: 'FILLED',
      orderTimestamp: new Date(),
      executionTimestamp: new Date(),
      strategyId: orderRequest.strategyId
    };

    this.orders.set(orderId, filledOrder);
    this.totalBrokerage += brokerageFee;
    this.totalSlippageCost += orderSlippageCost;
    this.availableCash -= brokerageFee; // Deduct brokerage fee from cash

    this.updatePositionOnFill(filledOrder);

    // Record trade
    const trade: PaperTradeRecord = {
      tradeId: `trade_${Date.now()}`,
      orderId,
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      quantity: orderRequest.quantity,
      price: executionPrice,
      timestamp: new Date(),
      strategyId: orderRequest.strategyId
    };
    this.trades.push(trade);

    this.recordAudit('ORDER_FILLED', orderRequest.symbol, {
      side: orderRequest.side,
      qty: orderRequest.quantity,
      price: executionPrice,
      brokerage: brokerageFee,
      slippageCost: orderSlippageCost
    });

    this.saveState();

    logger.info(`📝 [Paper Order Filled] ${filledOrder.side} ${filledOrder.quantity} ${filledOrder.symbol} @ ₹${executionPrice} (Brokerage: ₹${brokerageFee})`);
    this.emit('orderFilled', filledOrder);

    return {
      success: true,
      orderId,
      brokerOrderId: filledOrder.brokerOrderId,
      status: 'FILLED',
      filledQuantity: filledOrder.quantity,
      averagePrice: executionPrice,
      timestamp: new Date()
    };
  }

  public async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status === 'OPEN' || order.status === 'PENDING') {
      order.status = 'CANCELLED';
      this.orders.set(orderId, order);
      this.recordAudit('ORDER_PLACED', order.symbol, { action: 'CANCELLED', orderId });
      this.emit('orderCancelled', order);
      this.saveState();
      return true;
    }
    return false;
  }

  public async getOrders(filter?: { status?: string; strategyId?: string }): Promise<BrokerOrder[]> {
    let list = Array.from(this.orders.values());
    if (filter?.status) {
      list = list.filter(o => o.status === filter.status);
    }
    if (filter?.strategyId) {
      list = list.filter(o => o.strategyId === filter.strategyId);
    }
    return list.sort((a, b) => b.orderTimestamp.getTime() - a.orderTimestamp.getTime());
  }

  public async getPositions(): Promise<BrokerPosition[]> {
    return Array.from(this.positions.values());
  }

  public async getPortfolio(): Promise<VirtualPortfolio> {
    let unrealizedPnl = 0;
    let utilizedMargin = 0;

    for (const pos of this.positions.values()) {
      unrealizedPnl += pos.unrealizedPnl;
      utilizedMargin += Math.abs(pos.quantity) * pos.netAvgPrice;
    }

    const totalPortfolioValue = this.availableCash + utilizedMargin + unrealizedPnl;
    const grossPnl = this.realizedPnl + unrealizedPnl;
    const netPnl = grossPnl - this.totalBrokerage;
    const totalTrades = this.winCount + this.lossCount;
    const winRate = totalTrades > 0 ? (this.winCount / totalTrades) * 100 : 0;

    // Track peak capital and drawdown
    this.peakCapital = Math.max(this.peakCapital, totalPortfolioValue);
    const currentDrawdown = this.peakCapital - totalPortfolioValue;
    this.maxDrawdown = Math.max(this.maxDrawdown, currentDrawdown);

    return {
      initialCapital: this.initialCapital,
      availableCash: this.availableCash,
      utilizedMargin,
      totalPortfolioValue,
      realizedPnl: this.realizedPnl,
      unrealizedPnl,
      totalPnl: netPnl,
      dayPnl: netPnl,
      winCount: this.winCount,
      lossCount: this.lossCount,
      totalTrades,
      winRate
    };
  }

  public async getDailyReport(): Promise<PaperDailyReport> {
    const portfolio = await this.getPortfolio();
    return {
      date: new Date().toISOString().split('T')[0],
      initialVirtualCapital: this.initialCapital,
      finalVirtualCapital: portfolio.totalPortfolioValue,
      totalTrades: portfolio.totalTrades,
      winningTrades: this.winCount,
      losingTrades: this.lossCount,
      winRate: portfolio.winRate,
      grossPnl: this.realizedPnl,
      totalBrokerage: Number(this.totalBrokerage.toFixed(2)),
      totalSlippageCost: Number(this.totalSlippageCost.toFixed(2)),
      netPnl: Number((this.realizedPnl - this.totalBrokerage).toFixed(2)),
      maxDrawdown: Number(this.maxDrawdown.toFixed(2)),
      trades: this.trades,
      openPositions: Array.from(this.positions.values())
    };
  }

  public getAuditLogs(): PaperAuditLog[] {
    return this.auditLogs;
  }

  public recordAudit(eventType: PaperAuditLog['eventType'], symbol: string, details: any): void {
    this.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      eventType,
      symbol,
      details
    });
  }

  public onMarketTick(tick: MarketTick): void {
    if (!tick || !tick.symbol) return;
    this.updatePrice(tick.symbol, tick.ltp);
  }

  /**
   * Update last known price for a symbol (used by strategy engines)
   */
  public updatePrice(symbol: string, ltp: number): void {
    if (!symbol || ltp <= 0) return;
    this.lastKnownPrices.set(symbol, ltp);

    // Update position unrealized P&L
    const position = this.positions.get(symbol);
    if (position && position.quantity !== 0) {
      position.ltp = ltp;
      position.unrealizedPnl = (ltp - position.netAvgPrice) * position.quantity;
      position.totalPnl = position.realizedPnl + position.unrealizedPnl;
      this.positions.set(symbol, position);
      this.emit('positionUpdated', position);
    }
  }

  /**
   * Get last known price for a symbol
   */
  public getLastKnownPrice(symbol: string): number {
    return this.lastKnownPrices.get(symbol) || 0;
  }

  private updatePositionOnFill(order: BrokerOrder): void {
    let position = this.positions.get(order.symbol);

    if (!position) {
      position = {
        positionId: `paper_pos_${order.symbol}`,
        symbol: order.symbol,
        exchange: 'NSE',
        segment: 'EQ',
        productType: order.productType,
        quantity: 0,
        buyQuantity: 0,
        sellQuantity: 0,
        buyAvgPrice: 0,
        sellAvgPrice: 0,
        netAvgPrice: 0,
        ltp: order.averagePrice,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0
      };
    }

    if (order.side === 'BUY') {
      const prevCost = position.quantity > 0 ? position.quantity * position.netAvgPrice : 0;
      const addedCost = order.quantity * order.averagePrice;
      const newQty = position.quantity + order.quantity;

      if (position.quantity < 0) {
        // Covering short position
        const coverQty = Math.min(Math.abs(position.quantity), order.quantity);
        const pnlOnCover = (position.netAvgPrice - order.averagePrice) * coverQty;
        this.realizedPnl += pnlOnCover;
        position.realizedPnl += pnlOnCover;
        
        if (pnlOnCover > 0) this.winCount++;
        else if (pnlOnCover < 0) this.lossCount++;
      }

      position.buyQuantity += order.quantity;
      position.quantity = newQty;
      position.netAvgPrice = newQty > 0 ? (prevCost + addedCost) / newQty : order.averagePrice;
      this.availableCash -= order.quantity * order.averagePrice;

    } else if (order.side === 'SELL') {
      const prevCost = position.quantity < 0 ? Math.abs(position.quantity) * position.netAvgPrice : 0;
      const addedCost = order.quantity * order.averagePrice;
      const newQty = position.quantity - order.quantity;

      if (position.quantity > 0) {
        // Closing long position
        const closeQty = Math.min(position.quantity, order.quantity);
        const pnlOnClose = (order.averagePrice - position.netAvgPrice) * closeQty;
        this.realizedPnl += pnlOnClose;
        position.realizedPnl += pnlOnClose;

        if (pnlOnClose > 0) this.winCount++;
        else if (pnlOnClose < 0) this.lossCount++;
      }

      position.sellQuantity += order.quantity;
      position.quantity = newQty;
      position.netAvgPrice = newQty < 0 ? (prevCost + addedCost) / Math.abs(newQty) : order.averagePrice;
      this.availableCash += order.quantity * order.averagePrice;
    }

    if (position.quantity === 0) {
      position.unrealizedPnl = 0;
      position.totalPnl = position.realizedPnl;
    } else {
      position.unrealizedPnl = (position.ltp - position.netAvgPrice) * position.quantity;
      position.totalPnl = position.realizedPnl + position.unrealizedPnl;
    }

    this.positions.set(order.symbol, position);
    this.saveState();
    this.emit('positionUpdated', position);
    this.emit('portfolioUpdated', this.getPortfolio());
  }

  public resetPortfolio(capital: number = 100000): void {
    this.initialCapital = capital;
    this.availableCash = capital;
    this.realizedPnl = 0;
    this.totalBrokerage = 0;
    this.totalSlippageCost = 0;
    this.winCount = 0;
    this.lossCount = 0;
    this.peakCapital = capital;
    this.maxDrawdown = 0;
    this.orders.clear();
    this.positions.clear();
    this.trades = [];
    this.auditLogs = [];
    this.saveState();
    logger.info(`🔄 [PaperExecutor] Reset portfolio with ₹${capital}`);
  }
}

export const paperExecutor = new PaperExecutor(100000);
