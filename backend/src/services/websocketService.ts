import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { tradingEngine } from './tradingEngine';

export class WebSocketService {
  private io: SocketIOServer;
  private connectedClients: Map<string, any> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: ["http://localhost:3000", "http://localhost:3001"],
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
    this.setupTradingEngineListeners();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      
      // Store client connection
      this.connectedClients.set(socket.id, {
        socketId: socket.id,
        connectedAt: new Date(),
        subscriptions: new Set()
      });

      // Handle client authentication
      socket.on('authenticate', (data) => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.userId = data.userId;
          client.authenticated = true;
          console.log(`🔐 Client authenticated: ${data.userId}`);
          
          // Send initial data
          this.sendInitialData(socket);
        }
      });

      // Handle market data subscription
      socket.on('subscribe_market_data', (symbols: string[]) => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          symbols.forEach(symbol => {
            client.subscriptions.add(`market_${symbol}`);
            tradingEngine.subscribeToMarketData(symbol);
          });
          console.log(`📊 Client subscribed to market data: ${symbols.join(', ')}`);
        }
      });

      // Handle order updates subscription
      socket.on('subscribe_orders', (brokerId: string) => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.subscriptions.add(`orders_${brokerId}`);
          console.log(`📋 Client subscribed to orders for broker: ${brokerId}`);
        }
      });

      // Handle position updates subscription
      socket.on('subscribe_positions', (brokerId: string) => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.subscriptions.add(`positions_${brokerId}`);
          console.log(`💼 Client subscribed to positions for broker: ${brokerId}`);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  private setupTradingEngineListeners() {
    // Market data updates
    tradingEngine.on('marketTick', (tick) => {
      this.broadcastToSubscribers(`market_${tick.symbol}`, 'market_tick', {
        symbol: tick.symbol,
        price: tick.price,
        volume: tick.volume,
        timestamp: tick.timestamp,
        change: this.calculatePriceChange(tick)
      });
    });

    // Order updates
    tradingEngine.on('orderPlaced', (order) => {
      this.broadcastToSubscribers(`orders_${order.brokerId}`, 'order_update', {
        type: 'placed',
        order: this.sanitizeOrder(order)
      });
    });

    tradingEngine.on('orderFilled', (order) => {
      this.broadcastToSubscribers(`orders_${order.brokerId}`, 'order_update', {
        type: 'filled',
        order: this.sanitizeOrder(order)
      });
    });

    tradingEngine.on('orderCancelled', (order) => {
      this.broadcastToSubscribers(`orders_${order.brokerId}`, 'order_update', {
        type: 'cancelled',
        order: this.sanitizeOrder(order)
      });
    });

    // Position updates
    tradingEngine.on('positionUpdated', (position) => {
      this.io.emit('position_update', {
        symbol: position.symbol,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        currentPrice: position.currentPrice,
        pnl: position.pnl,
        unrealizedPnl: position.unrealizedPnl,
        timestamp: new Date()
      });
    });

    // Trading engine status updates
    tradingEngine.on('engineStarted', () => {
      this.io.emit('engine_status', {
        status: 'started',
        timestamp: new Date()
      });
    });

    tradingEngine.on('engineStopped', () => {
      this.io.emit('engine_status', {
        status: 'stopped',
        timestamp: new Date()
      });
    });
  }

  private sendInitialData(socket: any) {
    // Send current trading engine status
    const engineStatus = tradingEngine.getStatus();
    socket.emit('engine_status', {
      status: engineStatus.isRunning ? 'running' : 'stopped',
      ...engineStatus,
      timestamp: new Date()
    });

    // Send current positions
    const positions = tradingEngine.getPositions();
    socket.emit('positions_snapshot', positions);

    // Send current orders
    const orders = tradingEngine.getOrders();
    socket.emit('orders_snapshot', orders.map(order => this.sanitizeOrder(order)));
  }

  private broadcastToSubscribers(subscription: string, event: string, data: any) {
    for (const [socketId, client] of this.connectedClients) {
      if (client.subscriptions.has(subscription)) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  private sanitizeOrder(order: any) {
    // Remove sensitive information before sending to client
    return {
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      orderType: order.orderType,
      status: order.status,
      timestamp: order.timestamp,
      fillPrice: order.fillPrice,
      fillQuantity: order.fillQuantity
    };
  }

  private calculatePriceChange(tick: any) {
    // This would typically compare with previous price
    // For now, return a placeholder
    return {
      absolute: 0,
      percentage: 0
    };
  }

  // Broadcast system notifications
  broadcastNotification(type: 'info' | 'warning' | 'error' | 'success', message: string, data?: any) {
    this.io.emit('notification', {
      type,
      message,
      data,
      timestamp: new Date()
    });
  }

  // Broadcast broker status updates
  broadcastBrokerStatus(brokerId: string, status: string, data?: any) {
    this.io.emit('broker_status_update', {
      brokerId,
      status,
      data,
      timestamp: new Date()
    });
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Get client subscriptions
  getClientSubscriptions(): any[] {
    return Array.from(this.connectedClients.values()).map(client => ({
      socketId: client.socketId,
      userId: client.userId,
      authenticated: client.authenticated,
      subscriptions: Array.from(client.subscriptions),
      connectedAt: client.connectedAt
    }));
  }
}

export default WebSocketService;