/**
 * DhanHQ v2 Annexure Enums & Constant Maps
 * Reference: https://dhanhq.co/docs/v2/annexure/
 */

export enum ExchangeSegment {
  IDX_I = 'IDX_I',
  NSE_EQ = 'NSE_EQ',
  NSE_FNO = 'NSE_FNO',
  NSE_CURRENCY = 'NSE_CURRENCY',
  BSE_EQ = 'BSE_EQ',
  BSE_FNO = 'BSE_FNO',
  BSE_CURRENCY = 'BSE_CURRENCY',
  MCX_COMM = 'MCX_COMM'
}

export enum ProductType {
  CNC = 'CNC',
  INTRADAY = 'INTRADAY',
  MARGIN = 'MARGIN',
  MTF = 'MTF',
  CO = 'CO',
  BO = 'BO'
}

export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP_LOSS = 'STOP_LOSS',
  STOP_LOSS_MARKET = 'STOP_LOSS_MARKET'
}

export enum OrderStatus {
  TRANSIT = 'TRANSIT',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  TRADED = 'TRADED',
  EXPIRED = 'EXPIRED'
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum Validity {
  DAY = 'DAY',
  IOC = 'IOC'
}

export enum DrvOptionType {
  CALL = 'CALL',
  PUT = 'PUT'
}

export enum FeedRequestCode {
  TickerMode = 15,
  QuoteMode = 17,
  FullMode = 21,
  MarketDepth20 = 23,
  Unsubscribe = 16
}

export enum FeedResponseCode {
  LTP = 2,
  Quote = 4,
  Full = 8,
  Depth20 = 24
}

export enum ConditionalOperator {
  CROSSING_UP = 'CROSSING_UP',
  CROSSING_DOWN = 'CROSSING_DOWN',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  EQUAL = 'EQUAL'
}

export enum ConditionalIndicator {
  SMA = 'SMA',
  EMA = 'EMA',
  RSI = 'RSI',
  VWAP = 'VWAP',
  PRICE = 'PRICE'
}
