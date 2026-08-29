import { DhanHttpClient } from './client';
import { DHAN_CONFIG } from './config';
import { BrokerAccountProfile } from '../types';
import { maskIdentifier } from '../../security/encryption';

export class DhanProfileService {
  private client: DhanHttpClient;

  constructor(client: DhanHttpClient) {
    this.client = client;
  }

  public async getProfile(): Promise<BrokerAccountProfile> {
    const clientId = this.client.getClientId();
    
    // Validate connectivity by fetching fund limits or profile
    await this.client.get(DHAN_CONFIG.ENDPOINTS.FUND_LIMIT);

    return {
      broker: 'dhan',
      clientId: clientId,
      maskedClientId: maskIdentifier(clientId),
      accountName: `Dhan Trader (${maskIdentifier(clientId)})`,
      status: 'Connected',
      terminalActivated: true,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    };
  }
}
