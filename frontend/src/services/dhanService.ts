import axios from 'axios';
import { API_CONFIG } from '../config/api';

const API_BASE = API_CONFIG.BASE_URL;
const DHAN_API_BASE = `${API_BASE}/api/dhan`;

export interface DhanCredentials {
  clientId: string;
  accessToken: string;
}

export interface DhanPosition {
  securityId: string;
  exchangeSegment: string;
  productType: string;
  buyAvg: number;
  buyQty: number;
  sellAvg: number;
  sellQty: number;
  netQty: number;
  realizedProfit: number;
  unrealizedProfit: number;
}

export interface DhanOrder {
  orderId: string;
  orderStatus: string;
  transactionType: string;
  exchangeSegment: string;
  productType: string;
  orderType: string;
  quantity: number;
  price: number;
  tradingSymbol: string;
}

class DhanService {
  private getHeaders(accessToken: string) {
    return {
      'access-token': accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  // Verify Dhan credentials
  async verifyCredentials(clientId: string, accessToken: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔍 Testing Dhan API connection via backend proxy...');
      console.log('📍 Backend API:', DHAN_API_BASE);
      console.log('👤 Client ID:', clientId);
      console.log('🔑 Access Token:', accessToken.substring(0, 10) + '...');
      
      const response = await axios.post(`${DHAN_API_BASE}/verify`, {
        clientId,
        accessToken
      }, {
        timeout: 20000
      });
      
      console.log('✅ Backend Response:', response.data);
      
      if (response.data.success) {
        return { success: true, message: response.data.message || 'Credentials verified successfully! ✅' };
      }
      return { success: false, message: response.data.message || 'Verification failed' };
    } catch (error: any) {
      console.error('❌ Verification failed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.code === 'ECONNABORTED') {
        return { success: false, message: '⏱️ Connection timeout. Please check your internet connection.' };
      }
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return { success: false, message: '🌐 Cannot connect to backend server. Make sure backend is running on port 5000.' };
      }
      
      const errorMsg = error.response?.data?.message || error.message;
      return { 
        success: false, 
        message: `❌ ${errorMsg || 'Failed to verify credentials. Please check your API settings.'}` 
      };
    }
  }

  // Get fund limits
  async getFundLimit(accessToken: string) {
    try {
      const response = await axios.post(`${DHAN_API_BASE}/fundlimit`, { accessToken });
      return response.data;
    } catch (error) {
      console.error('Failed to get fund limit:', error);
      throw error;
    }
  }

  // Get positions
  async getPositions(accessToken: string): Promise<DhanPosition[]> {
    try {
      const response = await axios.post(`${DHAN_API_BASE}/positions`, { accessToken });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to get positions:', error);
      throw error;
    }
  }

  // Get holdings
  async getHoldings(accessToken: string) {
    try {
      const response = await axios.post(`${DHAN_API_BASE}/holdings`, { accessToken });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to get holdings:', error);
      throw error;
    }
  }

  // Get orders
  async getOrders(accessToken: string): Promise<DhanOrder[]> {
    try {
      const response = await axios.post(`${DHAN_API_BASE}/orders`, { accessToken });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to get orders:', error);
      throw error;
    }
  }

  // Place order
  async placeOrder(accessToken: string, orderData: {
    dhanClientId: string;
    transactionType: 'BUY' | 'SELL';
    exchangeSegment: string;
    productType: string;
    orderType: string;
    validity: string;
    securityId: string;
    quantity: number;
    price?: number;
    triggerPrice?: number;
  }) {
    try {
      const response = await axios.post(
        `${DHAN_API_BASE}/v2/orders`,
        orderData,
        { headers: this.getHeaders(accessToken) }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  // Cancel order
  async cancelOrder(accessToken: string, orderId: string) {
    try {
      const response = await axios.delete(
        `${DHAN_API_BASE}/v2/orders/${orderId}`,
        { headers: this.getHeaders(accessToken) }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to cancel order:', error);
      throw error;
    }
  }

  // Get trade book
  async getTradeBook(accessToken: string) {
    try {
      const response = await axios.get(`${DHAN_API_BASE}/v2/tradebook`, {
        headers: this.getHeaders(accessToken)
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to get trade book:', error);
      throw error;
    }
  }
}

export default new DhanService();
