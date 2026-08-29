import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import { DhanHistoricalCandleResponse } from './types';
import { BrokerQuote, HistoricalCandle, HistoricalDataParams } from '../types';

export interface MarketDepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface FullMarketDepth {
  symbol: string;
  securityId: string;
  exchange: string;
  ltp: number;
  volume: number;
  buyDepth: MarketDepthLevel[];
  sellDepth: MarketDepthLevel[];
  totalBuyQty: number;
  totalSellQty: number;
  timestamp: Date;
}

import { isMarketOpen } from '../../utils/marketHours';

export class DhanMarketDataService {
  private client: DhanHttpClient;
  private quoteCache: Map<string, { quote: BrokerQuote; timestamp: number }> = new Map();
  private lastApiCallTime: number = 0;
  private readonly MIN_API_INTERVAL_MS = 1500; // Dhan 1 req/sec limit protection

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Fetch real-time market quote snapshot (with caching & rate limiting)
   */
  public async getQuote(symbol: string, securityId: string, exchange: string = 'NSE'): Promise<BrokerQuote> {
    const exchangeSegment = exchange === 'BSE' ? 'BSE_EQ' : exchange === 'NFO' ? 'NSE_FNO' : 'NSE_EQ';
    const cacheKey = `${exchangeSegment}_${securityId}`;
    const now = Date.now();
    const ttl = isMarketOpen() ? 3000 : 60000; // 3s live, 60s when market closed

    const cached = this.quoteCache.get(cacheKey);
    if (cached && (now - cached.timestamp < ttl || now - this.lastApiCallTime < this.MIN_API_INTERVAL_MS)) {
      return cached.quote;
    }

    try {
      this.lastApiCallTime = now;
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.MARKET_FEED, {
        [exchangeSegment]: [Number(securityId) || securityId]
      });

      const feed = response?.data?.[exchangeSegment]?.[securityId] || response?.[exchangeSegment]?.[securityId] || {};
      const ltp = Number(feed.last_price || feed.ltp || 0);
      const prevClose = Number(feed.ohlc?.close || feed.prev_close || ltp);
      const change = ltp - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const quote: BrokerQuote = {
        symbol: symbol,
        securityId: securityId,
        exchange: exchange,
        ltp: ltp,
        open: Number(feed.ohlc?.open || 0),
        high: Number(feed.ohlc?.high || 0),
        low: Number(feed.ohlc?.low || 0),
        close: Number(feed.ohlc?.close || 0),
        prevClose: prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: Number(feed.volume || 0),
        oi: Number(feed.oi || 0),
        timestamp: new Date()
      };

      if (ltp > 0) {
        this.quoteCache.set(cacheKey, { quote, timestamp: now });
      }

      return quote;
    } catch (error) {
      if (cached) return cached.quote;
      return {
        symbol,
        securityId,
        exchange,
        ltp: 0,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        prevClose: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Fetch multiple quotes in ONE single batch API request from Dhan
   */
  public async getBatchQuotes(
    instruments: Array<{ symbol: string; securityId: string; exchangeSegment: string; name?: string }>
  ): Promise<BrokerQuote[]> {
    const now = Date.now();
    const ttl = isMarketOpen() ? 3000 : 60000;

    // Check if all instruments are fresh in cache
    const allCached = instruments.every(inst => {
      const c = this.quoteCache.get(`${inst.exchangeSegment}_${inst.securityId}`);
      return c && (now - c.timestamp < ttl);
    });

    if (allCached) {
      return instruments.map(inst => this.quoteCache.get(`${inst.exchangeSegment}_${inst.securityId}`)!.quote);
    }

    // Rate-limit check: if last API call was very recent, return whatever cached quotes we have
    if (now - this.lastApiCallTime < this.MIN_API_INTERVAL_MS) {
      return instruments.map(inst => {
        const c = this.quoteCache.get(`${inst.exchangeSegment}_${inst.securityId}`);
        if (c) return c.quote;
        return {
          symbol: inst.symbol,
          securityId: inst.securityId,
          exchange: inst.exchangeSegment.startsWith('NSE') ? 'NSE' : 'BSE',
          ltp: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          prevClose: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          timestamp: new Date()
        };
      });
    }

    // Group instruments by exchangeSegment: e.g. { NSE_EQ: [2885, 11536], IDX_I: [13, 25] }
    const payload: { [segment: string]: number[] } = {};
    instruments.forEach(inst => {
      const seg = inst.exchangeSegment || 'NSE_EQ';
      if (!payload[seg]) payload[seg] = [];
      const numId = Number(inst.securityId);
      if (!isNaN(numId)) {
        payload[seg].push(numId);
      }
    });

    try {
      this.lastApiCallTime = now;
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.MARKET_FEED, payload);
      const feedData = response?.data || response || {};

      return instruments.map(inst => {
        const seg = inst.exchangeSegment || 'NSE_EQ';
        const feed = feedData?.[seg]?.[inst.securityId] || {};
        const ltp = Number(feed.last_price || feed.ltp || 0);
        const prevClose = Number(feed.ohlc?.close || feed.prev_close || ltp);
        const change = ltp - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        const quote: BrokerQuote = {
          symbol: inst.symbol,
          securityId: inst.securityId,
          exchange: seg.startsWith('NSE') ? 'NSE' : 'BSE',
          ltp: ltp,
          open: Number(feed.ohlc?.open || 0),
          high: Number(feed.ohlc?.high || 0),
          low: Number(feed.ohlc?.low || 0),
          close: Number(feed.ohlc?.close || 0),
          prevClose: prevClose,
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: Number(feed.volume || 0),
          oi: Number(feed.oi || 0),
          timestamp: new Date()
        };

        if (ltp > 0) {
          this.quoteCache.set(`${seg}_${inst.securityId}`, { quote, timestamp: now });
        }

        return quote;
      });
    } catch (error) {
      // Return cached quotes if available
      return instruments.map(inst => {
        const c = this.quoteCache.get(`${inst.exchangeSegment}_${inst.securityId}`);
        if (c) return c.quote;
        return {
          symbol: inst.symbol,
          securityId: inst.securityId,
          exchange: inst.exchangeSegment.startsWith('NSE') ? 'NSE' : 'BSE',
          ltp: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          prevClose: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          timestamp: new Date()
        };
      });
    }
  }

  /**
   * Fetch multiple quotes in batch from Dhan
   */
  public async getMultipleQuotes(instruments: { [exchangeSegment: string]: (string | number)[] }): Promise<any> {
    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.MARKET_FEED, instruments);
      return response?.data || response;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch 5/20-level market depth for an instrument
   */
  public async getMarketDepth(symbol: string, securityId: string, exchangeSegment: string = 'NSE_EQ'): Promise<FullMarketDepth | null> {
    try {
      const response = await this.client.post<any>(DHAN_CONFIG.ENDPOINTS.MARKET_FEED, {
        [exchangeSegment]: [Number(securityId) || securityId]
      });

      const feed = response?.data?.[exchangeSegment]?.[securityId] || response?.[exchangeSegment]?.[securityId] || {};
      const ltp = Number(feed.last_price || feed.ltp || 0);

      const buyDepth: MarketDepthLevel[] = [];
      const sellDepth: MarketDepthLevel[] = [];

      if (feed.depth?.buy && Array.isArray(feed.depth.buy)) {
        feed.depth.buy.forEach((item: any) => {
          buyDepth.push({
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 0),
            orders: Number(item.orders || 0)
          });
        });
      }

      if (feed.depth?.sell && Array.isArray(feed.depth.sell)) {
        feed.depth.sell.forEach((item: any) => {
          sellDepth.push({
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 0),
            orders: Number(item.orders || 0)
          });
        });
      }

      const totalBuyQty = buyDepth.reduce((sum, d) => sum + d.quantity, 0) || Number(feed.total_buy_quantity || 0);
      const totalSellQty = sellDepth.reduce((sum, d) => sum + d.quantity, 0) || Number(feed.total_sell_quantity || 0);

      return {
        symbol,
        securityId,
        exchange: exchangeSegment.startsWith('NSE') ? 'NSE' : 'BSE',
        ltp,
        volume: Number(feed.volume || 0),
        buyDepth,
        sellDepth,
        totalBuyQty,
        totalSellQty,
        timestamp: new Date()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch historical candles for backtesting or chart plotting
   */
  public async getHistoricalData(params: HistoricalDataParams): Promise<HistoricalCandle[]> {
    try {
      const payload = {
        securityId: params.securityId,
        exchangeSegment: params.exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ',
        instrument: 'EQUITY',
        expiryCode: 0,
        fromDate: params.fromDate,
        toDate: params.toDate
      };

      const endpoint = params.interval === 'D' 
        ? DHAN_CONFIG.ENDPOINTS.CHARTS_HISTORICAL 
        : DHAN_CONFIG.ENDPOINTS.CHARTS_INTRADAY;

      const response = await this.client.post<DhanHistoricalCandleResponse>(endpoint, payload);

      const candles: HistoricalCandle[] = [];
      if (response && response.open && Array.isArray(response.open)) {
        for (let i = 0; i < response.open.length; i++) {
          candles.push({
            timestamp: new Date(response.start_Time[i] * 1000),
            open: response.open[i],
            high: response.high[i],
            low: response.low[i],
            close: response.close[i],
            volume: response.volume[i]
          });
        }
      }

      return candles;
    } catch (error) {
      return [];
    }
  }
}
