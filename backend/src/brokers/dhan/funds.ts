import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import { DhanFundLimits } from './types';
import { BrokerFunds } from '../types';

export class DhanFundsService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  public async getFunds(): Promise<BrokerFunds> {
    const rawData = await this.client.get<any>(DHAN_CONFIG.ENDPOINTS.FUND_LIMIT);

    const available = Number(
      rawData.availabelBalance ?? 
      rawData.availableBalance ?? 
      rawData.withdrawableBalance ?? 
      rawData.sodLimit ?? 
      0
    );
    const utilized = Number(rawData.utilizedAmount ?? rawData.marginUtilized ?? 0);
    const collateral = Number(rawData.collateralAmount ?? 0);
    const sodLimit = Number(rawData.sodLimit ?? available);

    return {
      availableMargin: available,
      usedMargin: utilized,
      totalAccountBalance: available + utilized + collateral,
      collateralMargin: collateral,
      cashBalance: sodLimit,
      currency: 'INR',
      timestamp: new Date()
    };
  }
}
