/**
 * DhanHQ v2 Margin Calculator Service
 * Computes exact pre-trade margin (SPAN + Exposure), Leverage, and Brokerage
 * Reference: https://dhanhq.co/docs/v2/funds/
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';

export interface MarginOrderInput {
  securityId: string;
  exchangeSegment: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  productType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'MTF';
  price?: number;
  triggerPrice?: number;
}

export interface MarginCalculationResult {
  totalMargin: number;
  spanMargin: number;
  exposureMargin: number;
  availableBalance: number;
  insufficientBalance: number;
  leverage: number;
  brokerage: number;
  isSufficient: boolean;
}

export class DhanMarginCalculatorService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Calculate margin for a single order
   */
  public async calculateMargin(order: MarginOrderInput): Promise<MarginCalculationResult> {
    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.MARGIN_CALCULATOR, order);
      const data = response?.data || response;

      const totalMargin = Number(data.totalMargin || data.marginRequired || 0);
      const available = Number(data.availableBalance || data.availableMargin || 0);
      const span = Number(data.spanMargin || 0);
      const exposure = Number(data.exposureMargin || 0);

      return {
        totalMargin,
        spanMargin: span,
        exposureMargin: exposure,
        availableBalance: available,
        insufficientBalance: Math.max(0, totalMargin - available),
        leverage: Number(data.leverage || 1),
        brokerage: Number(data.brokerage || 20),
        isSufficient: available >= totalMargin
      };
    } catch (error: any) {
      return {
        totalMargin: 0,
        spanMargin: 0,
        exposureMargin: 0,
        availableBalance: 0,
        insufficientBalance: 0,
        leverage: 1,
        brokerage: 0,
        isSufficient: true
      };
    }
  }

  /**
   * Calculate composite margin for a multi-order basket (with hedge benefit)
   */
  public async calculateMultiMargin(orders: MarginOrderInput[]): Promise<MarginCalculationResult> {
    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.MARGIN_CALCULATOR_MULTI, { orders });
      const data = response?.data || response;

      const totalMargin = Number(data.totalMargin || data.marginRequired || 0);
      const available = Number(data.availableBalance || 0);

      return {
        totalMargin,
        spanMargin: Number(data.spanMargin || 0),
        exposureMargin: Number(data.exposureMargin || 0),
        availableBalance: available,
        insufficientBalance: Math.max(0, totalMargin - available),
        leverage: Number(data.leverage || 1),
        brokerage: Number(data.brokerage || orders.length * 20),
        isSufficient: available >= totalMargin
      };
    } catch (error: any) {
      return {
        totalMargin: 0,
        spanMargin: 0,
        exposureMargin: 0,
        availableBalance: 0,
        insufficientBalance: 0,
        leverage: 1,
        brokerage: 0,
        isSufficient: true
      };
    }
  }
}
