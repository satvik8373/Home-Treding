/**
 * DhanHQ v2 Forever / GTT / OCO Orders Service
 * Handles persistent trigger orders and OCO orders executed directly on Dhan
 * Reference: https://dhanhq.co/docs/v2/forever/
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';

export interface ForeverOrderRequest {
  orderFlag: 'SINGLE' | 'OCO';
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: string;
  productType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'MTF';
  orderType: 'LIMIT' | 'MARKET';
  validity: 'DAY';
  securityId: string;
  quantity: number;
  price?: number;
  triggerPrice: number;
  targetPrice?: number;
  targetTriggerPrice?: number;
  stopLossPrice?: number;
  stopLossTriggerPrice?: number;
  correlationId?: string;
}

export interface ForeverOrderResult {
  success: boolean;
  orderId?: string;
  status: string;
  message?: string;
  error?: string;
}

export class DhanForeverOrderService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Place GTT or OCO Forever Order
   */
  public async placeForeverOrder(params: ForeverOrderRequest): Promise<ForeverOrderResult> {
    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.FOREVER_ORDERS, params);
      return {
        success: true,
        orderId: response.orderId || response.data?.orderId,
        status: response.orderStatus || 'CONFIRMED',
        message: 'Forever / GTT Order placed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        error: error.message || 'Failed to place Forever Order'
      };
    }
  }

  /**
   * Fetch all open Forever Orders
   */
  public async getForeverOrders(): Promise<any[]> {
    try {
      const response = await this.client.get<any>(DHAN_CONFIG.ENDPOINTS.FOREVER_ORDERS);
      return Array.isArray(response) ? response : response?.data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Cancel open Forever Order
   */
  public async cancelForeverOrder(orderId: string): Promise<boolean> {
    try {
      await this.client.delete(DHAN_CONFIG.ENDPOINTS.FOREVER_ORDER_BY_ID(orderId));
      return true;
    } catch (error) {
      return false;
    }
  }
}
