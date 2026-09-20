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
   * Modify pending super order leg
   * PUT /super/orders/{order-id} (DhanHQ OpenAPI 3.0.1)
   */
  public async modifySuperOrder(orderId: string, params: {
    orderType?: 'LIMIT' | 'MARKET';
    legName?: 'ENTRY_LEG' | 'STOP_LOSS_LEG' | 'TARGET_LEG';
    quantity?: number;
    price?: number;
    targetPrice?: number;
    stopLossPrice?: number;
    trailingJump?: number;
  }): Promise<any> {
    try {
      const payload = {
        dhanClientId: this.client.getClientId(),
        orderId,
        ...params
      };
      return await this.client.put(DHAN_CONFIG.ENDPOINTS.SUPER_ORDER_BY_ID(orderId), payload);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to modify super order'
      };
    }
  }

  /**
   * Cancel specific leg of a Super Order (ENTRY_LEG, STOP_LOSS_LEG, TARGET_LEG)
   * DELETE /super/orders/{order-id}/{order-leg} (DhanHQ OpenAPI 3.0.1)
   */
  public async cancelSuperOrderLeg(
    orderId: string,
    leg: 'ENTRY_LEG' | 'STOP_LOSS_LEG' | 'TARGET_LEG' | 'TARGET' | 'STOP_LOSS' | string
  ): Promise<boolean> {
    try {
      let legParam = leg;
      if (leg === 'TARGET') legParam = 'TARGET_LEG';
      if (leg === 'STOP_LOSS') legParam = 'STOP_LOSS_LEG';

      await this.client.delete(DHAN_CONFIG.ENDPOINTS.CANCEL_SUPER_ORDER_LEG(orderId, legParam));
      return true;
    } catch (error) {
      return false;
    }
  }
}

