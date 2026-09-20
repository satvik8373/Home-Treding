/**
 * DhanHQ v2 Data APIs Service
 * Implements:
 * - POST /data/technical (Technical Metrics & Indicators)
 * - POST /data/newsheadline (Live News Headlines)
 * - POST /data/marketmovers (Market Movers & Top Gainers/Losers/OI)
 * - POST /data/companyinfo (Fundamental Metrics & Ratios)
 * Reference: DhanHQ OpenAPI 3.0.1
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import {
  DhanTechnicalMetricsRequest,
  DhanTechnicalMetricsResponse,
  DhanNewsHeadlineRequest,
  DhanNewsHeadlineResponse,
  DhanTopInstrumentsRequest,
  DhanTopInstrumentsResponse,
  DhanCompanyInfoRequest,
  DhanCompanyInfoResponse
} from './types';
import { logger } from '../../utils/logger';

export class DhanDataApiService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Fetch technical indicator metrics for an instrument (SMA, EMA, RSI, MACD, PIVOT, ATR, etc.)
   * POST /data/technical
   */
  public async getTechnicalMetrics(params: DhanTechnicalMetricsRequest): Promise<DhanTechnicalMetricsResponse> {
    try {
      return await this.client.post<DhanTechnicalMetricsResponse>(DHAN_CONFIG.ENDPOINTS.DATA_TECHNICAL, params);
    } catch (error: any) {
      logger.error('[Dhan Data API - Technical Metrics Error]', error.message);
      throw error;
    }
  }

  /**
   * Fetch live news headlines with optional categories and universe filter
   * POST /data/newsheadline
   */
  public async getNewsHeadlines(params: {
    categories?: string[];
    limit?: number;
    universe?: 'PORTFOLIO' | 'WATCHLIST';
    stockList?: string[];
  }): Promise<DhanNewsHeadlineResponse> {
    try {
      const payload: DhanNewsHeadlineRequest = {
        dhanClientId: this.client.getClientId(),
        categories: params.categories && params.categories.length > 0 ? params.categories : ['ALL'],
        limit: Math.min(50, Math.max(1, params.limit || 20)),
        universe: params.universe,
        stockList: params.stockList || []
      };
      return await this.client.post<DhanNewsHeadlineResponse>(DHAN_CONFIG.ENDPOINTS.DATA_NEWS_HEADLINE, payload);
    } catch (error: any) {
      logger.error('[Dhan Data API - News Headlines Error]', error.message);
      throw error;
    }
  }

  /**
   * Fetch market movers: top options, futures, and stocks ranked by OI, Volume, or Price
   * POST /data/marketmovers
   */
  public async getMarketMovers(params: DhanTopInstrumentsRequest): Promise<DhanTopInstrumentsResponse> {
    try {
      return await this.client.post<DhanTopInstrumentsResponse>(DHAN_CONFIG.ENDPOINTS.DATA_MARKET_MOVERS, params);
    } catch (error: any) {
      logger.error('[Dhan Data API - Market Movers Error]', error.message);
      throw error;
    }
  }

  /**
   * Fetch fundamental company overview, valuation ratios, and shareholding pattern
   * POST /data/companyinfo
   */
  public async getCompanyInfo(params: DhanCompanyInfoRequest): Promise<DhanCompanyInfoResponse> {
    try {
      return await this.client.post<DhanCompanyInfoResponse>(DHAN_CONFIG.ENDPOINTS.DATA_COMPANY_INFO, params);
    } catch (error: any) {
      logger.error('[Dhan Data API - Company Info Error]', error.message);
      throw error;
    }
  }
}
