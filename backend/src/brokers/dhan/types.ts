/**
 * DhanHQ API v2 Types & Interfaces
 * Reference: https://dhanhq.co/docs/v2/
 */

export interface DhanCredentials {
  clientId: string;
  accessToken: string;
}

export interface DhanApiResponse<T = any> {
  status?: string;
  remarks?: string;
  data?: T;
  errorCode?: string;
  httpStatus?: string;
  internalErrorMessage?: string;
}

export interface DhanFundLimits {
  dhanClientId: string;
  availabelBalance: number; // Note: Dhan API spelling
  sodLimit: number;
  collateralAmount: number;
  receiveableAmount: number;
  utilizedAmount: number;
  blockedPayoutAmount: number;
  withdrawableBalance: number;
}

export interface DhanPositionItem {
  dhanClientId: string;
  tradingSymbol: string;
  securityId: string;
  positionType: 'LONG' | 'SHORT' | 'CLOSED';
  exchangeSegment: string;
  productType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'MTF' | 'CO' | 'BO';
  buyQty: number;
  costPrice: number;
  buyAvg: number;
  sellQty: number;
  sellAvg: number;
  netQty: number;
  realizedProfit: number;
  unrealizedProfit: number;
  rbiReferenceRate?: number;
  multiplier?: number;
  carryForwardBuyQty?: number;
  carryForwardSellQty?: number;
  carryForwardBuyValue?: number;
  carryForwardSellValue?: number;
  dayBuyQty?: number;
  daySellQty?: number;
  dayBuyValue?: number;
  daySellValue?: number;
  drvExpiryDate?: string;
  drvOptionType?: string;
  drvStrikePrice?: number;
  crossCurrency?: boolean;
}

export interface DhanOrderRequest {
  dhanClientId: string;
  correlationId?: string;
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: 'NSE_EQ' | 'NSE_FNO' | 'NSE_CURRENCY' | 'BSE_EQ' | 'BSE_FNO' | 'BSE_CURRENCY' | 'MCX_COMM';
  productType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'MTF' | 'CO' | 'BO';
  orderType: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_MARKET';
  validity: 'DAY' | 'IOC';
  securityId: string;
  quantity: number;
  disclosedQuantity?: number;
  price?: number;
  triggerPrice?: number;
  afterMarketOrder?: boolean;
  amoTime?: 'OPEN' | 'OPEN_30' | 'OPEN_60';
  boProfitValue?: number;
  boStopLossValue?: number;
  drvExpiryDate?: string;
  drvOptionType?: 'CALL' | 'PUT';
  drvStrikePrice?: number;
}

export interface DhanOrderResponse {
  orderId: string;
  orderStatus: string;
}

export interface DhanOrderBookItem {
  dhanClientId: string;
  orderId: string;
  correlationId?: string;
  orderStatus: 'TRANSIT' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'TRADED' | 'EXPIRED';
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: string;
  productType: string;
  orderType: string;
  validity: string;
  tradingSymbol: string;
  securityId: string;
  quantity: number;
  disclosedQuantity: number;
  price: number;
  triggerPrice: number;
  afterMarketOrder: boolean;
  boProfitValue: number;
  boStopLossValue: number;
  legName: string;
  createTime: string;
  updateTime: string;
  exchangeTime: string;
  drvExpiryDate: string;
  drvOptionType: string;
  drvStrikePrice: number;
  omsErrorCode?: string;
  omsErrorDescription?: string;
  filledQty: number;
  averageTradedPrice?: number;
}

export interface DhanHoldingItem {
  exchange: string;
  tradingSymbol: string;
  securityId: string;
  isin: string;
  totalQty: number;
  dpQty: number;
  t1Qty: number;
  availableQty: number;
  collateralQty: number;
  avgCostPrice: number;
}

export interface DhanHistoricalCandleResponse {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  start_Time: number[];
}
