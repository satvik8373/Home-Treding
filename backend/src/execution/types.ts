import { OrderRequest, OrderResult, BrokerPosition, BrokerOrder, OrderStatus } from '../brokers/types';

export type ExecutionMode = 'paper' | 'sandbox' | 'live';

export interface VirtualPortfolio {
  initialCapital: number;
  availableCash: number;
  utilizedMargin: number;
  totalPortfolioValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  dayPnl: number;
  winCount: number;
  lossCount: number;
  totalTrades: number;
  winRate: number;
}

export interface PaperTradeRecord {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  realizedPnl?: number;
  strategyId?: string;
}

export interface ExecutionEvent {
  type: 'ORDER_CREATED' | 'ORDER_FILLED' | 'ORDER_REJECTED' | 'ORDER_CANCELLED' | 'POSITION_UPDATED' | 'PORTFOLIO_UPDATED';
  order?: BrokerOrder;
  position?: BrokerPosition;
  portfolio?: VirtualPortfolio;
  timestamp: Date;
}
