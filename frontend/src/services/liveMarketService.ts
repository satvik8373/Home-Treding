import axios from 'axios';
import { API_CONFIG } from '../config/api';

interface MarketData {
  symbol: string;
  ltp: string;
  change: string;
  changePercent: string;
  volume: number;
  high: string;
  low: string;
  open: string;
  prevClose: string;
  timestamp: number;
  lastUpdate: string;
}

interface MarketDataResponse {
  success: boolean;
  data: MarketData[];
  serverTime: number;
  timestamp?: string;
}

class LiveMarketService {
  private pollingInterval: number = 250; // 250ms = 4 updates per second (ultra-fast)
  private intervalId: NodeJS.Timeout | null = null;
  private subscribers: Map<string, (data: MarketData[]) => void> = new Map();
  private lastData: MarketData[] = [];
  private isPolling: boolean = false;
  private requestInProgress: boolean = false;

  /**
   * Start live market data polling (Optimized for ultra-fast updates)
   * @param callback Function to call with updated data
   * @param interval Polling interval in milliseconds (default: 250ms for 4 updates/sec)
   */
  startPolling(callback: (data: MarketData[]) => void, interval: number = 250): string {
    const subscriberId = `sub_${Date.now()}_${Math.random()}`;
    this.subscribers.set(subscriberId, callback);
    this.pollingInterval = interval;

    if (!this.isPolling) {
      this.isPolling = true;
      this.poll(); // Immediate first poll
      this.intervalId = setInterval(() => this.poll(), this.pollingInterval);
    }

    // Return last data immediately if available
    if (this.lastData.length > 0) {
      callback(this.lastData);
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
   * Fetch market data once (Optimized for speed)
   */
  async fetchMarketData(): Promise<MarketData[]> {
    try {
      const response = await axios.get<MarketDataResponse>(
        `${API_CONFIG.BASE_URL}/api/market/all`,
        {
          timeout: 10000,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      return [];
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Fetch live data for specific symbols (faster)
   */
  async fetchLiveData(symbols: string[]): Promise<MarketData[]> {
    try {
      const response = await axios.get<MarketDataResponse>(
        `${API_CONFIG.BASE_URL}/api/market/live`,
        {
          params: { symbols: symbols.join(',') },
          timeout: 10000,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      return [];
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Internal polling function (Optimized to prevent overlapping requests)
   */
  private async poll(): Promise<void> {
    if (this.requestInProgress) {
      return;
    }

    this.requestInProgress = true;

    try {
      const data = await this.fetchMarketData();
      
      if (data.length > 0) {
        this.lastData = data;
        
        this.subscribers.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            // Silent error handling
          }
        });
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
   * Change polling interval
   */
  setPollingInterval(interval: number): void {
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
export type { MarketData, MarketDataResponse };
