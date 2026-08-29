import axios from 'axios';
import { API_CONFIG } from '../config/api';

interface MarketData {
  symbol: string;
  name?: string;
  price?: number;
  ltp: string;
  change: string;
  changePercent: string;
  volume: number;
  high: string;
  low: string;
  open: string;
  prevClose: string;
  timestamp: number | string;
  lastUpdate?: string;
}

interface MarketStatusInfo {
  isOpen: boolean;
  status: 'LIVE' | 'CLOSED' | 'WEEKEND' | 'PRE_OPEN';
  message: string;
  nextOpen?: string;
  istTime?: string;
}

interface MarketDataResponse {
  success: boolean;
  isMarketOpen?: boolean;
  marketStatus?: MarketStatusInfo;
  istTime?: string;
  data: MarketData[];
  stocks?: MarketData[];
  indices?: MarketData[];
  serverTime?: number;
  timestamp?: string;
}

class LiveMarketService {
  private pollingInterval: number = 3000; // 3 seconds default
  private intervalId: NodeJS.Timeout | null = null;
  private subscribers: Map<string, (data: MarketData[], status?: MarketStatusInfo) => void> = new Map();
  private lastData: MarketData[] = [];
  private lastMarketStatus: MarketStatusInfo = {
    isOpen: true,
    status: 'LIVE',
    message: 'Market is open'
  };
  private isPolling: boolean = false;
  private requestInProgress: boolean = false;

  /**
   * Start live market data polling
   * @param callback Function to call with updated data & status
   * @param interval Polling interval in milliseconds (default: 3000ms)
   */
  startPolling(callback: (data: MarketData[], status?: MarketStatusInfo) => void, interval: number = 3000): string {
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
    this.subscribers.set(subscriberId, callback);
    this.pollingInterval = interval;

    if (!this.isPolling) {
      this.isPolling = true;
      this.poll(); // Immediate first poll
      this.intervalId = setInterval(() => this.poll(), this.pollingInterval);
    }

    // Return last data immediately if available
    if (this.lastData.length > 0) {
      callback(this.lastData, this.lastMarketStatus);
    }

    return subscriberId;
  }

  /**
   * Stop polling for a specific subscriber
   */
  stopPolling(subscriberId: string): void {
    this.subscribers.delete(subscriberId);

    // Stop polling if no subscribers
    if (this.subscribers.size === 0 && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isPolling = false;
    }
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.subscribers.clear();
    this.isPolling = false;
  }

  /**
   * Fetch market data once
   */
  async fetchMarketData(): Promise<{ data: MarketData[]; status: MarketStatusInfo }> {
    try {
      const response = await axios.get<MarketDataResponse>(
        `${API_CONFIG.BASE_URL}/api/market/all`,
        {
          timeout: 10000,
          headers: {
            'Cache-Control': 'no-cache'
          }
        }
      );

      if (response.data.success && response.data.data) {
        if (response.data.marketStatus) {
          this.lastMarketStatus = response.data.marketStatus;
        }
        return {
          data: response.data.data,
          status: this.lastMarketStatus
        };
      }
      
      return { data: [], status: this.lastMarketStatus };
    } catch (error: any) {
      return { data: [], status: this.lastMarketStatus };
    }
  }

  /**
   * Fetch live data for specific symbols
   */
  async fetchLiveData(symbols: string[]): Promise<MarketData[]> {
    try {
      const response = await axios.get<MarketDataResponse>(
        `${API_CONFIG.BASE_URL}/api/market/live`,
        {
          params: { symbols: symbols.join(',') },
          timeout: 10000,
          headers: {
            'Cache-Control': 'no-cache'
          }
        }
      );

      if (response.data.success && response.data.data) {
        if (response.data.marketStatus) {
          this.lastMarketStatus = response.data.marketStatus;
        }
        return response.data.data;
      }
      
      return [];
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Internal polling function
   */
  private async poll(): Promise<void> {
    if (this.requestInProgress) {
      return;
    }

    this.requestInProgress = true;

    try {
      const result = await this.fetchMarketData();
      
      if (result.data.length > 0) {
        this.lastData = result.data;
        this.lastMarketStatus = result.status;
        
        this.subscribers.forEach(callback => {
          try {
            callback(result.data, result.status);
          } catch (error) {
            // Silent error handling
          }
        });
      }

      // If market is closed, automatically slow down polling interval to 30 seconds
      if (result.status && !result.status.isOpen && this.pollingInterval < 30000) {
        this.setPollingInterval(30000);
      } else if (result.status && result.status.isOpen && this.pollingInterval > 5000) {
        this.setPollingInterval(3000);
      }
    } catch (error) {
      // Silent error handling
    } finally {
      this.requestInProgress = false;
    }
  }

  /**
   * Get last received data
   */
  getLastData(): MarketData[] {
    return this.lastData;
  }

  /**
   * Get current market status
   */
  getMarketStatus(): MarketStatusInfo {
    return this.lastMarketStatus;
  }

  /**
   * Change polling interval
   */
  setPollingInterval(interval: number): void {
    if (this.pollingInterval === interval) return;
    this.pollingInterval = interval;
    
    // Restart polling with new interval if currently polling
    if (this.isPolling && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.poll(), this.pollingInterval);
    }
  }
}

// Export singleton instance
export const liveMarketService = new LiveMarketService();
export type { MarketData, MarketDataResponse, MarketStatusInfo };
