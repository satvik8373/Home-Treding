import { EventEmitter } from 'events';
import axios from 'axios';
import WebSocket from 'ws';

export interface Order {
  id: string;
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  status: 'PENDING' | 'PLACED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  timestamp: Date;
  fillPrice?: number;
  fillQuantity?: number;
  strategyId?: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  unrealizedPnl: number;
}

export interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
}

export class TradingEngine extends EventEmitter {
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private brokers: Map<string, any> = new Map();
  private marketData: Map<string, MarketTick> = new Map();
  private strategies: Map<string, any> = new Map();
  private isRunning: boolean = false;
  private websockets: Map<string, WebSocket> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.on('marketTick', this.handleMarketTick.bind(this));
    this.on('orderFilled', this.handleOrderFilled.bind(this));
    this.on('strategySignal', this.handleStrategySignal.bind(this));
  }

  // Start the trading engine
  async start() {
    if (this.isRunning) return;
    
    console.log('🚀 Starting Trading Engine...');
    this.isRunning = true;
    
    // Start market data feeds
    await this.startMarketDataFeeds();
    
    // Start strategy execution
    this.startStrategyExecution();
    
    this.emit('engineStarted');
    console.log('✅ Trading Engine started successfully');
  }

  // Stop the trading engine
  async stop() {
    if (!this.isRunning) return;
    
    console.log('🛑 Stopping Trading Engine...');
    this.isRunning = false;
    
    // Close all websocket connections
    for (const [symbol, ws] of this.websockets) {
      ws.close();
    }
    this.websockets.clear();
    
    this.emit('engineStopped');
    console.log('✅ Trading Engine stopped');
  }

  // Add broker to trading engine
  addBroker(brokerId: string, brokerConfig: any) {
    this.brokers.set(brokerId, brokerConfig);
    console.log(`📊 Added broker ${brokerId} to trading engine`);
  }

  // Remove broker from trading engine
  removeBroker(brokerId: string) {
    this.brokers.delete(brokerId);
    console.log(`🗑️ Removed broker ${brokerId} from trading engine`);
  }

  // Place order through broker API
  async placeOrder(orderRequest: Omit<Order, 'id' | 'timestamp' | 'status'>): Promise<Order> {
    const order: Order = {
      ...orderRequest,
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      status: 'PENDING'
    };

    try {
      const broker = this.brokers.get(orderRequest.brokerId);
      if (!broker) {
        throw new Error(`Broker ${orderRequest.brokerId} not found`);
      }

      // Apply risk checks
      const riskCheckResult = await this.performRiskChecks(order);
      if (!riskCheckResult.passed) {
        order.status = 'REJECTED';
        this.orders.set(order.id, order);
        throw new Error(`Risk check failed: ${riskCheckResult.reason}`);
      }

      // Place order with broker API
      const brokerOrderId = await this.placeBrokerOrder(broker, order);
      order.status = 'PLACED';
      
      this.orders.set(order.id, order);
      this.emit('orderPlaced', order);
      
      console.log(`📋 Order placed: ${order.symbol} ${order.side} ${order.quantity} @ ${order.price || 'MARKET'}`);
      
      return order;
    } catch (error) {
      order.status = 'REJECTED';
      this.orders.set(order.id, order);
      console.error(`❌ Order placement failed:`, error);
      throw error;
    }
  }

  // Cancel order
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'PLACED') {
      throw new Error(`Cannot cancel order in status: ${order.status}`);
    }

    try {
      const broker = this.brokers.get(order.brokerId);
      await this.cancelBrokerOrder(broker, order);
      
      order.status = 'CANCELLED';
      this.orders.set(orderId, order);
      this.emit('orderCancelled', order);
      
      console.log(`❌ Order cancelled: ${orderId}`);
      return true;
    } catch (error) {
      console.error(`❌ Order cancellation failed:`, error);
      throw error;
    }
  }

  // Get current positions
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  // Get orders
  getOrders(status?: string): Order[] {
    const orders = Array.from(this.orders.values());
    return status ? orders.filter(o => o.status === status) : orders;
  }

  // Subscribe to market data for symbol
  async subscribeToMarketData(symbol: string) {
    if (this.websockets.has(symbol)) return;

    try {
      // Create WebSocket connection for market data
      const ws = new WebSocket(`wss://api.dhan.co/v2/marketdata/${symbol}`);
      
      ws.on('open', () => {
        console.log(`📡 Connected to market data for ${symbol}`);
      });

      ws.on('message', (data) => {
        try {
          const tick = JSON.parse(data.toString());
          this.handleMarketDataMessage(symbol, tick);
        } catch (error) {
          console.error(`❌ Error parsing market data for ${symbol}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${symbol}:`, error);
      });

      ws.on('close', () => {
        console.log(`📡 Disconnected from market data for ${symbol}`);
        this.websockets.delete(symbol);
      });

      this.websockets.set(symbol, ws);
    } catch (error) {
      console.error(`❌ Failed to subscribe to market data for ${symbol}:`, error);
    }
  }

  // Handle market data message
  private handleMarketDataMessage(symbol: string, data: any) {
    const tick: MarketTick = {
      symbol,
      price: data.ltp || data.price,
      volume: data.volume || 0,
      timestamp: new Date()
    };

    this.marketData.set(symbol, tick);
    this.emit('marketTick', tick);
  }

  // Handle market tick
  private handleMarketTick(tick: MarketTick) {
    // Update positions with current market price
    const position = this.positions.get(tick.symbol);
    if (position) {
      position.currentPrice = tick.price;
      position.unrealizedPnl = (tick.price - position.averagePrice) * position.quantity;
      this.positions.set(tick.symbol, position);
      this.emit('positionUpdated', position);
    }

    // Notify strategies about price update
    this.emit('priceUpdate', tick);
  }

  // Handle order filled
  private handleOrderFilled(order: Order) {
    if (!order.fillPrice || !order.fillQuantity) return;

    // Update positions
    const existingPosition = this.positions.get(order.symbol);
    
    if (existingPosition) {
      // Update existing position
      const totalQuantity = existingPosition.quantity + (order.side === 'BUY' ? order.fillQuantity : -order.fillQuantity);
      const totalValue = (existingPosition.averagePrice * existingPosition.quantity) + 
                        (order.fillPrice * (order.side === 'BUY' ? order.fillQuantity : -order.fillQuantity));
      
      if (totalQuantity === 0) {
        // Position closed
        this.positions.delete(order.symbol);
      } else {
        existingPosition.quantity = totalQuantity;
        existingPosition.averagePrice = totalValue / totalQuantity;
        this.positions.set(order.symbol, existingPosition);
      }
    } else if (order.side === 'BUY') {
      // New position
      const newPosition: Position = {
        symbol: order.symbol,
        quantity: order.fillQuantity,
        averagePrice: order.fillPrice,
        currentPrice: order.fillPrice,
        pnl: 0,
        unrealizedPnl: 0
      };
      this.positions.set(order.symbol, newPosition);
    }

    this.emit('positionUpdated', this.positions.get(order.symbol));
  }

  // Handle strategy signal
  private async handleStrategySignal(signal: any) {
    try {
      if (signal.action === 'BUY' || signal.action === 'SELL') {
        await this.placeOrder({
          brokerId: signal.brokerId,
          symbol: signal.symbol,
          side: signal.action,
          quantity: signal.quantity,
          price: signal.price,
          orderType: signal.orderType || 'MARKET',
          strategyId: signal.strategyId
        });
      }
    } catch (error) {
      console.error(`❌ Failed to execute strategy signal:`, error);
    }
  }

  // Risk management checks
  private async performRiskChecks(order: Order): Promise<{ passed: boolean; reason?: string }> {
    // Max order size check
    if (order.quantity > 1000) {
      return { passed: false, reason: 'Order quantity exceeds maximum limit' };
    }

    // Price validation for limit orders
    if (order.orderType === 'LIMIT' && order.price) {
      const currentTick = this.marketData.get(order.symbol);
      if (currentTick) {
        const priceDeviation = Math.abs(order.price - currentTick.price) / currentTick.price;
        if (priceDeviation > 0.1) { // 10% price deviation limit
          return { passed: false, reason: 'Order price deviates too much from current market price' };
        }
      }
    }

    // Position size check
    const currentPosition = this.positions.get(order.symbol);
    if (currentPosition && order.side === 'BUY') {
      const newQuantity = currentPosition.quantity + order.quantity;
      if (newQuantity > 5000) { // Max position size
        return { passed: false, reason: 'Position size would exceed maximum limit' };
      }
    }

    return { passed: true };
  }

  // Place order with broker API
  private async placeBrokerOrder(broker: any, order: Order): Promise<string> {
    try {
      const response = await axios.post('https://api.dhan.co/v2/orders', {
        dhanClientId: broker.clientId,
        correlationId: order.id,
        transactionType: order.side,
        exchangeSegment: 'NSE_EQ',
        productType: 'INTRADAY',
        orderType: order.orderType,
        validity: 'DAY',
        securityId: order.symbol,
        quantity: order.quantity,
        price: order.price || 0
      }, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        }
      });

      return response.data.orderId;
    } catch (error) {
      console.error('❌ Broker order placement failed:', error);
      throw error;
    }
  }

  // Cancel order with broker API
  private async cancelBrokerOrder(broker: any, order: Order): Promise<void> {
    try {
      await axios.delete(`https://api.dhan.co/v2/orders/${order.id}`, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('❌ Broker order cancellation failed:', error);
      throw error;
    }
  }

  // Start market data feeds
  private async startMarketDataFeeds() {
    // Subscribe to commonly traded symbols
    const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'NIFTY50'];
    
    for (const symbol of symbols) {
      await this.subscribeToMarketData(symbol);
    }
  }

  // Start strategy execution
  private startStrategyExecution() {
    // This will be implemented when strategies are loaded
    console.log('📈 Strategy execution engine ready');
  }

  // Get engine status
  getStatus() {
    return {
      isRunning: this.isRunning,
      connectedBrokers: this.brokers.size,
      activeOrders: this.getOrders('PLACED').length,
      positions: this.positions.size,
      marketDataFeeds: this.websockets.size
    };
  }
}

// Singleton instance
export const tradingEngine = new TradingEngine();