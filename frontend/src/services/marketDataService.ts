/**
 * Market Data Service
 * Handles all market data API calls for Indian and Global markets
 */

import apiService from './apiService';

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  marketCap?: number;
  currency?: string;
  exchange?: string;
  timestamp: string;
  source: string;
}

export interface MarketDashboard {
  marketStatus: {
    isOpen: boolean;
    status: string;
    message: string;
    nextOpen?: string;
  };
  indianMarkets: MarketData[];
  globalMarkets: MarketData[];
  timestamp: string;
}

export interface IndicesData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface MarketStatus {
  isOpen: boolean;
  status: string;
  message: string;
  nextOpen?: string;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class MarketDataService {
  /**
   * Get live price for Indian market symbol (via Dhan API)
   */
  async getIndianPrice(symbol: string): Promise<MarketData> {
    return apiService.get(`/api/live-data/price/${symbol}`);
  }

  /**
   * Get live price for Indian market symbol (via NSE Unofficial API - Free)
   */
  async getNSEPrice(symbol: string): Promise<MarketData> {
    return apiService.get(`/api/live-data/nse/${symbol}`);
  }

  /**
   * Get live price for global market symbol (US Stocks, Crypto, Forex)
   */
  async getGlobalPrice(symbol: string): Promise<MarketData> {
    return apiService.get(`/api/live-data/global/${symbol}`);
  }

  /**
   * Get multiple Indian market prices at once
   */
  async getMultipleIndianPrices(symbols: string[]): Promise<MarketData[]> {
    const response = await apiService.post<{ data: MarketData[] }>('/api/live-data/prices', { symbols });
    return response.data;
  }

  /**
   * Get multiple global market prices at once
   */
  async getMultipleGlobalPrices(symbols: string[]): Promise<MarketData[]> {
    const response = await apiService.post<{ data: MarketData[] }>('/api/live-data/global/prices', { symbols });
    return response.data;
  }

  /**
   * Get OHLC data for charts
   */
  async getOHLCData(symbol: string, interval: string = '5'): Promise<OHLCData[]> {
    const response = await apiService.get<{ data: OHLCData[] }>(`/api/live-data/ohlc?symbol=${symbol}&interval=${interval}`);
    return response.data;
  }

  /**
   * Get comprehensive market dashboard
   */
  async getMarketDashboard(): Promise<MarketDashboard> {
    const response = await apiService.get<{ data: MarketDashboard }>('/api/live-data/dashboard');
    return response.data;
  }

  /**
   * Get popular Indian market symbols
   */
  getIndianSymbols(): string[] {
    return [
      'NIFTY 50',
      'BANKNIFTY', 
      'FINNIFTY',
      'MIDCPNIFTY',
      'SENSEX',
      'RELIANCE',
      'TCS',
      'INFY',
      'HDFC',
      'ICICIBANK',
      'SBIN',
      'BHARTIARTL',
      'ITC',
      'KOTAKBANK',
      'LT'
    ];
  }

  /**
   * Get popular global market symbols
   */
  getGlobalSymbols(): string[] {
    return [
      // US Stocks
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
      // Crypto
      'BTC-USD', 'ETH-USD', 'ADA-USD', 'SOL-USD', 'DOGE-USD',
      // Forex
      'EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDINR=X',
      // Commodities
      'GC=F', 'CL=F', 'SI=F'
    ];
  }

  /**
   * Format price with proper currency symbol
   */
  formatPrice(price: number, currency?: string): string {
    if (!price) return 'N/A';
    
    const currencySymbols: { [key: string]: string } = {
      'USD': '$',
      'INR': '₹',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥'
    };

    const symbol = currency ? currencySymbols[currency] || currency : '';
    return `${symbol}${price.toLocaleString()}`;
  }

  /**
   * Format percentage change with color
   */
  formatChange(change: number, changePercent: number): { text: string; color: string } {
    const isPositive = change >= 0;
    const sign = isPositive ? '+' : '';
    const color = isPositive ? '#10b981' : '#ef4444'; // green : red
    
    return {
      text: `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`,
      color
    };
  }

  /**
   * Get market status color
   */
  getMarketStatusColor(isOpen: boolean): string {
    return isOpen ? '#10b981' : '#6b7280'; // green : gray
  }

  /**
   * Get indices data (for compatibility)
   */
  async getIndicesData(): Promise<IndicesData[]> {
    const dashboard = await this.getMarketDashboard();
    return dashboard.indianMarkets.map(data => ({
      symbol: data.symbol,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      timestamp: data.timestamp
    }));
  }

  /**
   * Get market status (for compatibility)
   */
  async getMarketStatus(): Promise<MarketStatus> {
    const dashboard = await this.getMarketDashboard();
    return dashboard.marketStatus;
  }

  /**
   * Search symbols (placeholder implementation)
   */
  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    // This is a placeholder - in a real implementation, you'd call an API
    const allSymbols = [...this.getIndianSymbols(), ...this.getGlobalSymbols()];
    return allSymbols
      .filter(symbol => symbol.toLowerCase().includes(query.toLowerCase()))
      .map(symbol => ({
        symbol,
        name: symbol,
        exchange: symbol.includes('NIFTY') || symbol.includes('RELIANCE') ? 'NSE' : 'NASDAQ',
        type: 'EQUITY'
      }));
  }
}

export default new MarketDataService();