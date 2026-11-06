import type { StrategySettings } from './settings.ts';
export type Side = "CE" | "PE";
export type Mode = "paper" | "live";
export type RunStatus =
  | "idle"
  | "armed"
  | "preparing"
  | "running"
  | "stopping"
  | "stopped"
  | "blocked";
export type Reason =
  | "BREAKOUT"
  | "TARGET_1"
  | "TARGET_2"
  | "LOWER_CLOSE"
  | "MANUAL_STOP"
  | "SESSION_END";
export interface Candle {
  start: number;
  end: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
export interface Contract {
  token: string;
  symbol: string;
  expiry: string;
  strike: number;
  lotSize: number;
  side: Side;
}
export interface Mark {
  token: string;
  price: number;
  receivedAt: number;
  exchangeAt?: number;
  source: "websocket" | "rest";
}
export interface Position {
  quantity: number;
  average: number;
  target1Remaining: number;
  entryQuantity: number;
}
export interface Leg {
  lastDecision?: { candle: Candle; evaluatedAt: number; signal: 'BREAKOUT' | 'LOWER_CLOSE' | null; explanation: string };
  contract: Contract;
  reference: Candle;
  upper: number;
  lower: number;
  position: Position | null;
  realized: number;
  entries: number;
  lastExitAt?: number;
  reentryReady?: boolean;
  lastCandleEnd: number;
  exitReason: Exclude<Reason, "BREAKOUT"> | null;
}
export interface OrderIntent {
  instrumentToken?: string;
  expiry?: string;
  id: string;
  tag: string;
  orderId?: string;
  side: Side;
  symbol: string;
  transaction: "BUY" | "SELL";
  quantity: number;
  reason: Reason;
  submittedAt: number;
  cancelRequested?: boolean;
}
export interface Fill {
  rejectionReason?: string;
  orderId: string;
  quantity: number;
  average: number;
  status: string;
}
export interface Trade {
  id: string;
  at: number;
  side: Side;
  symbol: string;
  transaction: "BUY" | "SELL";
  quantity: number;
  price: number;
  reason: Reason;
  orderId: string;
  mode: Mode;
  pnl: number | null;
}
export interface Activity {
  at: number;
  level: "info" | "error";
  message: string;
}
export interface OrderAudit {
  events?: { at: number; status: OrderAudit['status']; detail: string }[];
  id: string; tag: string; orderId?: string; side: Side; symbol: string; transaction: 'BUY' | 'SELL'; quantity: number;
  reason: Reason; submittedAt: number; updatedAt: number; mode: Mode;
  status: 'submitting' | 'acknowledged' | 'unknown' | 'rejected' | 'cancel-requested' | 'filled' | 'partial-terminal' | 'cancelled' | 'simulated';
  filled: number | null; average: number | null; detail: string;
}
export interface TradingSession {
  decisionAudit?: { side: Side; candle: Candle; evaluatedAt: number; signal: 'BREAKOUT' | 'LOWER_CLOSE' | null; explanation: string }[];
  settings?: StrategySettings;
  orderAudit?: OrderAudit[];
  id: string;
  date: string;
  mode: Mode;
  account: string;
  status: RunStatus;
  message: string;
  atm: number | null;
  expiry: string | null;
  legs: Partial<Record<Side, Leg>>;
  pending: OrderIntent | null;
  pnlVerified: boolean;
  trades: Trade[];
  activity: Activity[];
}
export interface BrokerStatus {
  connected: boolean;
  account: string | null;
  name: string | null;
  expiresAt: number | null;
  feed: "disconnected" | "connecting" | "connected";
  lastTickAt: number | null;
}
export interface AppState {
  runtime?: { kind: 'hosted-paper'; liveExecution: false; reason: string };
  savedSettings?: StrategySettings;
  csrf: string;
  serverTime: number;
  broker: BrokerStatus;
  session: TradingSession | null;
  marks: Record<string, Mark>;
  busy: boolean;
}
export type ChartSymbol = "NIFTY" | Side;
export interface MarketQuote {
  token: string;
  price: number;
  receivedAt: number;
  source: "rest" | "websocket";
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
}
export interface MarketChart {
  symbol: ChartSymbol;
  token: string;
  title: string;
  date: string;
  interval: "5m";
  candles: Candle[];
  quote: MarketQuote | null;
  historyUpdatedAt: number | null;
  serverTime: number;
  warning: string | null;
  historyLoading?: boolean;
  quoteLoading?: boolean;
  quoteAttemptAt?: number;
  preview?: boolean;
  contract?: Contract;
}
export const RULES = {
  multiplier: 0.0009,
  entryLots: 4,
  target1Lots: 2,
  target1: 20,
  target2: 40,
  referenceStart: "09:15",
  referenceEnd: "09:20",
  firstSignal: "09:25",
  cutoff: "15:10",
} as const;
