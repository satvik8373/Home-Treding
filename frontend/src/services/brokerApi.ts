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

export const brokerApi = {
  // --- Broker Connections ---
  async getBrokers(userId?: string): Promise<BrokerSummary[]> {
    const res = await axios.get(`${getBaseUrl()}/api/brokers/list${userId ? `?userId=${userId}` : ''}`);
    return res.data.brokers || [];
  },

  async connectDhan(params: { clientId: string; accessToken: string; userId?: string }): Promise<any> {
    const res = await axios.post(`${getBaseUrl()}/api/brokers/connect`, {
      broker: 'dhan',
      ...params
    });
    return res.data;
  },

  async getDhanLoginUrl(clientId?: string): Promise<{ loginUrl: string; state: string }> {
    const res = await axios.post(`${getBaseUrl()}/api/brokers/dhan-login-url`, { clientId });
    return res.data;
  },

  async disconnectBroker(brokerId: string): Promise<boolean> {
    const res = await axios.delete(`${getBaseUrl()}/api/brokers/${brokerId}`);
    return res.data.success;
  },

  async getFunds(brokerId?: string): Promise<BrokerFunds | null> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/funds/${brokerId}` : `${getBaseUrl()}/api/brokers/funds`;
      const res = await axios.get(url);
      return res.data.funds;
    } catch {
      return null;
    }
  },

  async getPositions(brokerId?: string): Promise<BrokerPosition[]> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/positions/${brokerId}` : `${getBaseUrl()}/api/brokers/positions`;
      const res = await axios.get(url);
      return res.data.positions || [];
    } catch {
      return [];
    }
  },

  async getOrders(brokerId?: string): Promise<BrokerOrder[]> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/orders/${brokerId}` : `${getBaseUrl()}/api/brokers/orders`;
      const res = await axios.get(url);
      return res.data.orders || [];
    } catch {
      return [];
    }
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
    const res = await axios.post(`${getBaseUrl()}/api/paper/order`, order);
    return res.data;
  },

  async getPaperPortfolio(): Promise<PaperPortfolio> {
    const res = await axios.get(`${getBaseUrl()}/api/paper/portfolio`);
    return res.data.portfolio;
  },

  async getPaperPositions(): Promise<BrokerPosition[]> {
    const res = await axios.get(`${getBaseUrl()}/api/paper/positions`);
    return res.data.positions || [];
  },

  async getPaperOrders(): Promise<BrokerOrder[]> {
    const res = await axios.get(`${getBaseUrl()}/api/paper/orders`);
    return res.data.orders || [];
  },

  async resetPaperPortfolio(initialCapital: number = 100000): Promise<any> {
    const res = await axios.post(`${getBaseUrl()}/api/paper/reset`, { initialCapital });
    return res.data;
  },

  // --- Risk & Emergency Stop ---
  async getRiskStatus(): Promise<{ config: any; killSwitch: KillSwitchStatus }> {
    const res = await axios.get(`${getBaseUrl()}/api/risk/status`);
    return res.data;
  },

  async triggerEmergencyStop(reason?: string): Promise<KillSwitchStatus> {
    const res = await axios.post(`${getBaseUrl()}/api/risk/kill-switch/activate`, { reason });
    return res.data.killSwitch;
  },

  async resetEmergencyStop(): Promise<KillSwitchStatus> {
    const res = await axios.post(`${getBaseUrl()}/api/risk/kill-switch/reset`);
    return res.data.killSwitch;
  }
};
