import type { Candle, Contract, Reason, Side } from "./model";
import type { StrategySettings } from './settings';

export interface BacktestDataset {
  version: 1;
  date: string;
  spotReferenceClose: number;
  contracts: Record<Side, Contract>;
  candles: Record<Side, Candle[]>;
  source: "broker" | "import";
  capturedAt: number;
  contractSource?: 'broker' | 'import' | 'session' | 'master-snapshot';
}
export interface BacktestOptions {
  strategySettings?: StrategySettings;
  slippagePoints: number;
  feePerOrder: number;
}
export interface BacktestFill {
  id: string;
  cycleId: string;
  at: number;
  side: Side;
  symbol: string;
  transaction: "BUY" | "SELL";
  quantity: number;
  price: number;
  reason: Reason;
  fee: number;
  grossPnl: number | null;
  timing?: 'next-open' | 'gap-open' | 'intrabar-unknown' | 'cutoff-open' | 'scheduled-open';
}
export interface BacktestCycle {
  id: string;
  date: string;
  side: Side;
  symbol: string;
  entryAt: number;
  entryPrice: number;
  exitAt: number | null;
  quantity: number;
  remaining: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
}
export interface EquityPoint {
  at: number;
  netPnl: number;
}
export interface BacktestDay {
  date: string;
  source: "broker" | "import";
  contractSource?: BacktestDataset['contractSource'];
  status: "complete" | "partial";
  asOf: number;
  atm: number;
  expiry: string;
  lotSize: number;
  reference: Record<Side, { close: number; upper: number; lower: number }>;
  fills: BacktestFill[];
  cycles: BacktestCycle[];
  equity: EquityPoint[];
  grossPnl: number;
  fees: number;
  netRealizedPnl: number;
  openPnl: number;
  markedNetPnl: number;
  maxDrawdown: number;
}
export interface BacktestReport {
  engine: string;
  options: BacktestOptions;
  startDate: string;
  endDate: string;
  generatedAt: number;
  days: BacktestDay[];
  skipped: { date: string; reason: string }[];
  summary: {
    sessions: number;
    completeSessions: number;
    partialSessions: number;
    closedTrades: number;
    openTrades: number;
    wins: number;
    losses: number;
    winRate: number | null;
    profitFactor: number | null;
    orderCount: number;
    grossPnl: number;
    fees: number;
    netRealizedPnl: number;
    openPnl: number;
    markedNetPnl: number;
    maxDrawdown: number;
  };
  equity: EquityPoint[];
  assumptions: string[];
}
export interface BacktestJob {
  id: string;
  startDate?: string;
  endDate?: string;
  status: "running" | "complete" | "blocked" | "failed";
  completed: number;
  total: number;
  message: string;
  result: BacktestReport | null;
}
export interface BacktestDate {
  date: string;
  source: "broker" | "import";
  capturedAt: number;
  complete: boolean;
}

export interface HistoricalDateResult {
  date: string;
  status: 'ready' | 'partial' | 'spot_only' | 'unavailable' | 'skipped';
  spotBars: number;
  ceBars: number;
  peBars: number;
  message: string;
  capturedAt: number;
  contractSource?: BacktestDataset['contractSource'];
}
export interface HistoricalFetchJob {
  id: string;
  startDate?: string;
  endDate?: string;
  status: 'running' | 'complete' | 'failed';
  completed: number;
  total: number;
  message: string;
  rows: HistoricalDateResult[];
}

