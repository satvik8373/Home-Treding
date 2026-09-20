import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import { DhanOrderRequest, DhanOrderResponse, DhanOrderBookItem, DhanTradeResponse, DhanTradeHistoryResponseModel } from './types';
import { OrderRequest, OrderResult, BrokerOrder, OrderStatus } from '../types';
import { logger } from '../../utils/logger';

export class DhanOrdersService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Place an order on Dhan
   */
  public async placeOrder(order: OrderRequest): Promise<OrderResult> {
    try {
      // Map exchange to Dhan exchange segment format
      let exchangeSegment: any = 'NSE_EQ';
      if (order.exchange === 'NFO' || (order.exchange === 'NSE' && order.productType === 'MARGIN')) {
        exchangeSegment = 'NSE_FNO';
      } else if (order.exchange === 'BSE') {
        exchangeSegment = 'BSE_EQ';
      } else if (order.exchange === 'MCX') {
        exchangeSegment = 'MCX_COMM';
      }

      const payload: DhanOrderRequest = {
        dhanClientId: this.client.getClientId(),
        correlationId: order.correlationId || order.id || `ord_${Date.now()}`,
        transactionType: order.side,
        exchangeSegment: exchangeSegment,
        productType: order.productType as any || 'INTRADAY',
        orderType: order.orderType,
        validity: (order.validity === 'IOC' ? 'IOC' : 'DAY') as 'DAY' | 'IOC',
        securityId: order.securityId || order.symbol,
        quantity: order.quantity,
        price: order.orderType === 'LIMIT' || order.orderType === 'STOP_LOSS' ? order.price : 0,
        triggerPrice: order.orderType === 'STOP_LOSS' || order.orderType === 'STOP_LOSS_MARKET' ? order.triggerPrice : 0
      };

      const response = await this.client.post<DhanOrderResponse>(DHAN_CONFIG.ENDPOINTS.ORDERS, payload);

      logger.info(`[Dhan Order Placed] OrderId: ${response.orderId}, Status: ${response.orderStatus}`);

      return {
        success: true,
        orderId: order.id || response.orderId,
        brokerOrderId: response.orderId,
        status: this.mapDhanStatusToOrderStatus(response.orderStatus),
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('[Dhan Order Placement Error]', error);
      return {
        success: false,
        orderId: order.id || `err_${Date.now()}`,
        status: 'REJECTED',
        rejectionReason: error.message || 'Dhan Order placement failed',
        timestamp: new Date()
      };
    }
  }

  /**
   * Modify an existing order
   */
  public async modifyOrder(orderId: string, params: Partial<OrderRequest>): Promise<OrderResult> {
    try {
      const payload: any = {
        dhanClientId: this.client.getClientId(),
        orderId: orderId,
        orderType: params.orderType || 'LIMIT',
        quantity: params.quantity,
        price: params.price,
        triggerPrice: params.triggerPrice,
        validity: params.validity || 'DAY'
      };

      const response = await this.client.put<DhanOrderResponse>(DHAN_CONFIG.ENDPOINTS.MODIFY_ORDER(orderId), payload);

      return {
        success: true,
        orderId: orderId,
        brokerOrderId: response.orderId || orderId,
        status: this.mapDhanStatusToOrderStatus(response.orderStatus),
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        orderId: orderId,
        status: 'REJECTED',
        rejectionReason: error.message || 'Order modification failed',
        timestamp: new Date()
      };
    }
  }

  /**
   * Cancel an open order
   */
  public async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.client.delete(DHAN_CONFIG.ENDPOINTS.CANCEL_ORDER(orderId));
      return true;
    } catch (error) {
      logger.error(`[Dhan Order Cancel Error] OrderId: ${orderId}`, error);
      return false;
    }
  }

  /**
   * Get all orders for the current day
   */
  public async getOrders(): Promise<BrokerOrder[]> {
    const rawData = await this.client.get<DhanOrderBookItem[] | { data: DhanOrderBookItem[] }>(DHAN_CONFIG.ENDPOINTS.ORDERS);
    
    let items: DhanOrderBookItem[] = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && Array.isArray((rawData as any).data)) {
      items = (rawData as any).data;
    }

    return items.map((o) => {
      const qty = Number(o.quantity || 0);
      const filledQty = Number(o.filledQty || 0);
      const pendingQty = Math.max(0, qty - filledQty);

      return {
        orderId: o.correlationId || o.orderId,
        brokerOrderId: o.orderId,
        correlationId: o.correlationId,
        symbol: o.tradingSymbol || o.securityId,
        securityId: o.securityId,
        exchange: o.exchangeSegment || 'NSE',
        side: o.transactionType,
        orderType: o.orderType as any || 'LIMIT',
        productType: o.productType as any || 'INTRADAY',
        validity: o.validity as any || 'DAY',
        quantity: qty,
        filledQuantity: filledQty,
        pendingQuantity: pendingQty,
        price: Number(o.price || 0),
        triggerPrice: Number(o.triggerPrice || 0),
        averagePrice: Number(o.averageTradedPrice || o.price || 0),
        status: this.mapDhanStatusToOrderStatus(o.orderStatus),
        statusMessage: o.omsErrorDescription,
        orderTimestamp: o.createTime ? new Date(o.createTime) : new Date(),
        executionTimestamp: o.exchangeTime ? new Date(o.exchangeTime) : undefined
      };
    });
  }

  /**
   * Place a slice order on Dhan
   * POST /orders/slicing (DhanHQ OpenAPI 3.0.1)
   */
  public async placeSliceOrder(order: OrderRequest): Promise<OrderResult[]> {
    try {
      let exchangeSegment: any = 'NSE_EQ';
      if (order.exchange === 'NFO' || (order.exchange === 'NSE' && order.productType === 'MARGIN')) {
        exchangeSegment = 'NSE_FNO';
      } else if (order.exchange === 'BSE') {
        exchangeSegment = 'BSE_EQ';
      } else if (order.exchange === 'MCX') {
        exchangeSegment = 'MCX_COMM';
      }

      const payload: DhanOrderRequest = {
        dhanClientId: this.client.getClientId(),
        correlationId: order.correlationId || order.id || `slc_${Date.now()}`,
        transactionType: order.side,
        exchangeSegment: exchangeSegment,
        productType: (order.productType as any) || 'INTRADAY',
        orderType: order.orderType,
        validity: (order.validity === 'IOC' ? 'IOC' : 'DAY') as 'DAY' | 'IOC',
        securityId: order.securityId || order.symbol,
        quantity: order.quantity,
        price: order.orderType === 'LIMIT' || order.orderType === 'STOP_LOSS' ? order.price : 0,
        triggerPrice: order.orderType === 'STOP_LOSS' || order.orderType === 'STOP_LOSS_MARKET' ? order.triggerPrice : 0
      };

      const response = await this.client.post<DhanOrderResponse[]>(DHAN_CONFIG.ENDPOINTS.ORDER_SLICING, payload);
      const responses = Array.isArray(response) ? response : [response];

      return responses.map((res, index) => ({
        success: true,
        orderId: `${order.id || 'slice'}_${index + 1}`,
        brokerOrderId: res.orderId,
        status: this.mapDhanStatusToOrderStatus(res.orderStatus),
        timestamp: new Date()
      }));
    } catch (error: any) {
      logger.error('[Dhan Slice Order Placement Error]', error);
      return [{
        success: false,
        orderId: order.id || `err_${Date.now()}`,
        status: 'REJECTED',
        rejectionReason: error.message || 'Slice Order placement failed',
        timestamp: new Date()
      }];
    }
  }

  /**
   * Get trade book (all trades executed today)
   * GET /trades (DhanHQ OpenAPI 3.0.1)
   */
  public async getAllTrades(): Promise<DhanTradeResponse[]> {
    try {
      const response = await this.client.get<DhanTradeResponse[] | { data: DhanTradeResponse[] }>(DHAN_CONFIG.ENDPOINTS.TRADES);
      return Array.isArray(response) ? response : (response as any)?.data || [];
    } catch (error: any) {
      logger.error('[Dhan Get Trades Error]', error.message);
      return [];
    }
  }

  /**
   * Get trades for a specific order ID
   * GET /trades/{order-id} (DhanHQ OpenAPI 3.0.1)
   */
  public async getTradeByOrderId(orderId: string): Promise<DhanTradeResponse[]> {
    try {
      const response = await this.client.get<DhanTradeResponse[] | { data: DhanTradeResponse[] }>(DHAN_CONFIG.ENDPOINTS.TRADE_BOOK(orderId));
      return Array.isArray(response) ? response : (response as any)?.data || [];
    } catch (error: any) {
      logger.error(`[Dhan Get Trade for Order ${orderId} Error]`, error.message);
      return [];
    }
  }

  /**
   * Get trade history between dates
   * GET /trades/{from-date}/{to-date}/{page-number} (DhanHQ OpenAPI 3.0.1)
   */
  public async getTradeHistory(fromDate: string, toDate: string, pageNumber: number = 0): Promise<DhanTradeHistoryResponseModel[]> {
    try {
      const response = await this.client.get<DhanTradeHistoryResponseModel[] | { data: DhanTradeHistoryResponseModel[] }>(
        DHAN_CONFIG.ENDPOINTS.TRADE_HISTORY(fromDate, toDate, pageNumber)
      );
      return Array.isArray(response) ? response : (response as any)?.data || [];
    } catch (error: any) {
      logger.error('[Dhan Trade History Error]', error.message);
      return [];
    }
  }

  /**
   * Get order by ID
   * GET /orders/{order-id} (DhanHQ OpenAPI 3.0.1)
   */
  public async getOrderById(orderId: string): Promise<BrokerOrder | null> {
    try {
      const o = await this.client.get<DhanOrderBookItem>(DHAN_CONFIG.ENDPOINTS.ORDER_BY_ID(orderId));
      if (!o) return null;
      const qty = Number(o.quantity || 0);
      const filledQty = Number(o.filledQty || 0);
      return {
        orderId: o.correlationId || o.orderId,
        brokerOrderId: o.orderId,
        correlationId: o.correlationId,
        symbol: o.tradingSymbol || o.securityId,
        securityId: o.securityId,
        exchange: o.exchangeSegment || 'NSE',
        side: o.transactionType,
        orderType: (o.orderType as any) || 'LIMIT',
        productType: (o.productType as any) || 'INTRADAY',
        validity: (o.validity as any) || 'DAY',
        quantity: qty,
        filledQuantity: filledQty,
        pendingQuantity: Math.max(0, qty - filledQty),
        price: Number(o.price || 0),
        triggerPrice: Number(o.triggerPrice || 0),
        averagePrice: Number(o.averageTradedPrice || o.price || 0),
        status: this.mapDhanStatusToOrderStatus(o.orderStatus),
        statusMessage: o.omsErrorDescription,
        orderTimestamp: o.createTime ? new Date(o.createTime) : new Date(),
        executionTimestamp: o.exchangeTime ? new Date(o.exchangeTime) : undefined
      };
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Get order by correlation ID
   * GET /orders/external/{correlation-id} (DhanHQ OpenAPI 3.0.1)
   */
  public async getOrderByCorrelationId(correlationId: string): Promise<BrokerOrder | null> {
    try {
      const o = await this.client.get<DhanOrderBookItem>(DHAN_CONFIG.ENDPOINTS.ORDER_BY_CORRELATION(correlationId));
      if (!o) return null;
      const qty = Number(o.quantity || 0);
      const filledQty = Number(o.filledQty || 0);
      return {
        orderId: o.correlationId || o.orderId,
        brokerOrderId: o.orderId,
        correlationId: o.correlationId,
        symbol: o.tradingSymbol || o.securityId,
        securityId: o.securityId,
        exchange: o.exchangeSegment || 'NSE',
        side: o.transactionType,
        orderType: (o.orderType as any) || 'LIMIT',
        productType: (o.productType as any) || 'INTRADAY',
        validity: (o.validity as any) || 'DAY',
        quantity: qty,
        filledQuantity: filledQty,
        pendingQuantity: Math.max(0, qty - filledQty),
        price: Number(o.price || 0),
        triggerPrice: Number(o.triggerPrice || 0),
        averagePrice: Number(o.averageTradedPrice || o.price || 0),
        status: this.mapDhanStatusToOrderStatus(o.orderStatus),
        statusMessage: o.omsErrorDescription,
        orderTimestamp: o.createTime ? new Date(o.createTime) : new Date(),
        executionTimestamp: o.exchangeTime ? new Date(o.exchangeTime) : undefined
      };
    } catch (error: any) {
      return null;
    }
  }

  private mapDhanStatusToOrderStatus(dhanStatus: string): OrderStatus {
    switch (dhanStatus?.toUpperCase()) {
      case 'TRANSIT':
      case 'PENDING':
        return 'PENDING';
      case 'OPEN':
      case 'TRIGGER_PENDING':
        return 'OPEN';
      case 'PARTIALLY_FILLED':
      case 'PART_TRADED':
        return 'PARTIALLY_FILLED';
      case 'TRADED':
      case 'FILLED':
        return 'FILLED';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'REJECTED':
        return 'REJECTED';
      case 'EXPIRED':
        return 'EXPIRED';
      default:
        return 'PENDING';
    }
  }
}

