import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import { DhanPositionItem } from './types';
import { BrokerPosition } from '../types';

export class DhanPositionsService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  public async getPositions(): Promise<BrokerPosition[]> {
    const rawData = await this.client.get<DhanPositionItem[] | { data: DhanPositionItem[] }>(DHAN_CONFIG.ENDPOINTS.POSITIONS);
    
    let items: DhanPositionItem[] = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && Array.isArray((rawData as any).data)) {
      items = (rawData as any).data;
    }

    return items.map((pos) => {
      const netQty = Number(pos.netQty || 0);
      const buyQty = Number(pos.buyQty || pos.dayBuyQty || 0);
      const sellQty = Number(pos.sellQty || pos.daySellQty || 0);
      const buyAvg = Number(pos.buyAvg || 0);
      const sellAvg = Number(pos.sellAvg || 0);
      const costPrice = Number(pos.costPrice || (buyAvg || sellAvg));
      const realizedPnl = Number(pos.realizedProfit || 0);
      const unrealizedPnl = Number(pos.unrealizedProfit || 0);

      // Determine exchange and segment
      const segmentStr = pos.exchangeSegment || 'NSE_EQ';
      const exchange = segmentStr.startsWith('BSE') ? 'BSE' : segmentStr.startsWith('MCX') ? 'MCX' : 'NSE';
      const segment = segmentStr.includes('FNO') ? 'FNO' : segmentStr.includes('CURR') ? 'CURR' : 'EQ';

      return {
        positionId: `${pos.securityId}_${pos.productType}`,
        symbol: pos.tradingSymbol || pos.securityId,
        exchange: exchange as any,
        segment: segment as any,
        productType: (pos.productType as any) || 'INTRADAY',
        quantity: netQty,
        buyQuantity: buyQty,
        sellQuantity: sellQty,
        buyAvgPrice: buyAvg,
        sellAvgPrice: sellAvg,
        netAvgPrice: costPrice,
        ltp: costPrice, // Updated dynamically via market ticks
        realizedPnl: realizedPnl,
        unrealizedPnl: unrealizedPnl,
        totalPnl: realizedPnl + unrealizedPnl,
        crossCurrency: pos.crossCurrency
      };
    });
  }
}
