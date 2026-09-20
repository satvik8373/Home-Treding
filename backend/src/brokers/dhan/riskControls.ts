/**
 * DhanHQ v2 Risk Controls & Security Service
 * Implements:
 * - Static IP Setup (GET /ip/getIP, POST /ip/setIP, PUT /ip/modifyIP)
 * - Trader's Control: Kill Switch (GET /killswitch, POST /killswitch)
 * - Trader's Control: P&L Based Exit (GET /pnlExit, POST /pnlExit, DELETE /pnlExit)
 * - EDIS CDSL Authorization (POST /edis/form, POST /edis/bulkform, GET /edis/tpin, GET /edis/inquire/{isin})
 * Reference: DhanHQ OpenAPI 3.0.1
 */

import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import {
  DhanUserIPRequest,
  DhanUserIPResponse,
  DhanGetIPDetailsResponse,
  DhanKillSwitchResponse,
  DhanPnlBasedExitRequest,
  DhanExitPnlResponse,
  DhanEdisFormRequest,
  DhanEdisBulkFormRequest,
  DhanEdisFormResponse,
  DhanEdisQtyStatusResponse
} from './types';
import { logger } from '../../utils/logger';

export class DhanRiskControlsService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  // ==========================================
  // 1. Static IP Setup
  // ==========================================

  /**
   * Get currently configured primary and secondary static IPs
   * GET /ip/getIP
   */
  public async getIP(): Promise<DhanGetIPDetailsResponse> {
    return await this.client.get<DhanGetIPDetailsResponse>(DHAN_CONFIG.ENDPOINTS.GET_IP);
  }

  /**
   * Set primary or secondary static IP for order placement
   * POST /ip/setIP
   */
  public async setIP(params: { ip: string; ipFlag: 'PRIMARY' | 'SECONDARY' }): Promise<DhanUserIPResponse> {
    const payload: DhanUserIPRequest = {
      dhanClientId: this.client.getClientId(),
      ip: params.ip,
      ipFlag: params.ipFlag
    };
    return await this.client.post<DhanUserIPResponse>(DHAN_CONFIG.ENDPOINTS.SET_IP, payload);
  }

  /**
   * Modify already set primary or secondary static IP
   * PUT /ip/modifyIP
   */
  public async modifyIP(params: { ip: string; ipFlag: 'PRIMARY' | 'SECONDARY' }): Promise<DhanUserIPResponse> {
    const payload: DhanUserIPRequest = {
      dhanClientId: this.client.getClientId(),
      ip: params.ip,
      ipFlag: params.ipFlag
    };
    return await this.client.put<DhanUserIPResponse>(DHAN_CONFIG.ENDPOINTS.MODIFY_IP, payload);
  }

  // ==========================================
  // 2. Kill Switch Management
  // ==========================================

  /**
   * Check kill switch status for the account
   * GET /killswitch
   */
  public async getKillSwitchStatus(): Promise<DhanKillSwitchResponse> {
    try {
      return await this.client.get<DhanKillSwitchResponse>(DHAN_CONFIG.ENDPOINTS.KILL_SWITCH);
    } catch (e: any) {
      return { dhanClientId: this.client.getClientId(), killSwitchStatus: 'DEACTIVATED' };
    }
  }

  /**
   * Control kill switch to disable/enable trading for the current day
   * POST /killswitch?killSwitchStatus=ACTIVATE|DEACTIVATE
   */
  public async manageKillSwitch(status: 'ACTIVATE' | 'DEACTIVATE'): Promise<DhanKillSwitchResponse> {
    return await this.client.post<DhanKillSwitchResponse>(
      `${DHAN_CONFIG.ENDPOINTS.KILL_SWITCH}?killSwitchStatus=${status}`,
      {}
    );
  }

  // ==========================================
  // 3. P&L Based Automatic Exit
  // ==========================================

  /**
   * Fetch currently active P&L based exit configuration
   * GET /pnlExit
   */
  public async getPnlExit(): Promise<DhanExitPnlResponse> {
    return await this.client.get<DhanExitPnlResponse>(DHAN_CONFIG.ENDPOINTS.PNL_EXIT);
  }

  /**
   * Configure automatic exit rules based on cumulative profit/loss limits
   * POST /pnlExit
   */
  public async setPnlExit(params: {
    profitValue: number;
    lossValue: number;
    enableKillSwitch?: boolean;
    productType?: ('INTRADAY' | 'DELIVERY')[];
  }): Promise<DhanExitPnlResponse> {
    const payload: DhanPnlBasedExitRequest = {
      dhanClientId: this.client.getClientId(),
      profitValue: params.profitValue,
      lossValue: params.lossValue,
      enableKillSwitch: params.enableKillSwitch ?? false,
      productType: params.productType || ['INTRADAY']
    };
    return await this.client.post<DhanExitPnlResponse>(DHAN_CONFIG.ENDPOINTS.PNL_EXIT, payload);
  }

  /**
   * Disable and stop active P&L based exit configuration
   * DELETE /pnlExit
   */
  public async stopPnlExit(): Promise<DhanUserIPResponse> {
    return await this.client.delete<DhanUserIPResponse>(DHAN_CONFIG.ENDPOINTS.PNL_EXIT);
  }

  // ==========================================
  // 4. EDIS CDSL Verification Flow
  // ==========================================

  /**
   * Generate EDIS CDSL approval form HTML
   * POST /edis/form
   */
  public async generateEdisForm(params: {
    isin: string;
    qty: number;
    exchange: 'NSE' | 'BSE' | 'MCX' | 'ALL';
    segment: 'EQ' | 'COMM' | 'FNO';
    bulk?: boolean;
  }): Promise<DhanEdisFormResponse> {
    const payload: DhanEdisFormRequest = {
      isin: params.isin,
      qty: params.qty,
      exchange: params.exchange,
      segment: params.segment,
      bulk: params.bulk ?? false
    };
    return await this.client.post<DhanEdisFormResponse>(DHAN_CONFIG.ENDPOINTS.EDIS_FORM, payload);
  }

  /**
   * Generate Bulk EDIS approval form HTML
   * POST /edis/bulkform
   */
  public async generateBulkEdisForm(params: {
    isin: string[];
    exchange: 'NSE' | 'BSE' | 'MCX' | 'ALL';
    segment: 'EQ' | 'COMM' | 'FNO';
  }): Promise<DhanEdisFormResponse> {
    const payload: DhanEdisBulkFormRequest = {
      isin: params.isin,
      exchange: params.exchange,
      segment: params.segment
    };
    return await this.client.post<DhanEdisFormResponse>(DHAN_CONFIG.ENDPOINTS.EDIS_BULK_FORM, payload);
  }

  /**
   * Request CDSL T-PIN on registered mobile
   * GET /edis/tpin
   */
  public async generateEdisTpin(): Promise<{ success: boolean; message: string }> {
    try {
      await this.client.get(DHAN_CONFIG.ENDPOINTS.EDIS_TPIN);
      return { success: true, message: 'CDSL T-PIN request submitted to registered mobile number' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to request CDSL T-PIN' };
    }
  }

  /**
   * Check EDIS authorization quantity status for ISIN
   * GET /edis/inquire/{isin}
   */
  public async inquireEdisQty(isin: string): Promise<DhanEdisQtyStatusResponse> {
    return await this.client.get<DhanEdisQtyStatusResponse>(DHAN_CONFIG.ENDPOINTS.EDIS_INQUIRE(isin));
  }
}
