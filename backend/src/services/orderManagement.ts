import { EventEmitter } from 'events';
import { tradingEngine, Order } from './tradingEngine';
import axios from 'axios';

export interface OrderRequest {
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  validity?: 'DAY' | 'IOC' | 'GTD';
  strategyId?: string;
  userId?: string;
}

export interface OrderModification {
  orderId: string;
  quantity?: number;
  price?: number;
}

export class OrderManagementSystem extends EventEmitter {
  private orders: Map<string, Order> = new Map();
  private orderHistory: Order[] = [];
  private brokerConnections: Map<string, any> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Listen to trading engine events
    tradingEngine.on('orderPlaced', (order: Order) => {
      this.orders.set(order.id, order);
      this.emit('orderStatusUpdate', order);
    });

    tradingEngine.on('orderFilled', (order: Order) => {
      this.orders.set(order.id, order);
      this.orderHistory.push({ ...order });
      this.emit('orderStatusUpdate', order);
      this.emit('orderFilled', order);
    });

    tradingEngine.on('orderCancelled', (order: Order) => {
      this.orders.set(order.id, order);
      this.emit('orderStatusUpdate', order);
    });
  }

  // Place a new order
  async placeOrder(orderRequest: OrderRequest): Promise<Order> {
    try {
      console.log(`📋 Placing order: ${orderRequest.symbol} ${orderRequest.side} ${orderRequest.quantity}`);

      // Validate order request
      this.validateOrderRequest(orderRequest);

      // Check broker connection
      const broker = this.brokerConnections.get(orderRequest.brokerId);
      if (!broker || !broker.connected) {
        throw new Error(`Broker ${orderRequest.brokerId} is not connected`);
      }

      // Place order through trading engine
      const order = await tradingEngine.placeOrder(orderRequest);

      // Start monitoring order status
      this.startOrderMonitoring(order.id);

      return order;
    } catch (error) {
      console.error(`❌ Failed to place order:`, error);
      throw error;
    }
  }

  // Modify an existing order
  async modifyOrder(modification: OrderModification): Promise<Order> {
    const order = this.orders.get(modification.orderId);
    if (!order) {
      throw new Error(`Order ${modification.orderId} not found`);
    }

    if (order.status !== 'PLACED') {
      throw new Error(`Cannot modify order in status: ${order.status}`);
    }

    try {
      console.log(`📝 Modifying order: ${modification.orderId}`);

      const broker = this.brokerConnections.get(order.brokerId);
      if (!broker) {
        throw new Error(`Broker ${order.brokerId} not found`);
      }

      // Modify order with broker API
      await this.modifyBrokerOrder(broker, order, modification);

      // Update local order
      if (modification.quantity) order.quantity = modification.quantity;
      if (modification.price) order.price = modification.price;

      this.orders.set(order.id, order);
      this.emit('orderStatusUpdate', order);

      console.log(`✅ Order modified successfully: ${order.id}`);
      return order;
    } catch (error) {
      console.error(`❌ Failed to modify order:`, error);
      throw error;
    }
  }

  // Cancel an order
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      console.log(`❌ Cancelling order: ${orderId}`);
      
      const success = await tradingEngine.cancelOrder(orderId);
      
      if (success) {
        console.log(`✅ Order cancelled successfully: ${orderId}`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ Failed to cancel order:`, error);
      throw error;
    }
  }

  // Get order by ID
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  // Get all orders for a broker
  getOrdersByBroker(brokerId: string): Order[] {
    return Array.from(this.orders.values()).filter(order => order.brokerId === brokerId);
  }

  // Get orders by status
  getOrdersByStatus(status: string): Order[] {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  // Get order history
  getOrderHistory(limit?: number): Order[] {
    const history = [...this.orderHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  // Get orders for a specific strategy
  getOrdersByStrategy(strategyId: string): Order[] {
    return Array.from(this.orders.values()).filter(order => order.strategyId === strategyId);
  }

  // Add broker connection
  addBrokerConnection(brokerId: string, brokerConfig: any) {
    this.brokerConnections.set(brokerId, {
      ...brokerConfig,
      connected: true,
      addedAt: new Date()
    });
    console.log(`🔗 Added broker connection: ${brokerId}`);
  }

  // Remove broker connection
  removeBrokerConnection(brokerId: string) {
    this.brokerConnections.delete(brokerId);
    console.log(`🗑️ Removed broker connection: ${brokerId}`);
  }

  // Validate order request
  private validateOrderRequest(orderRequest: OrderRequest) {
    if (!orderRequest.brokerId) {
      throw new Error('Broker ID is required');
    }

    if (!orderRequest.symbol) {
      throw new Error('Symbol is required');
    }

    if (!orderRequest.side || !['BUY', 'SELL'].includes(orderRequest.side)) {
      throw new Error('Valid side (BUY/SELL) is required');
    }

    if (!orderRequest.quantity || orderRequest.quantity <= 0) {
      throw new Error('Valid quantity is required');
    }

    if (orderRequest.orderType === 'LIMIT' && !orderRequest.price) {
      throw new Error('Price is required for LIMIT orders');
    }

    if (orderRequest.quantity > 10000) {
      throw new Error('Order quantity exceeds maximum limit');
    }
  }

  // Start monitoring order status
  private startOrderMonitoring(orderId: string) {
    const checkInterval = setInterval(async () => {
      try {
        const order = this.orders.get(orderId);
        if (!order || ['FILLED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
          clearInterval(checkInterval);
          return;
        }

        // Check order status with broker
        const updatedStatus = await this.checkOrderStatus(order);
        if (updatedStatus && updatedStatus !== order.status) {
          order.status = updatedStatus.status;
          if (updatedStatus.fillPrice) order.fillPrice = updatedStatus.fillPrice;
          if (updatedStatus.fillQuantity) order.fillQuantity = updatedStatus.fillQuantity;

          this.orders.set(orderId, order);
          this.emit('orderStatusUpdate', order);

          if (order.status === 'FILLED') {
            tradingEngine.emit('orderFilled', order);
          }
        }
      } catch (error) {
        console.error(`❌ Error monitoring order ${orderId}:`, error);
      }
    }, 5000); // Check every 5 seconds
  }

  // Check order status with broker API
  private async checkOrderStatus(order: Order): Promise<any> {
    try {
      const broker = this.brokerConnections.get(order.brokerId);
      if (!broker) return null;

      const response = await axios.get(`https://api.dhan.co/v2/orders/${order.id}`, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        }
      });

      return {
        status: this.mapBrokerStatus(response.data.orderStatus),
        fillPrice: response.data.price,
        fillQuantity: response.data.filledQty
      };
    } catch (error) {
      console.error(`❌ Failed to check order status:`, error);
      return null;
    }
  }

  // Modify order with broker API
  private async modifyBrokerOrder(broker: any, order: Order, modification: OrderModification) {
    try {
      await axios.put(`https://api.dhan.co/v2/orders/${order.id}`, {
        quantity: modification.quantity || order.quantity,
        price: modification.price || order.price,
        orderType: order.orderType,
        validity: 'DAY'
      }, {
        headers: {
          'access-token': broker.accessToken,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('❌ Broker order modification failed:', error);
      throw error;
    }
  }

  // Map broker status to internal status
  private mapBrokerStatus(brokerStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'PENDING',
      'OPEN': 'PLACED',
      'COMPLETE': 'FILLED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED'
    };

    return statusMap[brokerStatus] || 'PENDING';
  }

  // Get order statistics
  getOrderStatistics(brokerId?: string): any {
    let orders = Array.from(this.orders.values());
    
    if (brokerId) {
      orders = orders.filter(order => order.brokerId === brokerId);
    }

    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      placed: orders.filter(o => o.status === 'PLACED').length,
      filled: orders.filter(o => o.status === 'FILLED').length,
      cancelled: orders.filter(o => o.status === 'CANCELLED').length,
      rejected: orders.filter(o => o.status === 'REJECTED').length,
      buyOrders: orders.filter(o => o.side === 'BUY').length,
      sellOrders: orders.filter(o => o.side === 'SELL').length,
      totalVolume: orders.reduce((sum, o) => sum + (o.fillQuantity || 0), 0),
      totalValue: orders.reduce((sum, o) => sum + ((o.fillPrice || 0) * (o.fillQuantity || 0)), 0)
    };

    return stats;
  }
}

// Singleton instance
export const orderManagement = new OrderManagementSystem();