import { ExecutionProvider } from './ExecutionProvider';
import { ExecutionMode, VirtualPortfolio } from './types';
import { OrderRequest, OrderResult, BrokerPosition, BrokerOrder, MarketTick } from '../brokers/types';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { logger } from '../utils/logger';

export class LiveExecutor extends ExecutionProvider {
  public readonly mode: ExecutionMode = 'live';

  public async executeOrder(order: OrderRequest): Promise<OrderResult> {
    const isLiveTradingAllowed = process.env.LIVE_TRADING_ENABLED === 'true' && process.env.TRADING_MODE === 'live';

    if (!isLiveTradingAllowed) {
      const errorMsg = '🛡️ [SAFETY BLOCK] Live real-money trading is disabled on this server. Enable LIVE_TRADING_ENABLED=true and TRADING_MODE=live explicitly in server configuration.';
      logger.error(errorMsg);
      return {
        success: false,
        orderId: order.id || `live_block_${Date.now()}`,
        status: 'REJECTED',
        rejectionReason: errorMsg,
        timestamp: new Date()
      };
    }

    const adapter = brokerRegistry.getAdapter(order.userId || 'default', 'dhan');
    if (!adapter) {
      return {
        success: false,
        orderId: order.id || `err_${Date.now()}`,
        status: 'REJECTED',
        rejectionReason: 'No connected live broker adapter found.',
        timestamp: new Date()
      };
    }

    return await adapter.placeOrder(order);
  }

  public async cancelOrder(orderId: string): Promise<boolean> {
    const adapter = brokerRegistry.getAdapter('default', 'dhan');
    if (!adapter) return false;
    return await adapter.cancelOrder(orderId);
  }

  public async getOrders(filter?: { status?: string; strategyId?: string }): Promise<BrokerOrder[]> {
    const adapter = brokerRegistry.getAdapter('default', 'dhan');
    if (!adapter) return [];
    const orders = await adapter.getOrders();
    if (filter?.status) {
      return orders.filter(o => o.status === filter.status);
    }
    return orders;
  }

  public async getPositions(): Promise<BrokerPosition[]> {
    const adapter = brokerRegistry.getAdapter('default', 'dhan');
    if (!adapter) return [];
    return await adapter.getPositions();
  }

  public async getPortfolio(): Promise<VirtualPortfolio> {
    const adapter = brokerRegistry.getAdapter('default', 'dhan');
    if (!adapter) {
      return {
        initialCapital: 0,
        availableCash: 0,
        utilizedMargin: 0,
        totalPortfolioValue: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0,
        dayPnl: 0,
        winCount: 0,
        lossCount: 0,
        totalTrades: 0,
        winRate: 0
      };
    }

    const funds = await adapter.getFunds();
    const positions = await adapter.getPositions();
    const totalPnl = positions.reduce((sum, p) => sum + p.totalPnl, 0);

    return {
      initialCapital: funds.totalAccountBalance,
      availableCash: funds.availableMargin,
      utilizedMargin: funds.usedMargin,
      totalPortfolioValue: funds.totalAccountBalance + totalPnl,
      realizedPnl: positions.reduce((sum, p) => sum + p.realizedPnl, 0),
      unrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
      totalPnl: totalPnl,
      dayPnl: totalPnl,
      winCount: 0,
      lossCount: 0,
      totalTrades: positions.length,
      winRate: 0
    };
  }

  public onMarketTick(_tick: MarketTick): void {
    // Live executor receives position updates from broker reconciliation
  }
}

export const liveExecutor = new LiveExecutor();
