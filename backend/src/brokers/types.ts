/**
 * Generic Broker Adapter Interface & Types
 * Provides a broker-agnostic contract for all trading and market operations.
 */

export type BrokerName = 'dhan' | 'zerodha' | 'upstox' | 'angelone' | 'fyers' | 'paper';

export type BrokerStatus = 'Connected' | 'Disconnected' | 'Expired' | 'Error';

export interface BrokerCredentials {
  clientId: string;
  accessToken: string;
  pin?: string;
  totpSecret?: string;
  apiKey?: string;
  apiSecret?: string;
  consentId?: string;
  environment?: 'production' | 'sandbox';
}

export interface BrokerAccountProfile {
  broker: BrokerName;
  clientId: string;
  maskedClientId: string;
  accountName: string;
  email?: string;
  mobile?: string;
  status: BrokerStatus;
  terminalActivated: boolean;
  connectedAt: Date;
  tokenExpiresAt?: Date;
  lastHeartbeat: Date;
}

export interface BrokerFunds {
  availableMargin: number;
  usedMargin: number;
  totalAccountBalance: number;
  collateralMargin: number;
  cashBalance: number;
  currency: string;
  timestamp: Date;
}

export interface BrokerPosition {
  positionId: string;
  symbol: string;
  exchange: 'NSE' | 'BSE' | 'NFO' | 'MCX';
  segment: 'EQ' | 'FNO' | 'CURR' | 'COMM';
  productType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO';
  quantity: number;
  buyQuantity: number;
  sellQuantity: number;
  buyAvgPrice: number;
  sellAvgPrice: number;
  netAvgPrice: number;
  ltp: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  crossCurrency?: boolean;
}

export interface BrokerHolding {
  symbol: string;
  exchange: string;
  isin: string;
  totalQuantity: number;
  collateralQuantity: number;
  t1Quantity: number;
  availableQuantity: number;
  avgCostPrice: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_MARKET';
export type ProductType = 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO';
export type OrderValidity = 'DAY' | 'IOC' | 'GTD';

export type OrderStatus = 
  | 'CREATED'
  | 'VALIDATING'
  | 'RISK_APPROVED'
  | 'SUBMITTED'
  | 'PENDING'
  | 'OPEN'
  | 'TRIGGER_PENDING'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED';

export interface OrderRequest {
  id?: string;
  correlationId?: string;
  brokerId?: string;
  symbol: string;
  securityId?: string;
  exchange: 'NSE' | 'BSE' | 'NFO' | 'MCX';
  side: OrderSide;
  orderType: OrderType;
  productType: ProductType;
  validity: OrderValidity;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  disclosedQuantity?: number;
  strategyId?: string;
  userId?: string;
  isPaper?: boolean;
}

export interface OrderResult {
  success: boolean;
  orderId: string;
  brokerOrderId?: string;
  status: OrderStatus;
  message?: string;
  rejectionReason?: string;
  filledQuantity?: number;
  averagePrice?: number;
  timestamp: Date;
}

export interface BrokerOrder {
  orderId: string;
  brokerOrderId: string;
  correlationId?: string;
  symbol: string;
  securityId?: string;
  exchange: string;
  side: OrderSide;
  orderType: OrderType;
  productType: ProductType;
  validity: OrderValidity;
  quantity: number;
  filledQuantity: number;
  pendingQuantity: number;
  price: number;
  triggerPrice?: number;
  averagePrice: number;
  status: OrderStatus;
  statusMessage?: string;
  orderTimestamp: Date;
  executionTimestamp?: Date;
  strategyId?: string;
}

export interface BrokerQuote {
  symbol: string;
  securityId?: string;
  exchange: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  oi?: number;
  bidPrice?: number;
  bidQty?: number;
  askPrice?: number;
  askQty?: number;
  timestamp: Date;
}

export interface HistoricalCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface HistoricalDataParams {
  symbol: string;
  securityId: string;
  exchange: string;
  interval: '1' | '5' | '15' | '25' | '60' | 'D';
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
}

export interface MarketTick {
  symbol: string;
  securityId: string;
  exchange: string;
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  timestamp: Date;
}
