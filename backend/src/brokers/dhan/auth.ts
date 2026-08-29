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
}
