/**
 * Market Data Service
 * Handles all live market quotes and market depth calls for Indian markets (NSE & NFO)
 */

import apiService from './apiService';

export interface MarketDepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface MarketDepthData {
  symbol: string;
  name: string;
  exchange: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  buyDepth: MarketDepthLevel[];
  sellDepth: MarketDepthLevel[];
  totalBuyQty: number;
  totalSellQty: number;
  timestamp: string;
  source: string;
}

export interface MarketData {
  symbol: string;
  name?: string;
  securityId?: string;
  exchange?: string;
  price: number;
  ltp?: string | number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  prevClose?: number;
  volume?: number;
  marketCap?: number;
  timestamp: string;
  source: string;
}

export interface MarketDashboard {
  marketStatus: {
    isOpen: boolean;
    status: string;
    message: string;
  };
  stocks: MarketData[];
  indices: MarketData[];
  timestamp: string;
  source: string;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

class MarketDataService {
  /**
   * Get all live market data for Indian equities and indices
   */
  async getAllMarketData(): Promise<{ success: boolean; data: MarketData[]; stocks: MarketData[]; indices: MarketData[] }> {
    return apiService.get('/api/market/all');
  }

  /**
   * Get full market depth (5/20 bids and asks) for an instrument
   */
  async getMarketDepth(symbol: string): Promise<{ success: boolean; depth: MarketDepthData }> {
    return apiService.get(`/api/market/depth/${encodeURIComponent(symbol)}`);
  }

  /**
   * Get Indian market symbols
   */
  getIndianSymbols(): string[] {
    return [
      'NIFTY 50',
      'BANKNIFTY', 
      'FINNIFTY',
      'MIDCPNIFTY',
      'RELIANCE',
      'TCS',
      'INFY',
      'HDFCBANK',
      'ICICIBANK',
      'SBIN',
      'BHARTIARTL',
      'ITC',
      'KOTAKBANK',
      'LT'
    ];
  }

  /**
   * Format price in INR
   */
  formatPrice(price: number): string {
    if (price === undefined || price === null || isNaN(price)) return '₹0.00';
    return `₹${price.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  /**
   * Format percentage change with color
   */
  formatChange(change: number, changePercent: number): { text: string; color: string } {
    const isPositive = change >= 0;
    const sign = isPositive ? '+' : '';
    const color = isPositive ? '#10b981' : '#ef4444';
    
    return {
      text: `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`,
      color
    };
  }

  /**
   * Search Indian instruments
   */
  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const allSymbols = this.getIndianSymbols();
    return allSymbols
      .filter(symbol => symbol.toLowerCase().includes(query.toLowerCase()))
      .map(symbol => ({
        symbol,
        name: symbol,
        exchange: 'NSE',
        type: symbol.includes('NIFTY') ? 'INDEX' : 'EQUITY'
      }));
  }
}

export default new MarketDataService();