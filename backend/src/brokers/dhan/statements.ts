/**
 * DhanHQ v2 Statements & Ledger Service
 * Retrieves complete ledger statements, vouchers, and cashflow details
 * Reference: https://dhanhq.co/docs/v2/statements/
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';

export interface LedgerEntry {
  narration: string;
  voucherdate: string;
  exchange: string;
  voucherdesc: string;
  vouchernumber: string;
  debit: number;
  credit: number;
  runbal: number;
}

export class DhanStatementsService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  /**
   * Fetch ledger transactions over a date range
   */
  public async getLedger(fromDate: string, toDate: string): Promise<LedgerEntry[]> {
    try {
      const response = await this.client.get<any>(`${DHAN_CONFIG.ENDPOINTS.LEDGER}?from-date=${fromDate}&to-date=${toDate}`);
      if (Array.isArray(response)) {
        return response;
      }
      return response?.data || [];
    } catch (error) {
      return [];
    }
  }
}
