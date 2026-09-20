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

// --- DhanHQ OpenAPI 3.0.1 Full Schema Types ---

export interface DhanTradeResponse {
  dhanClientId: string;
  orderId: string;
  exchangeOrderId?: string;
  exchangeTradeId?: string;
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: string;
  productType: string;
  orderType: string;
  tradingSymbol?: string;
  customSymbol?: string;
  securityId: string;
  tradedQuantity: number;
  tradedPrice: number;
  createTime?: string;
  updateTime?: string;
  exchangeTime?: string;
  drvExpiryDate?: string;
  drvOptionType?: 'CALL' | 'PUT' | 'NA';
  drvStrikePrice?: number;
}

export interface DhanTradeHistoryResponseModel extends DhanTradeResponse {
  isin?: string;
  instrument?: string;
  sebiTax?: number;
  stt?: number;
  brokerageCharges?: number;
  serviceTax?: number;
  exchangeTransactionCharges?: number;
  stampDuty?: number;
}

export interface DhanPositionConversionRequest {
  dhanClientId?: string;
  fromProductType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'MTF' | 'CO' | 'BO';
  exchangeSegment: 'NSE_EQ' | 'NSE_FNO' | 'BSE_EQ' | 'BSE_FNO' | 'MCX_COMM';
  positionType: 'LONG' | 'SHORT' | 'CLOSED';
  securityId: string;
  convertQty: number;
  toProductType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'MTF' | 'CO' | 'BO';
}

export interface DhanUserIPRequest {
  dhanClientId?: string;
  ip: string;
  ipFlag: 'PRIMARY' | 'SECONDARY';
}

export interface DhanUserIPResponse {
  message?: string;
  status: 'SUCCESS' | 'ERROR';
}

export interface DhanGetIPDetailsResponse {
  modifyDatePrimary?: string;
  modifyDateSecondary?: string;
  primaryIP?: string;
  secondaryIP?: string;
  detectedIP?: string;
  ipMatchStatus: 'PRIMARY_MATCH' | 'SECONDARY_MATCH' | 'MISMATCH' | 'NOT_CONFIGURED';
  ordersAllowed: boolean;
}

export interface DhanPnlBasedExitRequest {
  dhanClientId?: string;
  profitValue?: number;
  lossValue?: number;
  enableKillSwitch?: boolean;
  productType?: ('INTRADAY' | 'DELIVERY')[];
}

export interface DhanExitPnlResponse {
  message?: string;
  pnlExitStatus: 'ACTIVE' | 'INACTIVE';
  profit?: number;
  loss?: number;
  enableKillSwitch?: boolean;
  productType?: string[];
}

export interface DhanKillSwitchResponse {
  dhanClientId?: string;
  killSwitchStatus: 'ACTIVATE' | 'DEACTIVATE' | string;
}

export interface DhanMultiOrderItemRequest {
  sequence: string;
  correlationId?: string;
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: 'NSE_EQ' | 'NSE_FNO' | 'NSE_COMM' | 'BSE_EQ' | 'BSE_FNO' | 'MCX_COMM';
  productType?: 'CNC' | 'INTRADAY' | 'MARGIN' | 'MTF';
  orderType?: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_MARKET';
  validity?: 'DAY' | 'IOC';
  securityId: string;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  disclosedQuantity?: number;
  afterMarketOrder?: boolean;
  amoTime?: 'OPEN' | 'OPEN_30' | 'OPEN_60' | 'PRE_OPEN';
}

export interface DhanMultiOrderRequest {
  dhanClientId: string;
  orders: DhanMultiOrderItemRequest[];
}

export interface DhanMultiOrderItemResponse {
  orderId: string;
  sequence: string;
  orderStatus: string;
}

export interface DhanMultiOrderResponse {
  orders: DhanMultiOrderItemResponse[];
}

export interface DhanTechnicalMetricsRequest {
  securityId: string;
  exchangeSegment: 'NSE_EQ' | 'IDX_I';
  instrument: 'INDEX' | 'EQUITY';
  timeframe: '1' | '5' | '15' | 'D';
  indicators: string[];
}

export interface DhanTechnicalMetricsResponse {
  securityId: string;
  timeframe: string;
  data: Record<string, any>;
}

export interface DhanNewsHeadlineRequest {
  dhanClientId?: string;
  categories: string[];
  limit: number;
  universe?: 'PORTFOLIO' | 'WATCHLIST';
  stockList?: string[];
}

export interface DhanNewsHeadlineResponse {
  data?: {
    latestNews?: Array<{
      newsObject?: {
        overallSentiment?: 'positive' | 'negative' | 'neutral';
        title?: string;
        text?: string;
      };
      category?: string;
      subCategory?: string;
      publishDate?: string;
      stockName?: string;
      isinCode?: string;
      smSymbol?: string;
      displaySymbol?: string;
    }>;
  };
}

export interface DhanTopInstrumentsRequest {
  exchangeSegment: 'NSE_FNO' | 'BSE_FNO' | 'NSE_COMM' | 'MCX_COMM' | 'NSE_EQ' | 'BSE_EQ';
  instrument: ('OPTIDX' | 'OPTSTK' | 'OPTFUT' | 'FUTIDX' | 'FUTSTK' | 'FUTCOM' | 'EQUITY')[];
  category: 'HIGHEST_OI' | 'OI_GAINERS' | 'OI_LOSERS' | 'TOP_VOLUME' | 'PRICE_GAINERS' | 'PRICE_LOSERS';
  expiry?: string;
  universe?: string;
  limit: number;
}

export interface DhanTopInstrumentsResponse {
  exchangeSegment: string;
  category: string;
  data: Array<{
    securityId: string;
    exchangeSegment: string;
    tradingSymbol: string;
    displayName?: string;
    instrument?: string;
    expiry?: string | null;
    ltp: number;
    change?: number;
    changePercent?: number;
    volume?: number;
    openInterest?: number;
  }>;
}

export interface DhanCompanyInfoRequest {
  securityId: string;
  exchangeSegment: 'NSE_EQ' | 'BSE_EQ';
  instrument: 'EQUITY';
  metrics: ('CO' | 'RATIOS' | 'SHP')[];
}

export interface DhanCompanyInfoResponse {
  securityId: string;
  data: Record<string, any>;
}

export interface DhanEdisFormRequest {
  isin: string;
  qty: number;
  exchange: 'NSE' | 'BSE' | 'MCX' | 'ALL';
  segment: 'EQ' | 'COMM' | 'FNO';
  bulk?: boolean;
}

export interface DhanEdisBulkFormRequest {
  isin: string[];
  exchange: 'NSE' | 'BSE' | 'MCX' | 'ALL';
  segment: 'EQ' | 'COMM' | 'FNO';
}

export interface DhanEdisFormResponse {
  dhanClientId: string;
  edisFormHtml: string;
}

export interface DhanEdisQtyStatusResponse {
  clientId: string;
  isin: string;
  totalQty: string;
  aprvdQty: string;
  status: string;
  remarks: string;
}

