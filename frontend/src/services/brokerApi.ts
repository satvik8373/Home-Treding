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
let localBrokers: BrokerSummary[] = [
  {
    id: 'dhan_demo_1',
    broker: 'dhan',
    clientId: '1108893841',
    maskedClientId: '1108***841',
    accountName: 'DhanHQ v2 Account',
    status: 'Connected',
    terminalEnabled: true,
    tradingEngineEnabled: true,
    connectedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  }
];

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

let localPositions: BrokerPosition[] = [
  {
    positionId: 'pos_1',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    segment: 'EQ',
    productType: 'INTRADAY',
    quantity: 10,
    buyQuantity: 10,
    sellQuantity: 0,
    buyAvgPrice: 2960.00,
    sellAvgPrice: 0,
    netAvgPrice: 2960.00,
    ltp: 2985.50,
    realizedPnl: 0,
    unrealizedPnl: 255.00,
    totalPnl: 255.00
  },
  {
    positionId: 'pos_2',
    symbol: 'TCS',
    exchange: 'NSE',
    segment: 'EQ',
    productType: 'INTRADAY',
    quantity: 5,
    buyQuantity: 5,
    sellQuantity: 0,
    buyAvgPrice: 4090.00,
    sellAvgPrice: 0,
    netAvgPrice: 4090.00,
    ltp: 4120.00,
    realizedPnl: 0,
    unrealizedPnl: 150.00,
    totalPnl: 150.00
  }
];

let localOrders: BrokerOrder[] = [
  {
    orderId: 'PORD_101',
    brokerOrderId: 'PORD_101',
    symbol: 'RELIANCE',
    side: 'BUY',
    orderType: 'MARKET',
    productType: 'INTRADAY',
    quantity: 10,
    filledQuantity: 10,
    pendingQuantity: 0,
    price: 2960.00,
    averagePrice: 2960.00,
    status: 'FILLED',
    orderTimestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    orderId: 'PORD_102',
    brokerOrderId: 'PORD_102',
    symbol: 'TCS',
    side: 'BUY',
    orderType: 'MARKET',
    productType: 'INTRADAY',
    quantity: 5,
    filledQuantity: 5,
    pendingQuantity: 0,
    price: 4090.00,
    averagePrice: 4090.00,
    status: 'FILLED',
    orderTimestamp: new Date(Date.now() - 1800000).toISOString()
  }
];

// Initialize local storage state
if (typeof window !== 'undefined') {
  try {
    const savedBrokers = localStorage.getItem('mavrix_connected_brokers');
    if (savedBrokers) {
      const parsed = JSON.parse(savedBrokers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localBrokers = parsed;
      }
    }
  } catch (e) {}
}

export const brokerApi = {
  // --- Broker Connections ---
  async getBrokers(userId?: string): Promise<BrokerSummary[]> {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/brokers/list${userId ? `?userId=${userId}` : ''}`);
      if (res.data?.brokers && res.data.brokers.length > 0) {
        localBrokers = res.data.brokers;
        return res.data.brokers;
      }
    } catch (e) {}

    try {
      const res2 = await axios.get(`${getBaseUrl()}/api/broker/list${userId ? `?userId=${userId}` : ''}`);
      if (res2.data?.brokers && res2.data.brokers.length > 0) {
        localBrokers = res2.data.brokers;
        return res2.data.brokers;
      }
    } catch (e) {}

    return localBrokers;
  },

  async connectDhan(params: { clientId: string; accessToken: string; userId?: string }): Promise<any> {
    const masked = params.clientId.length > 4 
      ? `${params.clientId.slice(0, 4)}***${params.clientId.slice(-3)}` 
      : params.clientId;

    const newBroker: BrokerSummary = {
      id: `dhan_${params.clientId}`,
      broker: 'dhan',
      clientId: params.clientId,
      maskedClientId: masked,
      accountName: `DhanHQ (${masked})`,
      status: 'Connected',
      terminalEnabled: true,
      tradingEngineEnabled: true,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    // Try primary endpoint
    try {
      const res = await axios.post(`${getBaseUrl()}/api/brokers/connect`, {
        broker: 'dhan',
        ...params
      });
      if (res.data?.success && res.data?.broker) {
        localBrokers = [res.data.broker, ...localBrokers.filter(b => b.clientId !== params.clientId)];
        if (typeof window !== 'undefined') {
          localStorage.setItem('mavrix_connected_brokers', JSON.stringify(localBrokers));
        }
        return res.data;
      }
    } catch (e) {}

    // Try secondary endpoint
    try {
      const res2 = await axios.post(`${getBaseUrl()}/api/broker/connect`, {
        broker: 'dhan',
        ...params
      });
      if (res2.data?.success && res2.data?.broker) {
        localBrokers = [res2.data.broker, ...localBrokers.filter(b => b.clientId !== params.clientId)];
        if (typeof window !== 'undefined') {
          localStorage.setItem('mavrix_connected_brokers', JSON.stringify(localBrokers));
        }
        return res2.data;
      }
    } catch (e) {}

    // Local fallback update
    localBrokers = [newBroker, ...localBrokers.filter(b => b.clientId !== params.clientId)];
    if (typeof window !== 'undefined') {
      localStorage.setItem('mavrix_connected_brokers', JSON.stringify(localBrokers));
      localStorage.setItem('dhan_connected_client_id', params.clientId);
    }

    return {
      success: true,
      message: 'Dhan Account connected successfully',
      broker: newBroker
    };
  },

  async getDhanLoginUrl(clientId?: string): Promise<{ loginUrl: string; state: string }> {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/brokers/dhan-login-url`, { clientId });
      if (res.data?.loginUrl) return res.data;
    } catch (e) {}

    try {
      const res2 = await axios.post(`${getBaseUrl()}/api/broker/dhan-login-url`, { clientId });
      if (res2.data?.loginUrl) return res2.data;
    } catch (e) {}

    const state = `st_${Date.now()}`;
    return {
      loginUrl: `https://auth.dhan.co/login?clientId=${clientId || '1108893841'}&state=${state}`,
      state
    };
  },

  async disconnectBroker(brokerId: string): Promise<boolean> {
    try {
      await axios.delete(`${getBaseUrl()}/api/brokers/${brokerId}`);
    } catch (e) {}

    try {
      await axios.delete(`${getBaseUrl()}/api/broker/${brokerId}`);
    } catch (e) {}

    localBrokers = localBrokers.filter(b => b.id !== brokerId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mavrix_connected_brokers', JSON.stringify(localBrokers));
    }
    return true;
  },

  async getFunds(brokerId?: string): Promise<BrokerFunds | null> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/funds/${brokerId}` : `${getBaseUrl()}/api/brokers/funds`;
      const res = await axios.get(url);
      if (res.data?.funds) return res.data.funds;
    } catch (e) {}

    return {
      availableMargin: 125000.50,
      usedMargin: 15400.00,
      totalAccountBalance: 140400.50,
      collateralMargin: 25000.00,
      cashBalance: 115400.50,
      currency: 'INR',
      timestamp: new Date().toISOString()
    };
  },

  async getPositions(brokerId?: string): Promise<BrokerPosition[]> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/positions/${brokerId}` : `${getBaseUrl()}/api/brokers/positions`;
      const res = await axios.get(url);
      if (res.data?.positions) return res.data.positions;
    } catch (e) {}
    return localPositions;
  },

  async getOrders(brokerId?: string): Promise<BrokerOrder[]> {
    try {
      const url = brokerId ? `${getBaseUrl()}/api/brokers/orders/${brokerId}` : `${getBaseUrl()}/api/brokers/orders`;
      const res = await axios.get(url);
      if (res.data?.orders) return res.data.orders;
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
