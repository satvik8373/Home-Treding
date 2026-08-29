import axios from 'axios';
import { DHAN_CONFIG } from './config';
import { dhanRateLimiter } from './DhanRateLimiter';
import { instrumentMaster, DhanInstrumentRecord } from '../../services/InstrumentMasterService';
import { BrokerCredentials, BrokerFunds, BrokerPosition, OrderRequest, OrderResult } from '../types';
import { logger } from '../../utils/logger';

export interface SuperOrderRequest {
  securityId: string;
  exchangeSegment: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'LIMIT' | 'MARKET';
  price: number;
  targetPrice: number;
  stopLossPrice: number;
  trailingStopLoss?: number;
}

export interface ForeverOrderRequest {
  securityId: string;
  exchangeSegment: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'LIMIT' | 'MARKET';
  price: number;
  triggerPrice: number;
  orderFlag: 'SINGLE' | 'OCO';
  targetPrice?: number;
  stopLossPrice?: number;
}

export class DhanProvider {
  private clientId: string | null = null;
  private accessToken: string | null = null;
  private isConnected: boolean = false;

  constructor(clientId?: string, accessToken?: string) {
    if (clientId && accessToken) {
      this.clientId = clientId;
      this.accessToken = accessToken;
      this.isConnected = true;
    }
  }

  public setCredentials(credentials: BrokerCredentials): void {
    this.clientId = credentials.clientId;
    this.accessToken = credentials.accessToken;
    this.isConnected = Boolean(this.clientId && this.accessToken);
  }

  private getHeaders() {
    return {
      'access-token': this.accessToken || '',
      'client-id': this.clientId || '',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  // 1. Account & Profile
  public async getProfile(): Promise<any> {
    const res = await axios.get(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.PROFILE}`, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });
    return res.data;
  }

  public async getFunds(): Promise<BrokerFunds> {
    const res = await axios.get(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.FUND_LIMIT}`, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });

    const d = res.data?.data || res.data || {};
    return {
      availableMargin: Number(d.availMargin || d.availableMargin || 0),
      usedMargin: Number(d.utilizedMargin || d.usedMargin || 0),
      totalAccountBalance: Number(d.totalBalance || d.totalAccountBalance || 0),
      collateralMargin: Number(d.collateral || 0),
      cashBalance: Number(d.cashBalance || d.availMargin || 0),
      currency: 'INR',
      timestamp: new Date()
    };
  }

  // 2. Orders & Execution
  public async placeOrder(req: OrderRequest): Promise<OrderResult> {
    await dhanRateLimiter.acquireOrderSlot();

    const secId = req.securityId || (req.symbol ? instrumentMaster.resolveSecurityId(req.symbol) : '13');
    const payload = {
      dhanClientId: this.clientId,
      correlationId: req.correlationId || `HT_${Date.now()}`,
      transactionType: req.side,
      exchangeSegment: req.exchange === 'NSE' ? 'NSE_EQ' : req.exchange,
      productType: req.productType || 'INTRADAY',
      orderType: req.orderType,
      validity: req.validity || 'DAY',
      tradingSymbol: req.symbol,
      securityId: secId,
      quantity: req.quantity,
      price: req.price || 0,
      triggerPrice: req.triggerPrice || 0
    };

    const res = await axios.post(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.ORDERS}`, payload, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });

    const bId = res.data?.orderId || res.data?.data?.orderId || `ORD_${Date.now()}`;
    return {
      success: true,
      orderId: bId,
      brokerOrderId: bId,
      status: 'SUBMITTED',
      message: res.data?.orderStatus || 'Order placed with DhanHQ',
      timestamp: new Date()
    };
  }

  public async modifyOrder(orderId: string, updates: Partial<OrderRequest>): Promise<any> {
    await dhanRateLimiter.acquireOrderSlot();
    const res = await axios.put(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.MODIFY_ORDER(orderId)}`, updates, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });
    return res.data;
  }

  public async cancelOrder(orderId: string): Promise<any> {
    await dhanRateLimiter.acquireOrderSlot();
    const res = await axios.delete(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.CANCEL_ORDER(orderId)}`, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });
    return res.data;
  }

  public async getOrders(): Promise<any[]> {
    const res = await axios.get(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.ORDERS}`, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });
    return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
  }

  public async getPositions(): Promise<BrokerPosition[]> {
    const res = await axios.get(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.POSITIONS}`, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });

    const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
    return list.map((p: any) => ({
      positionId: p.positionId || `POS_${p.securityId || Date.now()}`,
      symbol: p.tradingSymbol || p.symbol || 'UNKNOWN',
      exchange: 'NSE',
      segment: 'FNO',
      productType: p.productType || 'INTRADAY',
      quantity: Number(p.netQty || p.quantity || 0),
      buyQuantity: Number(p.buyQty || 0),
      sellQuantity: Number(p.sellQty || 0),
      buyAvgPrice: Number(p.buyAvg || 0),
      sellAvgPrice: Number(p.sellAvg || 0),
      netAvgPrice: Number(p.netAvg || p.buyAvg || 0),
      ltp: Number(p.ltp || p.currentPrice || 0),
      realizedPnl: Number(p.realizedProfit || 0),
      unrealizedPnl: Number(p.unrealizedProfit || 0),
      totalPnl: Number(p.realizedProfit || p.unrealizedProfit || p.pnl || 0)
    }));
  }

  public async exitAllPositions(): Promise<any> {
    await dhanRateLimiter.acquireOrderSlot();
    const res = await axios.post(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.EXIT_ALL_POSITIONS}`, {}, {
      headers: this.getHeaders(),
      timeout: DHAN_CONFIG.TIMEOUT_MS
    });
    return res.data;
  }

  // 3. Market Data & Quotes
  public async getLTP(securityId: string, exchangeSegment: string = 'NSE_EQ'): Promise<number> {
    await dhanRateLimiter.acquireQuoteSlot();
    const res = await axios.post(
      `${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.MARKET_FEED_LTP}`,
      { [exchangeSegment]: [securityId] },
      { headers: this.getHeaders(), timeout: DHAN_CONFIG.TIMEOUT_MS }
    );
    const data = res.data?.data?.[exchangeSegment]?.[securityId] || res.data?.[exchangeSegment]?.[securityId] || {};
    return Number(data.last_price || data.ltp || 0);
  }

  // 4. Option Chain
  public async getOptionChain(securityId: string, expiry: string): Promise<any> {
    await dhanRateLimiter.checkOptionChainThrottle(`${securityId}_${expiry}`);
    const res = await axios.post(
      `${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.OPTION_CHAIN}`,
      { UnderLyingScrip: Number(securityId), Expiry: expiry },
      { headers: this.getHeaders(), timeout: DHAN_CONFIG.TIMEOUT_MS }
    );
    return res.data?.data || res.data;
  }

  // 5. Expired Options & Historical Intraday
  public async getHistoricalIntraday(securityId: string, interval: string = '5', fromDate: string, toDate: string): Promise<any> {
    await dhanRateLimiter.acquireDataSlot();
    const res = await axios.post(
      `${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.CHARTS_INTRADAY}`,
      { securityId, interval, fromDate, toDate },
      { headers: this.getHeaders(), timeout: DHAN_CONFIG.TIMEOUT_MS }
    );
    return res.data;
  }
}

export const dhanProvider = new DhanProvider();
