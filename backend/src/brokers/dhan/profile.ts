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
    
    const result = await this.client.get<any>(DHAN_CONFIG.ENDPOINTS.PROFILE);
    if (String(result?.dhanClientId) !== clientId) {
      throw new Error('Dhan Client ID does not match this access token.');
    }

    return {
      broker: 'dhan',
      clientId: clientId,
      maskedClientId: maskIdentifier(clientId),
      accountName: `Dhan Trader (${maskIdentifier(clientId)})`,
      status: 'Connected',
      terminalActivated: true,
      dataPlan: String(result.dataPlan || 'Unknown'),
      tokenValidity: result.tokenValidity,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    };
  }
}
