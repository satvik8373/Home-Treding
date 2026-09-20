/**
 * DhanHQ v2 Conditional Trigger Orders Service
 * Handles technical indicator alerts & conditional order executions (up to 15 orders)
 * Reference: https://dhanhq.co/docs/v2/conditional-trigger/
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';

export interface ConditionalOrderLeg {
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: string;
  productType: 'CNC' | 'INTRADAY' | 'MARGIN';
  orderType: 'LIMIT' | 'MARKET';
  securityId: string;
  quantity: number;
  price?: number;
}

export interface ConditionalTriggerRequest {
  securityId: string;
  exchangeSegment: string;
  indicator: string; // e.g. SMA_5, RSI_14, VWAP
  timeframe: 'MINUTE_1' | 'MINUTE_5' | 'MINUTE_15' | 'HOUR_1' | 'DAY';
  operator: 'CROSSING_UP' | 'CROSSING_DOWN' | 'GREATER_THAN' | 'LESS_THAN' | 'EQUAL';
  comparison: 'VALUE' | 'INDICATOR' | 'PRICE';
  value: number;
  expiry?: string;
  frequency?: 'ONCE' | 'EVERY_TIME';
  orders: ConditionalOrderLeg[];
}

export interface ConditionalTriggerResult {
  success: boolean;
  alertId?: string;
  status: string;
  message?: string;
  error?: string;
}

export class DhanConditionalTriggerService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Place a Conditional Trigger Order with attached order basket
   */
  public async placeConditionalTrigger(params: ConditionalTriggerRequest): Promise<ConditionalTriggerResult> {
    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.CONDITIONAL_TRIGGERS, params);
      return {
        success: true,
        alertId: response.alertId || response.data?.alertId,
        status: response.status || 'ACTIVE',
        message: 'Conditional Trigger Order placed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        error: error.message || 'Failed to place Conditional Trigger Order'
      };
    }
  }

  /**
   * Fetch all active conditional triggers
   */
  public async getConditionalTriggers(): Promise<any[]> {
    try {
      const response = await this.client.get<any>(DHAN_CONFIG.ENDPOINTS.CONDITIONAL_TRIGGERS);
      return Array.isArray(response) ? response : response?.data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch a single conditional trigger by ID
   * GET /alerts/orders/{alertId} (DhanHQ OpenAPI 3.0.1)
   */
  public async getConditionalTriggerById(alertId: string): Promise<any> {
    try {
      return await this.client.get<any>(DHAN_CONFIG.ENDPOINTS.CONDITIONAL_TRIGGER_BY_ID(alertId));
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Modify existing conditional trigger
   * PUT /alerts/orders/{alertId} (DhanHQ OpenAPI 3.0.1)
   */
  public async modifyConditionalTrigger(alertId: string, params: any): Promise<any> {
    try {
      const payload = {
        dhanClientId: this.client.getClientId(),
        alertId,
        ...params
      };
      return await this.client.put(DHAN_CONFIG.ENDPOINTS.CONDITIONAL_TRIGGER_BY_ID(alertId), payload);
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to modify alert' };
    }
  }

  /**
   * Place multi order directly without conditions
   * POST /alerts/multi/orders (DhanHQ OpenAPI 3.0.1)
   */
  public async placeMultiOrder(orders: any[]): Promise<any> {
    try {
      const payload = {
        dhanClientId: this.client.getClientId(),
        orders
      };
      return await this.client.post(DHAN_CONFIG.ENDPOINTS.MULTI_ORDERS, payload);
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to place multi order' };
    }
  }

  /**
   * Cancel a conditional trigger
   */
  public async cancelConditionalTrigger(alertId: string): Promise<boolean> {
    try {
      await this.client.delete(DHAN_CONFIG.ENDPOINTS.CONDITIONAL_TRIGGER_BY_ID(alertId));
      return true;
    } catch (error) {
      return false;
    }
  }
}

