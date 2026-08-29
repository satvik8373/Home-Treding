import { BrokerAdapter } from '../BrokerAdapter';
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
} from '../types';
import { DhanHttpClient } from './client';
import { DhanAuthService } from './auth';
import { DhanProfileService } from './profile';
import { DhanFundsService } from './funds';
import { DhanPositionsService } from './positions';
import { DhanHoldingsService } from './holdings';
import { DhanOrdersService } from './orders';
import { DhanMarketDataService } from './marketData';
import { DhanWebSocketClient } from './websocket';
import { DhanSuperOrderService, SuperOrderRequest, SuperOrderResult } from './superOrders';
import { DhanForeverOrderService, ForeverOrderRequest, ForeverOrderResult } from './foreverOrders';
import { DhanConditionalTriggerService, ConditionalTriggerRequest, ConditionalTriggerResult } from './conditionalTriggers';
import { DhanOptionChainService, OptionChainResponse } from './optionChain';
import { DhanMarginCalculatorService, MarginOrderInput, MarginCalculationResult } from './marginCalculator';
import { DhanStatementsService, LedgerEntry } from './statements';
import { DhanOrderUpdateWsClient } from './orderUpdateWs';
import { DHAN_CONFIG } from './config';
import { logger } from '../../utils/logger';

export class DhanAdapter extends BrokerAdapter {
  public readonly name: BrokerName = 'dhan';

  private httpClient: DhanHttpClient | null = null;
  private profileService: DhanProfileService | null = null;
  private fundsService: DhanFundsService | null = null;
  private positionsService: DhanPositionsService | null = null;
  private holdingsService: DhanHoldingsService | null = null;
  private ordersService: DhanOrdersService | null = null;
  private marketDataService: DhanMarketDataService | null = null;
  private superOrderService: DhanSuperOrderService | null = null;
  private foreverOrderService: DhanForeverOrderService | null = null;
  private conditionalTriggerService: DhanConditionalTriggerService | null = null;
  private optionChainService: DhanOptionChainService | null = null;
  private marginCalculatorService: DhanMarginCalculatorService | null = null;
  private statementsService: DhanStatementsService | null = null;
  private wsClient: DhanWebSocketClient | null = null;
  private orderUpdateWs: DhanOrderUpdateWsClient | null = null;

  public async connect(credentials: BrokerCredentials): Promise<BrokerAccountProfile> {
    logger.info(`[DhanAdapter] Connecting Dhan client: ${credentials.clientId}`);

    // Step 1: Validate credentials with Dhan server
    const validation = await DhanAuthService.validateCredentials({
      clientId: credentials.clientId,
      accessToken: credentials.accessToken
    });

    if (!validation.success) {
      throw new Error(validation.error || 'Failed to authenticate with Dhan');
    }

    // Step 2: Initialize underlying service modules
    this.credentials = credentials;
    this.httpClient = new DhanHttpClient(credentials.clientId, credentials.accessToken);
    this.profileService = new DhanProfileService(this.httpClient);
    this.fundsService = new DhanFundsService(this.httpClient);
    this.positionsService = new DhanPositionsService(this.httpClient);
    this.holdingsService = new DhanHoldingsService(this.httpClient);
    this.ordersService = new DhanOrdersService(this.httpClient);
    this.marketDataService = new DhanMarketDataService(this.httpClient);
    this.superOrderService = new DhanSuperOrderService(this.httpClient);
    this.foreverOrderService = new DhanForeverOrderService(this.httpClient);
    this.conditionalTriggerService = new DhanConditionalTriggerService(this.httpClient);
    this.optionChainService = new DhanOptionChainService(this.httpClient);
    this.marginCalculatorService = new DhanMarginCalculatorService(this.httpClient);
    this.statementsService = new DhanStatementsService(this.httpClient);

    // Step 3: Fetch verified profile
    this.profile = await this.profileService.getProfile();
    this.isConnected = true;

    // Step 4: Setup Market Data WebSocket Feed
    this.wsClient = new DhanWebSocketClient(credentials.clientId, credentials.accessToken);
    this.wsClient.on('error', (err) => {
      logger.warn('[DhanAdapter] Market WebSocket feed notice:', err.message);
    });
    this.wsClient.on('tick', (tick) => {
      this.emit('tick', tick);
    });
    this.wsClient.on('connected', () => {
      this.emit('feedConnected');
    });
    this.wsClient.on('disconnected', (info) => {
      this.emit('feedDisconnected', info);
    });

    // Step 5: Setup Order Update WebSocket Feed
    this.orderUpdateWs = new DhanOrderUpdateWsClient(credentials.clientId, credentials.accessToken);
    this.orderUpdateWs.on('orderUpdate', (update) => {
      this.emit('orderUpdate', update);
    });
    this.orderUpdateWs.connect().catch((err) => {
      logger.warn('[DhanAdapter] Order update WS deferred:', err.message);
    });

    this.emit('connected', this.profile);
    logger.info(`✅ [DhanAdapter] Successfully connected to Dhan for account: ${this.profile.maskedClientId}`);

    return this.profile;
  }

  public async disconnect(): Promise<boolean> {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
    if (this.orderUpdateWs) {
      this.orderUpdateWs.disconnect();
      this.orderUpdateWs = null;
    }

    this.isConnected = false;
    this.credentials = null;
    this.profile = null;
    this.httpClient = null;

    this.emit('disconnected');
    logger.info('[DhanAdapter] Disconnected');
    return true;
  }

  public async getProfile(): Promise<BrokerAccountProfile> {
    this.ensureConnected();
    return await this.profileService!.getProfile();
  }

  public async getFunds(): Promise<BrokerFunds> {
    this.ensureConnected();
    return await this.fundsService!.getFunds();
  }

  public async getPositions(): Promise<BrokerPosition[]> {
    this.ensureConnected();
    return await this.positionsService!.getPositions();
  }

  public async getHoldings(): Promise<BrokerHolding[]> {
    this.ensureConnected();
    return await this.holdingsService!.getHoldings();
  }

  public async getOrders(): Promise<BrokerOrder[]> {
    this.ensureConnected();
    return await this.ordersService!.getOrders();
  }

  public async placeOrder(order: OrderRequest): Promise<OrderResult> {
    this.ensureConnected();
    return await this.ordersService!.placeOrder(order);
  }

  public async modifyOrder(orderId: string, params: Partial<OrderRequest>): Promise<OrderResult> {
    this.ensureConnected();
    return await this.ordersService!.modifyOrder(orderId, params);
  }

  public async cancelOrder(orderId: string): Promise<boolean> {
    this.ensureConnected();
    return await this.ordersService!.cancelOrder(orderId);
  }

  public async getQuote(symbol: string, securityId: string, exchange: string = 'NSE'): Promise<BrokerQuote> {
    this.ensureConnected();
    return await this.marketDataService!.getQuote(symbol, securityId, exchange);
  }

  public async getBatchQuotes(
    instruments: Array<{ symbol: string; securityId: string; exchangeSegment: string; name?: string }>
  ): Promise<BrokerQuote[]> {
    this.ensureConnected();
    return await this.marketDataService!.getBatchQuotes(instruments);
  }

  public async getHistoricalData(params: HistoricalDataParams): Promise<HistoricalCandle[]> {
    this.ensureConnected();
    return await this.marketDataService!.getHistoricalData(params);
  }

  // --- DhanHQ v2 Advanced Operations ---

  public async getOptionChain(underlyingSecurityId: string, expiry: string): Promise<OptionChainResponse | null> {
    this.ensureConnected();
    return await this.optionChainService!.getOptionChain({ underlyingSecurityId, expiry });
  }

  public async getExpiryList(underlyingSecurityId: string, exchangeSegment: string = 'NSE_FNO'): Promise<string[]> {
    this.ensureConnected();
    return await this.optionChainService!.getExpiryList(underlyingSecurityId, exchangeSegment);
  }

  public async placeSuperOrder(params: SuperOrderRequest): Promise<SuperOrderResult> {
    this.ensureConnected();
    return await this.superOrderService!.placeSuperOrder(params);
  }

  public async placeForeverOrder(params: ForeverOrderRequest): Promise<ForeverOrderResult> {
    this.ensureConnected();
    return await this.foreverOrderService!.placeForeverOrder(params);
  }

  public async placeConditionalTrigger(params: ConditionalTriggerRequest): Promise<ConditionalTriggerResult> {
    this.ensureConnected();
    return await this.conditionalTriggerService!.placeConditionalTrigger(params);
  }

  public async calculateMargin(order: MarginOrderInput): Promise<MarginCalculationResult> {
    this.ensureConnected();
    return await this.marginCalculatorService!.calculateMargin(order);
  }

  public async calculateMultiMargin(orders: MarginOrderInput[]): Promise<MarginCalculationResult> {
    this.ensureConnected();
    return await this.marginCalculatorService!.calculateMultiMargin(orders);
  }

  public async getLedger(fromDate: string, toDate: string): Promise<LedgerEntry[]> {
    this.ensureConnected();
    return await this.statementsService!.getLedger(fromDate, toDate);
  }

  public async activateKillSwitch(): Promise<boolean> {
    this.ensureConnected();
    try {
      await this.httpClient!.post(`${DHAN_CONFIG.ENDPOINTS.KILL_SWITCH}?killSwitchStatus=ACTIVATE`, {});
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getKillSwitchStatus(): Promise<any> {
    this.ensureConnected();
    try {
      return await this.httpClient!.get(DHAN_CONFIG.ENDPOINTS.KILL_SWITCH);
    } catch (e) {
      return { killSwitchStatus: 'DEACTIVATED' };
    }
  }

  public async subscribeMarketData(symbols: string[]): Promise<void> {
    if (this.wsClient) {
      this.wsClient.subscribe(symbols);
    }
  }

  public async unsubscribeMarketData(symbols: string[]): Promise<void> {
    if (this.wsClient) {
      this.wsClient.unsubscribe(symbols);
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected || !this.httpClient) {
      throw new Error('Dhan broker is not connected. Please connect your Dhan account first.');
    }
  }
}
