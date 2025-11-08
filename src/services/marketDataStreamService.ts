/**
 * Real-time Market Data WebSocket Service
 * Provides live streaming of market data for Indian and Global markets
 */

import { io, Socket } from 'socket.io-client';

export interface LiveMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: string;
  source: string;
}

export interface MarketDataStream {
  indianMarkets: LiveMarketData[];
  globalMarkets: LiveMarketData[];
  timestamp: string;
}

class MarketDataStreamService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event listeners
  private listeners: {
    [key: string]: ((data: any) => void)[];
  } = {};

  constructor() {
    this.connect();
  }

  private connect() {
    const serverUrl = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:5000';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to market data stream');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Disconnected from market data stream:', reason);
      this.isConnected = false;
      this.emit('disconnected', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error);
      this.isConnected = false;
      this.emit('error', error);
      this.handleReconnect();
    });

    // Market data events
    this.socket.on('market-data-update', (data: MarketDataStream) => {
      this.emit('marketDataUpdate', data);
    });

    this.socket.on('indian-market-update', (data: LiveMarketData) => {
      this.emit('indianMarketUpdate', data);
    });

    this.socket.on('global-market-update', (data: LiveMarketData) => {
      this.emit('globalMarketUpdate', data);
    });

    this.socket.on('price-alert', (data: { symbol: string; price: number; alert: string }) => {
      this.emit('priceAlert', data);
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  // Subscribe to market data updates
  subscribeToMarketData(callback: (data: MarketDataStream) => void) {
    this.on('marketDataUpdate', callback);
    
    // Request initial data
    if (this.isConnected) {
      this.socket?.emit('subscribe-market-data');
    }
  }

  // Subscribe to specific Indian market symbol
  subscribeToIndianSymbol(symbol: string, callback: (data: LiveMarketData) => void) {
    this.on('indianMarketUpdate', callback);
    
    if (this.isConnected) {
      this.socket?.emit('subscribe-indian-symbol', symbol);
    }
  }

  // Subscribe to specific global market symbol
  subscribeToGlobalSymbol(symbol: string, callback: (data: LiveMarketData) => void) {
    this.on('globalMarketUpdate', callback);
    
    if (this.isConnected) {
      this.socket?.emit('subscribe-global-symbol', symbol);
    }
  }

  // Set price alert
  setPriceAlert(symbol: string, targetPrice: number, condition: 'above' | 'below') {
    if (this.isConnected) {
      this.socket?.emit('set-price-alert', {
        symbol,
        targetPrice,
        condition
      });
    }
  }

  // Remove price alert
  removePriceAlert(symbol: string) {
    if (this.isConnected) {
      this.socket?.emit('remove-price-alert', symbol);
    }
  }

  // Generic event listener
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  // Remove event listener
  off(event: string, callback: (data: any) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  // Emit event to listeners
  private emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  // Manually reconnect
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.listeners = {};
  }

  // Get socket instance (for advanced usage)
  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const marketDataStreamService = new MarketDataStreamService();

export default marketDataStreamService;
