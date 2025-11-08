import { EventEmitter } from 'events';
import { tradingEngine, Position } from './tradingEngine';
import { orderManagement } from './orderManagement';

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercentage: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dayChange: number;
  dayChangePercentage: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalPnl: number;
  totalPnlPercentage: number;
  dayPnl: number;
  dayPnlPercentage: number;
  totalInvested: number;
  availableCash: number;
  marginUsed: number;
  marginAvailable: number;
  positionsCount: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  value: number;
  timestamp: Date;
  brokerId: string;
  strategyId?: string;
  pnl?: number;
}

export class PortfolioService extends EventEmitter {
  private positions: Map<string, PortfolioPosition> = new Map();
  private trades: Trade[] = [];
  private portfolioSummary: PortfolioSummary = this.initializePortfolioSummary();
  private brokerBalances: Map<string, any> = new Map();
  private dayStartPositions: Map<string, PortfolioPosition> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
    this.startDayTracking();
  }

  private setupEventHandlers() {
    // Listen to trading engine events
    tradingEngine.on('orderFilled', (order) => {
      this.handleOrderFilled(order);
    });

    tradingEngine.on('positionUpdated', (position) => {
      this.updatePosition(position);
    });

    tradingEngine.on('marketTick', (tick) => {
      this.updatePositionPrice(tick.symbol, tick.price);
    });

    // Listen to order management events
    orderManagement.on('orderFilled', (order) => {
      this.recordTrade(order);
    });
  }

  // Handle filled order
  private handleOrderFilled(order: any) {
    const existingPosition = this.positions.get(order.symbol);
    
    if (existingPosition) {
      this.updateExistingPosition(existingPosition, order);
    } else if (order.side === 'BUY') {
      this.createNewPosition(order);
    }

    this.updatePortfolioSummary();
    this.emit('positionUpdated', this.positions.get(order.symbol));
    this.emit('portfolioUpdated', this.getPortfolioSummary());
  }

  // Update existing position
  private updateExistingPosition(position: PortfolioPosition, order: any) {
    const orderQuantity = order.side === 'BUY' ? order.fillQuantity : -order.fillQuantity;
    const newQuantity = position.quantity + orderQuantity;

    if (newQuantity === 0) {
      // Position closed - calculate realized P&L
      const realizedPnl = order.side === 'SELL' 
        ? (order.fillPrice - position.averagePrice) * order.fillQuantity
        : 0;
      
      position.realizedPnl += realizedPnl;
      this.positions.delete(order.symbol);
    } else {
      // Update position
      const totalValue = (position.averagePrice * position.quantity) + 
                        (order.fillPrice * orderQuantity);
      
      position.quantity = newQuantity;
      position.averagePrice = Math.abs(totalValue / newQuantity);
      
      this.calculatePositionMetrics(position);
      this.positions.set(order.symbol, position);
    }
  }

  // Create new position
  private createNewPosition(order: any) {
    const position: PortfolioPosition = {
      symbol: order.symbol,
      quantity: order.fillQuantity,
      averagePrice: order.fillPrice,
      currentPrice: order.fillPrice,
      marketValue: order.fillPrice * order.fillQuantity,
      pnl: 0,
      pnlPercentage: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      dayChange: 0,
      dayChangePercentage: 0
    };

    this.calculatePositionMetrics(position);
    this.positions.set(order.symbol, position);
  }

  // Update position with new market price
  private updatePositionPrice(symbol: string, price: number) {
    const position = this.positions.get(symbol);
    if (!position) return;

    const oldPrice = position.currentPrice;
    position.currentPrice = price;
    
    this.calculatePositionMetrics(position);
    this.positions.set(symbol, position);

    // Emit update if price changed significantly
    if (Math.abs(price - oldPrice) / oldPrice > 0.001) { // 0.1% change
      this.emit('positionPriceUpdated', position);
    }
  }

  // Calculate position metrics
  private calculatePositionMetrics(position: PortfolioPosition) {
    position.marketValue = position.currentPrice * position.quantity;
    position.unrealizedPnl = (position.currentPrice - position.averagePrice) * position.quantity;
    position.pnl = position.unrealizedPnl + position.realizedPnl;
    position.pnlPercentage = (position.pnl / (position.averagePrice * Math.abs(position.quantity))) * 100;

    // Calculate day change
    const dayStartPosition = this.dayStartPositions.get(position.symbol);
    if (dayStartPosition) {
      position.dayChange = position.currentPrice - dayStartPosition.currentPrice;
      position.dayChangePercentage = (position.dayChange / dayStartPosition.currentPrice) * 100;
    }
  }

  // Record trade
  private recordTrade(order: any) {
    const trade: Trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: order.symbol,
      side: order.side,
      quantity: order.fillQuantity,
      price: order.fillPrice,
      value: order.fillPrice * order.fillQuantity,
      timestamp: new Date(),
      brokerId: order.brokerId,
      strategyId: order.strategyId
    };

    this.trades.push(trade);
    this.emit('tradeRecorded', trade);
  }

  // Update portfolio summary
  private updatePortfolioSummary() {
    const positions = Array.from(this.positions.values());
    
    this.portfolioSummary.totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    this.portfolioSummary.totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    this.portfolioSummary.totalInvested = positions.reduce((sum, pos) => sum + (pos.averagePrice * Math.abs(pos.quantity)), 0);
    this.portfolioSummary.dayPnl = positions.reduce((sum, pos) => sum + (pos.dayChange * pos.quantity), 0);
    this.portfolioSummary.positionsCount = positions.length;

    if (this.portfolioSummary.totalInvested > 0) {
      this.portfolioSummary.totalPnlPercentage = (this.portfolioSummary.totalPnl / this.portfolioSummary.totalInvested) * 100;
      this.portfolioSummary.dayPnlPercentage = (this.portfolioSummary.dayPnl / this.portfolioSummary.totalInvested) * 100;
    }
  }

  // Get all positions
  getPositions(): PortfolioPosition[] {
    return Array.from(this.positions.values());
  }

  // Get position by symbol
  getPosition(symbol: string): PortfolioPosition | undefined {
    return this.positions.get(symbol);
  }

  // Get portfolio summary
  getPortfolioSummary(): PortfolioSummary {
    this.updatePortfolioSummary();
    return { ...this.portfolioSummary };
  }

  // Get trades
  getTrades(limit?: number): Trade[] {
    const trades = [...this.trades].reverse();
    return limit ? trades.slice(0, limit) : trades;
  }

  // Get trades by symbol
  getTradesBySymbol(symbol: string): Trade[] {
    return this.trades.filter(trade => trade.symbol === symbol);
  }

  // Get trades by strategy
  getTradesByStrategy(strategyId: string): Trade[] {
    return this.trades.filter(trade => trade.strategyId === strategyId);
  }

  // Get P&L by strategy
  getPnLByStrategy(strategyId: string): number {
    const strategyTrades = this.getTradesByStrategy(strategyId);
    let pnl = 0;

    // Group trades by symbol to calculate P&L
    const symbolTrades = new Map<string, Trade[]>();
    strategyTrades.forEach(trade => {
      if (!symbolTrades.has(trade.symbol)) {
        symbolTrades.set(trade.symbol, []);
      }
      symbolTrades.get(trade.symbol)!.push(trade);
    });

    // Calculate P&L for each symbol
    symbolTrades.forEach((trades, symbol) => {
      let position = 0;
      let totalCost = 0;

      trades.forEach(trade => {
        if (trade.side === 'BUY') {
          position += trade.quantity;
          totalCost += trade.value;
        } else {
          const sellValue = trade.value;
          const avgCost = position > 0 ? totalCost / position : 0;
          const sellCost = avgCost * trade.quantity;
          pnl += sellValue - sellCost;
          
          position -= trade.quantity;
          totalCost -= sellCost;
        }
      });

      // Add unrealized P&L for remaining position
      if (position > 0) {
        const currentPosition = this.getPosition(symbol);
        if (currentPosition) {
          pnl += currentPosition.unrealizedPnl;
        }
      }
    });

    return pnl;
  }

  // Get performance metrics
  getPerformanceMetrics(): any {
    const trades = this.getTrades();
    const winningTrades = trades.filter(trade => (trade.pnl || 0) > 0);
    const losingTrades = trades.filter(trade => (trade.pnl || 0) < 0);

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      avgWin: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length : 0,
      profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
      sharpeRatio: this.calculateSharpeRatio(),
      maxDrawdown: this.calculateMaxDrawdown()
    };
  }

  // Calculate profit factor
  private calculateProfitFactor(winningTrades: Trade[], losingTrades: Trade[]): number {
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    return totalLosses > 0 ? totalWins / totalLosses : 0;
  }

  // Calculate Sharpe ratio (simplified)
  private calculateSharpeRatio(): number {
    const trades = this.getTrades();
    if (trades.length < 2) return 0;

    const returns = trades.map(t => (t.pnl || 0) / t.value);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  // Calculate maximum drawdown
  private calculateMaxDrawdown(): number {
    const trades = this.getTrades();
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    trades.forEach(trade => {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  // Initialize portfolio summary
  private initializePortfolioSummary(): PortfolioSummary {
    return {
      totalValue: 0,
      totalPnl: 0,
      totalPnlPercentage: 0,
      dayPnl: 0,
      dayPnlPercentage: 0,
      totalInvested: 0,
      availableCash: 100000, // Default cash
      marginUsed: 0,
      marginAvailable: 100000,
      positionsCount: 0
    };
  }

  // Start day tracking
  private startDayTracking() {
    // Save positions at start of day
    const now = new Date();
    const marketOpen = new Date(now);
    marketOpen.setHours(9, 15, 0, 0); // 9:15 AM market open

    if (now >= marketOpen) {
      this.dayStartPositions = new Map(this.positions);
    }

    // Reset day tracking at market open
    const msUntilMarketOpen = marketOpen.getTime() - now.getTime();
    if (msUntilMarketOpen > 0) {
      setTimeout(() => {
        this.dayStartPositions = new Map(this.positions);
        this.emit('dayTrackingReset');
      }, msUntilMarketOpen);
    }
  }

  // Update position from trading engine
  private updatePosition(position: Position) {
    const portfolioPosition = this.positions.get(position.symbol);
    if (portfolioPosition) {
      portfolioPosition.currentPrice = position.currentPrice;
      portfolioPosition.unrealizedPnl = position.unrealizedPnl;
      this.calculatePositionMetrics(portfolioPosition);
      this.positions.set(position.symbol, portfolioPosition);
      this.emit('positionUpdated', portfolioPosition);
    }
  }

  // Set broker balance
  setBrokerBalance(brokerId: string, balance: any) {
    this.brokerBalances.set(brokerId, balance);
    this.updateCashAndMargin();
  }

  // Update cash and margin
  private updateCashAndMargin() {
    let totalCash = 0;
    let totalMarginUsed = 0;
    let totalMarginAvailable = 0;

    for (const balance of this.brokerBalances.values()) {
      totalCash += balance.availableCash || 0;
      totalMarginUsed += balance.marginUsed || 0;
      totalMarginAvailable += balance.marginAvailable || 0;
    }

    this.portfolioSummary.availableCash = totalCash;
    this.portfolioSummary.marginUsed = totalMarginUsed;
    this.portfolioSummary.marginAvailable = totalMarginAvailable;
  }
}

// Singleton instance
export const portfolioService = new PortfolioService();