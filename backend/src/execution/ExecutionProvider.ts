import { EventEmitter } from 'events';
import { OrderRequest, OrderResult, BrokerPosition, BrokerOrder, MarketTick } from '../brokers/types';
import { ExecutionMode, VirtualPortfolio } from './types';

export abstract class ExecutionProvider extends EventEmitter {
  public abstract readonly mode: ExecutionMode;

  public abstract executeOrder(order: OrderRequest): Promise<OrderResult>;
  public abstract cancelOrder(orderId: string): Promise<boolean>;
  public abstract getOrders(filter?: { status?: string; strategyId?: string }): Promise<BrokerOrder[]>;
  public abstract getPositions(): Promise<BrokerPosition[]>;
  public abstract getPortfolio(): Promise<VirtualPortfolio>;
  public abstract onMarketTick(tick: MarketTick): void;
}
