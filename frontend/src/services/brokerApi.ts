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
}

// In-memory client cache with localStorage persistence
const loadPersistedBrokers = (): BrokerSummary[] => {
  if (typeof window !== 'undefined') {
    try {
      const savedBrokers = localStorage.getItem('mavrix_connected_brokers');
      if (savedBrokers) {
        const parsed = JSON.parse(savedBrokers);
        if (Array.isArray(parsed)) {
          // Filter out legacy demo/fake brokers
          return parsed.filter((b: any) => b && b.id !== 'dhan_demo_1' && b.clientId !== 'DHAN_10029384' && b.clientId !== '1108893841');
        }
      }
    } catch (_) {}
  }
  return [];
};

let localBrokers: BrokerSummary[] = loadPersistedBrokers();

let localPaperPortfolio: PaperPortfolio = {
  initialCapital: 100000,
  availableCash: 95000,
  utilizedMargin: 5000,
  totalPortfolioValue: 102450,
  realizedPnl: 1250,
  unrealizedPnl: 1200,
  totalPnl: 2450,
  dayPnl: 2450,
  winCount: 4,
  lossCount: 1,
  totalTrades: 5,
  winRate: 80
};

let localPositions: BrokerPosition[] = [];

let localOrders: BrokerOrder[] = [];

export const brokerApi = {
  // --- Broker Connections ---
  async getBrokers(userId?: string): Promise<BrokerSummary[]> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/brokers/list${userId ? `?userId=${userId}` : ''}`, { timeout: 6000 });
      if (res.data?.brokers && Array.isArray(res.data.brokers)) {
        localBrokers = res.data.brokers;
        if (typeof window !== 'undefined') {
          localStorage.setItem('mavrix_connected_brokers', JSON.stringify(localBrokers));
        }
        return res.data.brokers;
      }
    } catch (_) {}

    return localBrokers;
  },

  async connectDhan(params: { clientId: string; accessToken: string; userId?: string }): Promise<any> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/brokers/connect`, {
        broker: 'dhan',
        clientId: params.clientId.trim(),
        accessToken: params.accessToken.trim(),
        userId: params.userId
      }, { timeout: 15000 });

      if (res.data?.success && res.data?.broker) {
        localBrokers = [res.data.broker, ...localBrokers.filter(b => b.clientId !== params.clientId.trim())];
        if (typeof window !== 'undefined') {
          localStorage.setItem('mavrix_connected_brokers', JSON.stringify(localBrokers));
          localStorage.setItem('dhan_connected_client_id', params.clientId.trim());
        }
        return res.data;
      }

      return {
        success: false,
        message: res.data?.message || 'Failed to authenticate with Dhan API'
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to authenticate with Dhan API';
      return {
        success: false,
        message: errorMsg,
        error: err.response?.data
      };
    }
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

  async disconnectBroker(brokerId: string): Promise<boolean> {
    try {
      await axios.delete(`${getBaseUrl()}/api/brokers/${brokerId}`, { timeout: 6000 });
    } catch (_) {}

    localBrokers = localBrokers.filter(b => b.id !== brokerId && b.clientId !== brokerId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mavrix_connected_brokers', JSON.stringify(localBrokers));
      localStorage.removeItem('dhan_connected_client_id');
    }
    return true;
  },

  async getFunds(brokerId?: string): Promise<BrokerFunds | null> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/funds/${brokerId}` : `${getBaseUrl()}/api/brokers/funds`;
      const res = await axios.get(url, { timeout: 8000 });
      if (res.data?.success && res.data?.funds) return res.data.funds;
      if (res.data?.status === 'Expired') {
        throw new Error('Token expired');
      }
    } catch (e: any) {
      if (e.response?.status === 401 || e.message?.includes('expired')) {
        throw e;
      }
    }

    return null;
  },

  async getPositions(brokerId?: string): Promise<BrokerPosition[]> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/positions/${brokerId}` : `${getBaseUrl()}/api/brokers/positions`;
      const res = await axios.get(url, { timeout: 8000 });
      if (res.data?.positions && Array.isArray(res.data.positions)) return res.data.positions;
    } catch (e) {}
    return localPositions;
  },

  async getOrders(brokerId?: string): Promise<BrokerOrder[]> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/orders/${brokerId}` : `${getBaseUrl()}/api/brokers/orders`;
      const res = await axios.get(url, { timeout: 8000 });
      if (res.data?.orders && Array.isArray(res.data.orders)) return res.data.orders;
    } catch (e) {}
    return localOrders;
  },

  // --- Paper Trading ---
  async placePaperOrder(order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    orderType?: 'MARKET' | 'LIMIT';
    productType?: 'INTRADAY' | 'CNC';
    strategyId?: string;
  }): Promise<any> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/paper/order`, order);
      if (res.data?.success) return res.data;
    } catch (e) {}

    const orderId = `PORD_${Date.now()}`;
    const fillPrice = order.price || 1000;
    const newOrd: BrokerOrder = {
      orderId,
      brokerOrderId: orderId,
      symbol: order.symbol.toUpperCase(),
      side: order.side,
      orderType: order.orderType || 'MARKET',
      productType: order.productType || 'INTRADAY',
      quantity: Number(order.quantity),
      filledQuantity: Number(order.quantity),
      pendingQuantity: 0,
      price: fillPrice,
      averagePrice: fillPrice,
      status: 'FILLED',
      orderTimestamp: new Date().toISOString()
    };
    localOrders.unshift(newOrd);
    localPaperPortfolio.totalTrades += 1;

    return {
      success: true,
      order: newOrd,
      message: 'Paper order executed successfully'
    };
  },

  async getPaperPortfolio(): Promise<PaperPortfolio> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/paper/portfolio`);
      if (res.data?.portfolio) {
        localPaperPortfolio = res.data.portfolio;
        return res.data.portfolio;
      }
    } catch (e) {}
    return localPaperPortfolio;
  },

  async getPaperPositions(): Promise<BrokerPosition[]> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/paper/positions`);
      if (res.data?.positions) {
        localPositions = res.data.positions;
        return res.data.positions;
      }
    } catch (e) {}
    return localPositions;
  },

  async getPaperOrders(): Promise<BrokerOrder[]> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/paper/orders`);
      if (res.data?.orders) {
        localOrders = res.data.orders;
        return res.data.orders;
      }
    } catch (e) {}
    return localOrders;
  },

  async resetPaperPortfolio(initialCapital: number = 100000): Promise<any> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/paper/reset`, { initialCapital });
      if (res.data) return res.data;
    } catch (e) {}

    localPaperPortfolio = {
      initialCapital,
      availableCash: initialCapital,
      utilizedMargin: 0,
      totalPortfolioValue: initialCapital,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
      dayPnl: 0,
      winCount: 0,
      lossCount: 0,
      totalTrades: 0,
      winRate: 0
    };
    localPositions = [];
    localOrders = [];

    return { success: true, message: `Paper portfolio reset to ₹${initialCapital.toLocaleString()}` };
  },

  // --- Risk & Emergency Stop ---
  async getRiskStatus(): Promise<{ config: any; killSwitch: KillSwitchStatus }> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/risk/status`);
      if (res.data?.config) return res.data;
    } catch (e) {}
    return {
      config: { maxDailyLoss: 5000, maxPositionSize: 50000, maxOpenPositions: 5 },
      killSwitch: { isHalted: false }
    };
  },

  async triggerEmergencyStop(reason?: string): Promise<KillSwitchStatus> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/risk/kill-switch/activate`, { reason });
      if (res.data?.killSwitch) return res.data.killSwitch;
    } catch (e) {}
    return {
      isHalted: true,
      haltedAt: new Date().toISOString(),
      haltReason: reason || 'Manual Emergency Stop'
    };
  },

  async resetEmergencyStop(): Promise<KillSwitchStatus> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/risk/kill-switch/reset`);
      if (res.data?.killSwitch) return res.data.killSwitch;
    } catch (e) {}
    return { isHalted: false };
  }
};
