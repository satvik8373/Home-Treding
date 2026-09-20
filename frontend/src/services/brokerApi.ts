import axios from 'axios';
import { API_CONFIG } from '../config/api';

const getBaseUrl = () => API_CONFIG.BASE_URL;

export interface BrokerSummary {
  id: string;
  broker: string;
  clientId: string;
  maskedClientId: string;
  accountName: string;
  status: 'Connected' | 'Disconnected' | 'Expired';
  terminalEnabled: boolean;
  tradingEngineEnabled: boolean;
  staticIp?: string;
  secondaryIp?: string;
  connectedAt?: string;
  lastActivity?: string;
}

export interface BrokerFunds {
  availableMargin: number;
  usedMargin: number;
  totalAccountBalance: number;
  collateralMargin: number;
  cashBalance: number;
  currency: string;
  timestamp: string;
}

export interface BrokerPosition {
  positionId: string;
  symbol: string;
  exchange: string;
  segment: string;
  productType: string;
  quantity: number;
  buyQuantity: number;
  sellQuantity: number;
  buyAvgPrice: number;
  sellAvgPrice: number;
  netAvgPrice: number;
  ltp: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
}

export interface BrokerOrder {
  orderId: string;
  brokerOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  productType: string;
  quantity: number;
  filledQuantity: number;
  pendingQuantity: number;
  price: number;
  averagePrice: number;
  status: string;
  statusMessage?: string;
  orderTimestamp: string;
}

export interface PaperPortfolio {
  initialCapital: number;
  availableCash: number;
  utilizedMargin: number;
  totalPortfolioValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  dayPnl: number;
  winCount: number;
  lossCount: number;
  totalTrades: number;
  winRate: number;
}

export interface KillSwitchStatus {
  isHalted: boolean;
  haltedAt?: string;
  haltReason?: string;
  killSwitch?: {
    isHalted: boolean;
    haltedAt?: string;
    haltReason?: string;
  };
}

const createFreshPortfolio = (capital: number = 100000): PaperPortfolio => ({
  initialCapital: capital,
  availableCash: capital,
  utilizedMargin: 0,
  totalPortfolioValue: capital,
  realizedPnl: 0,
  unrealizedPnl: 0,
  totalPnl: 0,
  dayPnl: 0,
  winCount: 0,
  lossCount: 0,
  totalTrades: 0,
  winRate: 0
});

// User-scoped in-memory state
let localBrokers: BrokerSummary[] = [];
let localPaperPortfolio: PaperPortfolio = createFreshPortfolio(100000);
let localPositions: BrokerPosition[] = [];
let localOrders: BrokerOrder[] = [];

export const brokerApi = {
  // Clear in-memory client state on logout or account switch
  clearClientState() {
    localBrokers = [];
    localPaperPortfolio = createFreshPortfolio(100000);
    localPositions = [];
    localOrders = [];
  },

  // --- Broker Connections ---
  async getBrokers(userId?: string): Promise<BrokerSummary[]> {
    let effectiveUserId = userId;
    if (!effectiveUserId && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('mavrix_local_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.uid) effectiveUserId = parsed.uid;
        }
      } catch (_) {}
    }
    if (!effectiveUserId) effectiveUserId = 'user_admin';

    const urls = [
      `${getBaseUrl()}/api/brokers/list?userId=${encodeURIComponent(effectiveUserId)}`,
      `/api/brokers/list?userId=${encodeURIComponent(effectiveUserId)}`,
      `${getBaseUrl()}/api/brokers/list`,
      `/api/brokers/list`
    ];

    for (const url of Array.from(new Set(urls))) {
      try {
        const res = await axios.get(url, { timeout: 6000 });
        if (res.data?.brokers && Array.isArray(res.data.brokers)) {
          localBrokers = res.data.brokers;
          return res.data.brokers;
        }
      } catch (err: any) {
        if (err.response?.status !== 404) break;
      }
    }

    return localBrokers;
  },

  async connectDhan(params: { clientId: string; accessToken: string; userId?: string }): Promise<any> {
    const urlsToTry = Array.from(new Set([
      `${getBaseUrl()}/api/brokers/connect`,
      '/api/brokers/connect',
      `${getBaseUrl()}/api/broker/connect`,
      '/api/broker/connect'
    ]));

    let lastError: any = null;
    for (const url of urlsToTry) {
      try {
        const res = await axios.post(url, {
          broker: 'dhan',
          clientId: params.clientId.trim(),
          accessToken: params.accessToken.trim(),
          userId: params.userId
        }, { timeout: 15000 });

        if (res.data?.success && res.data?.broker) {
          localBrokers = [res.data.broker, ...localBrokers.filter(b => b.clientId !== params.clientId.trim())];
          return res.data;
        }

        if (res.data && res.data.success === false) {
          return res.data;
        }
      } catch (err: any) {
        lastError = err;
        if (err.response?.status === 401 || err.response?.status === 403) {
          return {
            success: false,
            message: err.response?.data?.message || 'Invalid Dhan Client ID or Access Token. Please verify your credentials in Dhan Developer Portal.',
            error: err.response?.data
          };
        }
        if (err.response?.status !== 404) {
          break;
        }
      }
    }

    const errorMsg = lastError?.response?.data?.message || lastError?.message || 'Failed to authenticate with Dhan API';
    return {
      success: false,
      message: errorMsg,
      error: lastError?.response?.data
    };
  },

  /**
   * Step 1 of Official Dhan Developer Flow
   */
  async generateDhanConsent(params: {
    clientId: string;
    apiKey: string;
    apiSecret: string;
    userId?: string;
  }): Promise<{ success: boolean; consentAppId?: string; loginUrl?: string; message?: string }> {
    const res = await axios.post(`${getBaseUrl()}/api/brokers/dhan/generate-consent`, params, { timeout: 12000 });
    return res.data;
  },

  /**
   * Step 3 of Official Dhan Developer Flow
   */
  async consumeDhanConsent(params: {
    tokenId: string;
    consentAppId?: string;
    clientId?: string;
    apiKey?: string;
    apiSecret?: string;
    userId?: string;
  }): Promise<{ success: boolean; broker?: BrokerSummary; message?: string }> {
    const res = await axios.post(`${getBaseUrl()}/api/brokers/dhan/consume-consent`, params, { timeout: 15000 });
    if (res.data?.success && res.data?.broker) {
      localBrokers = [res.data.broker, ...localBrokers.filter(b => b.clientId !== res.data.broker.clientId)];
    }
    return res.data;
  },

  async getDhanLoginUrl(clientId?: string): Promise<{ loginUrl: string; state: string }> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/brokers/dhan-login-url`, { clientId }, { timeout: 6000 });
      if (res.data?.loginUrl) return res.data;
    } catch (_) {}

    const state = `st_${Date.now()}`;
    return {
      loginUrl: `https://auth.dhan.co/login?clientId=${clientId || ''}&state=${state}`,
      state
    };
  },

  /**
   * DhanHQ v2 Static IP Management
   */
  async getStaticIP(brokerId?: string): Promise<{
    success: boolean;
    ipDetails?: {
      primaryIP?: string;
      secondaryIP?: string;
      detectedIP?: string;
      modifyDatePrimary?: string;
      modifyDateSecondary?: string;
      ipMatchStatus?: 'MATCH' | 'MISMATCH';
      ordersAllowed?: boolean;
    };
    message?: string;
  }> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/brokers/ip${brokerId ? `?brokerId=${brokerId}` : ''}`, { timeout: 8000 });
      return res.data;
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  },

  async updateStaticIP(params: {
    ip: string;
    ipFlag: 'PRIMARY' | 'SECONDARY';
    brokerId?: string;
    isModify?: boolean;
  }): Promise<{ success: boolean; message?: string; result?: any }> {
    const url = `${getBaseUrl()}/api/brokers/ip`;
    const method = params.isModify ? axios.put : axios.post;
    const res = await method(url, params, { timeout: 10000 });
    return res.data;
  },

  async squareOff(brokerId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/brokers/square-off`, { brokerId }, { timeout: 12000 });
      return res.data;
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || err.message || 'Square off failed' };
    }
  },

  async disconnectBroker(brokerId: string): Promise<boolean> {
    let effectiveUserId = '';
    try {
      const raw = localStorage.getItem('mavrix_local_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.uid) effectiveUserId = parsed.uid;
      }
    } catch (_) {}
    if (!effectiveUserId) effectiveUserId = 'user_admin';

    try {
      await axios.delete(
        `${getBaseUrl()}/api/brokers/${encodeURIComponent(brokerId)}?userId=${encodeURIComponent(effectiveUserId)}`,
        { timeout: 8000 }
      );
    } catch (e) {
      console.warn('Backend broker disconnect warning:', e);
    }

    // Clear any pending credentials from localStorage
    localStorage.removeItem('dhan_pending_client_id');
    localStorage.removeItem('dhan_pending_api_key');
    localStorage.removeItem('dhan_pending_api_secret');
    localStorage.removeItem('dhan_pending_consent_id');
    localStorage.removeItem('dhan_oauth_completed');

    localBrokers = [];
    return true;
  },

  async getFunds(brokerId?: string): Promise<BrokerFunds | null> {
    const urls = [
      brokerId ? `${getBaseUrl()}/api/brokers/funds/${brokerId}` : `${getBaseUrl()}/api/brokers/funds`,
      brokerId ? `/api/brokers/funds/${brokerId}` : `/api/brokers/funds`,
      brokerId ? `${getBaseUrl()}/api/broker/funds/${brokerId}` : `${getBaseUrl()}/api/broker/funds`
    ];

    for (const url of Array.from(new Set(urls))) {
      try {
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data?.success && res.data?.funds) return res.data.funds;
        if (res.data?.status === 'Expired') {
          throw new Error('Token expired');
        }
      } catch (e: any) {
        if (e.response?.status === 401 || e.message?.includes('expired')) {
          throw e;
        }
        if (e.response?.status !== 404) break;
      }
    }

    return null;
  },

  async getPositions(brokerId?: string): Promise<BrokerPosition[]> {
    const url = brokerId ? `${getBaseUrl()}/api/brokers/positions/${brokerId}` : `${getBaseUrl()}/api/brokers/positions`;
    try {
      const res = await axios.get(url, { timeout: 8000 });
      if (res.data?.success && res.data?.positions) return res.data.positions;
    } catch (_) {}
    return [];
  },

  async getOrders(brokerId?: string): Promise<BrokerOrder[]> {
    const url = brokerId ? `${getBaseUrl()}/api/brokers/orders/${brokerId}` : `${getBaseUrl()}/api/brokers/orders`;
    try {
      const res = await axios.get(url, { timeout: 8000 });
      if (res.data?.success && res.data?.orders) return res.data.orders;
    } catch (_) {}
    return [];
  },

  // --- Paper Trading Operations ---
  async placePaperOrder(order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    orderType?: string;
    productType?: string;
    strategyId?: string;
  }): Promise<any> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/paper/order`, order, { timeout: 8000 });
      if (res.data?.success) {
        return res.data;
      }
    } catch (e: any) {
      if (e.response?.data) return e.response.data;
      return { success: false, message: e.message || 'Order failed' };
    }

    return {
      success: false,
      message: 'Failed to place paper order'
    };
  },

  async getPaperPortfolio(): Promise<PaperPortfolio> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/paper/portfolio`, { timeout: 6000 });
      if (res.data?.portfolio) {
        localPaperPortfolio = res.data.portfolio;
        return res.data.portfolio;
      }
    } catch (_) {}
    return localPaperPortfolio;
  },

  async getPaperPositions(): Promise<BrokerPosition[]> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/paper/positions`, { timeout: 6000 });
      if (res.data?.positions) {
        localPositions = res.data.positions;
        return res.data.positions;
      }
    } catch (_) {}
    return localPositions;
  },

  async getPaperOrders(): Promise<BrokerOrder[]> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/paper/orders`, { timeout: 6000 });
      if (res.data?.orders) {
        localOrders = res.data.orders;
        return res.data.orders;
      }
    } catch (_) {}
    return localOrders;
  },

  async resetPaperPortfolio(initialCapital: number = 100000): Promise<any> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/paper/reset`, { initialCapital }, { timeout: 6000 });
      if (res.data?.success) {
        localPaperPortfolio = createFreshPortfolio(initialCapital);
        localPositions = [];
        localOrders = [];
        return res.data;
      }
    } catch (_) {}

    localPaperPortfolio = createFreshPortfolio(initialCapital);
    localPositions = [];
    localOrders = [];

    return {
      success: true,
      message: `Paper portfolio reset to ₹${initialCapital.toLocaleString()}`
    };
  },

  // --- Risk Engine & Kill Switch ---
  async getRiskStatus(): Promise<KillSwitchStatus> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/risk/status`, { timeout: 6000 });
      if (res.data) return res.data;
    } catch (_) {}
    return { isHalted: false };
  },

  async triggerEmergencyStop(reason: string = 'Manual kill-switch triggered'): Promise<any> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/risk/kill-switch/activate`, { reason }, { timeout: 6000 });
      return res.data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  async resetEmergencyStop(): Promise<any> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/risk/kill-switch/reset`, {}, { timeout: 6000 });
      return res.data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
};
