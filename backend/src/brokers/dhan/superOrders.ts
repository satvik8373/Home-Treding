/**
 * DhanHQ v2 Super Orders Service
 * Handles multi-leg orders with Entry, Target, Stop-Loss, and Trailing SL Jump
 * Reference: https://dhanhq.co/docs/v2/super-order/
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';

export interface SuperOrderRequest {
  securityId: string;
  exchangeSegment: string;
  transactionType: 'BUY' | 'SELL';
  productType: 'INTRADAY' | 'CNC' | 'MARGIN';
  orderType: 'LIMIT' | 'MARKET';
  quantity: number;
  price?: number;
  targetPrice: number;
  stopLossPrice: number;
  trailingJump?: number;
  correlationId?: string;
}

export interface SuperOrderResult {
  success: boolean;
  orderId?: string;
  status: string;
  message?: string;
  error?: string;
}

export class DhanSuperOrderService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Place a multi-leg Super Order
   */
  public async placeSuperOrder(params: SuperOrderRequest): Promise<SuperOrderResult> {
    try {
      const payload = {
        securityId: params.securityId,
        exchangeSegment: params.exchangeSegment,
        transactionType: params.transactionType,
        productType: params.productType,
        orderType: params.orderType,
        quantity: params.quantity,
        price: params.price || 0,
        targetPrice: params.targetPrice,
        stopLossPrice: params.stopLossPrice,
        trailingJump: params.trailingJump || 0,
        correlationId: params.correlationId || `spr_${Date.now()}`
      };

      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.SUPER_ORDERS, payload);

      return {
        success: true,
        orderId: response.orderId || response.data?.orderId,
        status: response.orderStatus || 'PENDING',
        message: 'Super Order placed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        error: error.message || 'Failed to place Super Order'
      };
    }
  }

  /**
   * Fetch all open Super Orders
   */
  public async getSuperOrders(): Promise<any[]> {
    try {
      const response = await this.client.get<any>(DHAN_CONFIG.ENDPOINTS.SUPER_ORDERS);
      return Array.isArray(response) ? response : response?.data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Cancel specific leg of a Super Order (e.g. TARGET, STOP_LOSS)
   */
  public async cancelSuperOrderLeg(orderId: string, leg: 'TARGET' | 'STOP_LOSS' | 'ALL'): Promise<boolean> {
    try {
      await this.client.delete(DHAN_CONFIG.ENDPOINTS.CANCEL_SUPER_ORDER_LEG(orderId, leg));
      return true;
    } catch (error) {
      return false;
    }
  }
}
