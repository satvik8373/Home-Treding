import axios from 'axios';
import { DHAN_CONFIG } from './config';
import { DhanCredentials, DhanFundLimits } from './types';
import { logger } from '../../utils/logger';

export interface DhanAuthResult {
  success: boolean;
  clientId: string;
  accountName: string;
  terminalActivated: boolean;
  error?: string;
}

export interface DhanTokenExchangeResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export class DhanAuthService {
  /**
   * Validate Dhan credentials by pinging fundlimit endpoint
   */
  public static async validateCredentials(credentials: DhanCredentials): Promise<DhanAuthResult> {
    const { clientId, accessToken } = credentials;

    if (!clientId || !accessToken) {
      return {
        success: false,
        clientId: clientId || '',
        accountName: '',
        terminalActivated: false,
        error: 'Client ID and Access Token are required'
      };
    }

    try {
      const response = await axios.get(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.FUND_LIMIT}`, {
        headers: {
          ...DHAN_CONFIG.DEFAULT_HEADERS,
          'access-token': accessToken,
          'client-id': clientId
        },
        timeout: DHAN_CONFIG.TIMEOUT_MS
      });

      if (response.status === 200) {
        return {
          success: true,
          clientId,
          accountName: `Dhan Account (${clientId})`,
          terminalActivated: true
        };
      }

      return {
        success: false,
        clientId,
        accountName: '',
        terminalActivated: false,
        error: 'Unexpected response from Dhan server'
      };
    } catch (error: any) {
      logger.error('[Dhan Auth Validation Failed]', error.response?.data || error.message);
      
      const status = error.response?.status;
      let errorMsg = 'Failed to connect to Dhan API';
      
      if (status === 401) {
        errorMsg = 'Invalid Dhan Access Token. Please generate a fresh token from Dhan Developer Portal.';
      } else if (status === 403) {
        errorMsg = 'Trading permissions inactive. Please activate trading terminal in the Dhan app.';
      } else if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
        errorMsg = 'Dhan server unreachable. Please check network connectivity.';
      }

      return {
        success: false,
        clientId,
        accountName: '',
        terminalActivated: false,
        error: errorMsg
      };
    }
  }

  /**
   * Generate Dhan Partner Consent Login URL (OAuth Flow)
   */
  public static generateConsentUrl(params: {
    consentId: string;
    redirectUri: string;
    state: string;
    clientId?: string;
  }): string {
    const { consentId, redirectUri, state, clientId } = params;
    
    let url = `${DHAN_CONFIG.PARTNER_LOGIN_URL}/?consentID=${encodeURIComponent(consentId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    if (clientId) {
      url += `&client_id=${encodeURIComponent(clientId)}`;
    }
    return url;
  }

  /**
   * Exchange OAuth authorization code for Access Token
   */
  public static async exchangeCodeForToken(params: {
    code: string;
    redirectUri: string;
    partnerClientId: string;
    partnerClientSecret: string;
  }): Promise<DhanTokenExchangeResult> {
    try {
      const response = await axios.post(`${DHAN_CONFIG.BASE_URL}${DHAN_CONFIG.ENDPOINTS.TOKEN_EXCHANGE}`, {
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: params.partnerClientId,
        client_secret: params.partnerClientSecret
      }, {
        headers: DHAN_CONFIG.DEFAULT_HEADERS,
        timeout: DHAN_CONFIG.TIMEOUT_MS
      });

      if (response.data?.access_token) {
        return {
          success: true,
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresIn: response.data.expires_in || 86400
        };
      }

      return {
        success: false,
        error: 'No access token received from Dhan OAuth endpoint'
      };
    } catch (error: any) {
      logger.error('[Dhan Token Exchange Error]', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error_description || error.response?.data?.remarks || error.message
      };
    }
  }

  // --- Official DhanHQ Developer API Key & Secret OAuth Flow ---
  // In-memory store for pending consent sessions (TTL 15 mins)
  private static pendingConsents = new Map<string, {
    clientId: string;
    apiKey: string;
    apiSecret: string;
    userId?: string;
    timestamp: number;
  }>();

  /**
   * Step 1: Generate Consent
   * POST https://auth.dhan.co/app/generate-consent?client_id={clientId}
   * Headers: app_id, app_secret
   */
  public static async generateConsent(params: {
    clientId: string;
    apiKey: string;
    apiSecret: string;
    userId?: string;
  }): Promise<{
    success: boolean;
    consentAppId?: string;
    loginUrl?: string;
    error?: string;
  }> {
    const { clientId, apiKey, apiSecret, userId } = params;

    if (!clientId || !apiKey || !apiSecret) {
      return {
        success: false,
        error: 'Broker ID (Client ID), API Key, and API Secret Key are all required'
      };
    }

    try {
      const url = `https://auth.dhan.co/app/generate-consent?client_id=${encodeURIComponent(clientId.trim())}`;
      const response = await axios.post(url, {}, {
        headers: {
          'app_id': apiKey.trim(),
          'app_secret': apiSecret.trim(),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const data = response.data;
      const consentAppId = data?.consentAppId;

      if (!consentAppId) {
        return {
          success: false,
          error: data?.remarks || data?.message || 'Failed to receive consent session from Dhan'
        };
      }

      // Store in pending consents map
      this.pendingConsents.set(consentAppId, {
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        userId,
        timestamp: Date.now()
      });

      // Also clean up stale sessions (> 15 mins)
      const now = Date.now();
      for (const [key, val] of this.pendingConsents.entries()) {
        if (now - val.timestamp > 15 * 60 * 1000) {
          this.pendingConsents.delete(key);
        }
      }

      const loginUrl = `https://auth.dhan.co/login/consentApp-login?consentAppId=${encodeURIComponent(consentAppId)}`;

      return {
        success: true,
        consentAppId,
        loginUrl
      };
    } catch (error: any) {
      logger.error('[Dhan Generate Consent Error]', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.remarks || error.response?.data?.message || error.message || 'Dhan consent generation failed'
      };
    }
  }

  /**
   * Step 3: Consume Consent
   * POST https://auth.dhan.co/app/consumeApp-consent?tokenId={tokenId}
   * Headers: app_id, app_secret
   */
  public static async consumeConsent(params: {
    tokenId: string;
    consentAppId?: string;
    clientId?: string;
    apiKey?: string;
    apiSecret?: string;
  }): Promise<{
    success: boolean;
    accessToken?: string;
    dhanClientId?: string;
    dhanClientName?: string;
    dhanClientUcc?: string;
    expiryTime?: string;
    error?: string;
  }> {
    const { tokenId, consentAppId } = params;

    let apiKey = params.apiKey;
    let apiSecret = params.apiSecret;
    let clientId = params.clientId;

    if (consentAppId && this.pendingConsents.has(consentAppId)) {
      const stored = this.pendingConsents.get(consentAppId)!;
      apiKey = apiKey || stored.apiKey;
      apiSecret = apiSecret || stored.apiSecret;
      clientId = clientId || stored.clientId;
    } else if (!apiKey || !apiSecret) {
      // Find the most recent active consent session
      const sessions = Array.from(this.pendingConsents.values()).sort((a, b) => b.timestamp - a.timestamp);
      if (sessions.length > 0 && (Date.now() - sessions[0].timestamp < 15 * 60 * 1000)) {
        apiKey = apiKey || sessions[0].apiKey;
        apiSecret = apiSecret || sessions[0].apiSecret;
        clientId = clientId || sessions[0].clientId;
      }
    }

    if (!tokenId || !apiKey || !apiSecret) {
      return {
        success: false,
        error: 'tokenId, API Key, and API Secret Key are required to consume consent'
      };
    }

    try {
      const url = `https://auth.dhan.co/app/consumeApp-consent?tokenId=${encodeURIComponent(tokenId.trim())}`;
      const response = await axios.post(url, {}, {
        headers: {
          'app_id': apiKey.trim(),
          'app_secret': apiSecret.trim(),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const data = response.data;
      if (data?.accessToken) {
        if (consentAppId) {
          this.pendingConsents.delete(consentAppId);
        }

        return {
          success: true,
          accessToken: data.accessToken,
          dhanClientId: data.dhanClientId || clientId,
          dhanClientName: data.dhanClientName,
          dhanClientUcc: data.dhanClientUcc,
          expiryTime: data.expiryTime
        };
      }

      return {
        success: false,
        error: data?.remarks || data?.message || 'Failed to obtain access token from Dhan'
      };
    } catch (error: any) {
      logger.error('[Dhan Consume Consent Error]', error.response?.data || error.message);
      const status = error.response?.status;
      let errorMsg = error.response?.data?.remarks || error.response?.data?.message || error.message || 'Failed to exchange token with Dhan';
      
      if (status === 401) {
        errorMsg = 'Dhan authorization rejected (401). This Token ID has either expired (single-use token expires in 60 seconds), or your API Key / Secret Key does not match the Dhan app. Please click "Back to Brokers" to start a fresh login or use your 24-hr Direct Access Token.';
      }

      return {
        success: false,
        error: errorMsg
      };
    }
  }
}

