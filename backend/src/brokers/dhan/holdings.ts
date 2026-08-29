import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import { DhanHoldingItem } from './types';
import { BrokerHolding } from '../types';

export class DhanHoldingsService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  public async getHoldings(): Promise<BrokerHolding[]> {
    const rawData = await this.client.get<DhanHoldingItem[] | { data: DhanHoldingItem[] }>(DHAN_CONFIG.ENDPOINTS.HOLDINGS);
    
    let items: DhanHoldingItem[] = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && Array.isArray((rawData as any).data)) {
      items = (rawData as any).data;
    }

    return items.map((h) => {
      const totalQty = Number(h.totalQty || 0);
      const avgCost = Number(h.avgCostPrice || 0);
      const ltp = avgCost; // Baseline, updated via live market
      const currentValue = totalQty * ltp;
      const investedValue = totalQty * avgCost;
      const pnl = currentValue - investedValue;
      const pnlPercentage = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

      return {
        symbol: h.tradingSymbol || h.securityId,
        exchange: h.exchange || 'NSE',
        isin: h.isin || '',
        totalQuantity: totalQty,
        collateralQuantity: Number(h.collateralQty || 0),
        t1Quantity: Number(h.t1Qty || 0),
        availableQuantity: Number(h.availableQty || totalQty),
        avgCostPrice: avgCost,
        ltp: ltp,
        currentValue: currentValue,
        pnl: pnl,
        pnlPercentage: pnlPercentage
      };
    });
  }
}
