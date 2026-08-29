import { EventEmitter } from 'events';
import {
  BrokerName,
  BrokerCredentials,
  BrokerAccountProfile,
  BrokerFunds,
  BrokerPosition,
  BrokerHolding,
  BrokerOrder,
  BrokerQuote,
  HistoricalCandle,
  HistoricalDataParams,
  OrderRequest,
  OrderResult
} from './types';

/**
 * Base Abstract Broker Adapter
 * Every broker integration (Dhan, Zerodha, Upstox) inherits from this contract.
 */
export abstract class BrokerAdapter extends EventEmitter {
  public abstract readonly name: BrokerName;
  protected isConnected: boolean = false;
  protected credentials: BrokerCredentials | null = null;
  protected profile: BrokerAccountProfile | null = null;

  /**
   * Connect and validate broker credentials
   */
  public abstract connect(credentials: BrokerCredentials): Promise<BrokerAccountProfile>;

  /**
   * Disconnect the broker session and teardown feeds
   */
  public abstract disconnect(): Promise<boolean>;

  /**
   * Fetch account profile and KYC details
   */
  public abstract getProfile(): Promise<BrokerAccountProfile>;

  /**
   * Fetch account margin and available funds
   */
  public abstract getFunds(): Promise<BrokerFunds>;

  /**
   * Fetch open & net positions
   */
  public abstract getPositions(): Promise<BrokerPosition[]>;

  /**
   * Fetch account holdings
   */
  public abstract getHoldings(): Promise<BrokerHolding[]>;

  /**
   * Fetch order book
   */
  public abstract getOrders(): Promise<BrokerOrder[]>;

  /**
   * Place an order with broker
   */
  public abstract placeOrder(order: OrderRequest): Promise<OrderResult>;

  /**
   * Modify an open order
   */
  public abstract modifyOrder(orderId: string, params: Partial<OrderRequest>): Promise<OrderResult>;

  /**
   * Cancel an open order
   */
  public abstract cancelOrder(orderId: string): Promise<boolean>;

  /**
   * Get real-time quote snapshot
   */
  public abstract getQuote(symbol: string, securityId: string, exchange: string): Promise<BrokerQuote>;

  /**
   * Fetch historical candles for backtesting or chart initialization
   */
  public abstract getHistoricalData(params: HistoricalDataParams): Promise<HistoricalCandle[]>;

  /**
   * Subscribe to real-time market data ticks
   */
  public abstract subscribeMarketData(symbols: string[]): Promise<void>;

  /**
   * Unsubscribe from market data ticks
   */
  public abstract unsubscribeMarketData(symbols: string[]): Promise<void>;

  /**
   * Returns current connection state
   */
  public getStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Returns active credentials
   */
  public getCredentials(): BrokerCredentials | null {
    return this.credentials;
  }

  /**
   * Returns cached profile
   */
  public getCachedProfile(): BrokerAccountProfile | null {
    return this.profile;
  }
}
