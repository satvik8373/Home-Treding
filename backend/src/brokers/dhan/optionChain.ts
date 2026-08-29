/**
 * DhanHQ v2 Option Chain Service
 * Fetches real-time Option Chain, Greeks (Delta, Theta, Gamma, Vega), OI, and Expiries
 * Reference: https://dhanhq.co/docs/v2/option-chain/
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';

export interface OptionGreek {
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  iv?: number;
}

export interface OptionStrikeData {
  strikePrice: number;
  ce?: {
    securityId: string;
    symbol: string;
    ltp: number;
    change: number;
    changePercent: number;
    volume: number;
    oi: number;
    previousOi: number;
    iv: number;
    greeks?: OptionGreek;
    bidPrice: number;
    askPrice: number;
  };
  pe?: {
    securityId: string;
    symbol: string;
    ltp: number;
    change: number;
    changePercent: number;
    volume: number;
    oi: number;
    previousOi: number;
    iv: number;
    greeks?: OptionGreek;
    bidPrice: number;
    askPrice: number;
  };
}

export interface OptionChainResponse {
  underlying: string;
  underlyingPrice: number;
  expiry: string;
  strikes: OptionStrikeData[];
  totalCeOi: number;
  totalPeOi: number;
  pcrRatio: number;
  timestamp: Date;
}

export class DhanOptionChainService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Fetch list of available expiry dates for an underlying
   */
  public async getExpiryList(underlyingSecurityId: string, exchangeSegment: string = 'NSE_FNO'): Promise<string[]> {
    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.OPTION_CHAIN_EXPIRIES, {
        UnderlyingSecurityId: Number(underlyingSecurityId) || underlyingSecurityId,
        UnderlyingExchangeSegment: exchangeSegment
      });

      if (response && Array.isArray(response.data)) {
        return response.data;
      }
      if (Array.isArray(response)) {
        return response;
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch full Option Chain for an underlying and specific expiry
   */
  public async getOptionChain(params: {
    underlyingSecurityId: string;
    underlyingExchangeSegment?: string;
    expiry: string;
  }): Promise<OptionChainResponse | null> {
    const { underlyingSecurityId, underlyingExchangeSegment = 'NSE_FNO', expiry } = params;

    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.OPTION_CHAIN, {
        UnderlyingSecurityId: Number(underlyingSecurityId) || underlyingSecurityId,
        UnderlyingExchangeSegment: underlyingExchangeSegment,
        Expiry: expiry
      });

      const raw = response?.data || response;
      if (!raw || !raw.oc) return null;

      const strikes: OptionStrikeData[] = [];
      let totalCeOi = 0;
      let totalPeOi = 0;

      const ocMap = raw.oc || {};
      for (const [strikeStr, data] of Object.entries<any>(ocMap)) {
        const strikePrice = parseFloat(strikeStr);
        const ce = data.ce ? {
          securityId: String(data.ce.security_id || data.ce.securityId || ''),
          symbol: data.ce.symbol || `CE ${strikePrice}`,
          ltp: Number(data.ce.last_price || data.ce.ltp || 0),
          change: Number(data.ce.change || 0),
          changePercent: Number(data.ce.change_percent || 0),
          volume: Number(data.ce.volume || 0),
          oi: Number(data.ce.oi || 0),
          previousOi: Number(data.ce.previous_oi || 0),
          iv: Number(data.ce.iv || 0),
          greeks: data.ce.greeks,
          bidPrice: Number(data.ce.top_bid_price || data.ce.bid || 0),
          askPrice: Number(data.ce.top_ask_price || data.ce.ask || 0)
        } : undefined;

        const pe = data.pe ? {
          securityId: String(data.pe.security_id || data.pe.securityId || ''),
          symbol: data.pe.symbol || `PE ${strikePrice}`,
          ltp: Number(data.pe.last_price || data.pe.ltp || 0),
          change: Number(data.pe.change || 0),
          changePercent: Number(data.pe.change_percent || 0),
          volume: Number(data.pe.volume || 0),
          oi: Number(data.pe.oi || 0),
          previousOi: Number(data.pe.previous_oi || 0),
          iv: Number(data.pe.iv || 0),
          greeks: data.pe.greeks,
          bidPrice: Number(data.pe.top_bid_price || data.pe.bid || 0),
          askPrice: Number(data.pe.top_ask_price || data.pe.ask || 0)
        } : undefined;

        if (ce) totalCeOi += ce.oi;
        if (pe) totalPeOi += pe.oi;

        strikes.push({ strikePrice, ce, pe });
      }

      strikes.sort((a, b) => a.strikePrice - b.strikePrice);
      const pcrRatio = totalCeOi > 0 ? Number((totalPeOi / totalCeOi).toFixed(2)) : 0;

      return {
        underlying: raw.underlying || 'NIFTY',
        underlyingPrice: Number(raw.last_price || raw.spot_price || 0),
        expiry,
        strikes,
        totalCeOi,
        totalPeOi,
        pcrRatio,
        timestamp: new Date()
      };
    } catch (error) {
      return null;
    }
  }
}
