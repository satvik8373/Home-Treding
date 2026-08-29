/**
 * Universal Strategy Schema
 * Standardized schema defining any trading strategy across Backtesting, Paper, and Live execution.
 */

export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'MCX';
export type InstrumentType = 'INDEX' | 'OPTION' | 'FUTURE' | 'EQUITY';
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '1d';
export type OptionType = 'CE' | 'PE' | 'BOTH';
export type StrikeSelection = 'ATM' | 'ITM1' | 'ITM2' | 'ITM3' | 'OTM1' | 'OTM2' | 'OTM3' | 'DYNAMIC';
export type ExpiryRule = 'NEAREST_WEEKLY' | 'NEXT_WEEKLY' | 'MONTHLY';
export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | 'CROSS_ABOVE' | 'CROSS_BELOW' | 'PERCENT_BREAKOUT' | 'TOUCH';
export type ActionType = 'BUY' | 'SELL' | 'EXIT' | 'EXIT_ALL' | 'MODIFY_SL' | 'TRAIL_SL';

export interface IndicatorConfig {
  id: string;
  type: 'EMA' | 'SMA' | 'RSI' | 'VWAP' | 'SUPERTREND' | 'ATR' | 'MACD' | 'BOLLINGER' | 'FIRST_CANDLE_CLOSE';
  params: { [key: string]: any };
}

export interface StrategyCondition {
  id: string;
  leftOperand: {
    type: 'PRICE' | 'INDICATOR' | 'LEVEL' | 'VALUE';
    field?: 'open' | 'high' | 'low' | 'close' | 'volume';
    indicatorId?: string;
    value?: number;
    offsetPercent?: number;
  };
  operator: ConditionOperator;
  rightOperand: {
    type: 'PRICE' | 'INDICATOR' | 'LEVEL' | 'VALUE';
    field?: 'open' | 'high' | 'low' | 'close' | 'volume';
    indicatorId?: string;
    value?: number;
    offsetPercent?: number;
  };
  logicalJoin?: 'AND' | 'OR';
}

export interface StrategyLeg {
  id: string;
  action: 'BUY' | 'SELL';
  instrumentType: InstrumentType;
  symbol: string;
  optionType?: OptionType;
  strike?: StrikeSelection | string;
  expiryRule?: ExpiryRule;
  quantity: number; // in lots or shares
  stopLossType?: 'percentage' | 'points' | 'none';
  stopLossValue?: number;
  targetType?: 'percentage' | 'points' | 'none';
  targetValue?: number;
  trailStopLoss?: {
    triggerPoints: number;
    trailPoints: number;
  };
}

export interface RiskManagementConfig {
  maxLossPerDay?: number;
  maxProfitPerDay?: number;
  maxTradesPerDay?: number;
  maxConcurrentPositions?: number;
  positionSizingMode?: 'LOT' | 'CAPITAL' | 'RISK_PERCENTAGE';
  allowSimultaneousCEAndPE?: boolean;
  duplicateSignalProtection?: boolean;
}

export interface ScheduleConfig {
  marketStart: string;    // '09:15'
  entryStartTime: string; // '09:20'
  entryEndTime: string;   // '15:10'
  squareOffTime: string;  // '15:15'
  tradingDays: string[];  // ['MON', 'TUE', 'WED', 'THU', 'FRI']
}

export interface UniversalStrategy {
  id: string;
  name: string;
  version: number;
  author: string;
  category: string;
  description: string;
  timeframe: Timeframe;
  symbols: string[];
  market: {
    exchange: Exchange;
    underlying: string;
    instrumentType: InstrumentType;
  };
  schedule: ScheduleConfig;
  indicators: IndicatorConfig[];
  entryConditions: StrategyCondition[];
  exitConditions: StrategyCondition[];
  legs: StrategyLeg[];
  risk: RiskManagementConfig;
  execution: {
    mode: 'BACKTEST' | 'PAPER' | 'LIVE';
    liveTradingEnabled: boolean;
    slippageModel: 'REALISTIC' | 'ZERO' | 'HIGH';
  };
  createdAt?: string;
  updatedAt?: string;
}
