/**
 * Dhan API Integration Service
 * Handles all Dhan API calls for live trading
 */

const DHAN_API_BASE = 'https://api.dhan.co';
const BACKEND_API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface DhanConfig {
  accessToken: string;
  clientId: string;
}

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

interface OrderResponse {
  orderId: string;
  status: string;
  price: number;
  quantity: number;
}

class DhanAPIService {
  private config: DhanConfig | null = null;
  private priceListeners: ((price: number) => void)[] = [];
  private candleListeners: ((candle: CandleData) => void)[] = [];

  /**
   * Initialize Dhan API with credentials
   */
  async initialize(accessToken: string, clientId: string) {
    this.config = { accessToken, clientId };
    console.log('✅ Dhan API initialized');
  }

  /**
   * Get previous day's closing price
   */
  async getPreviousClose(symbol: string): Promise<number> {
    try {
      const response = await fetch(`${BACKEND_API}/market/previous-close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ symbol })
      });

      const data = await response.json();
      return data.previousClose;
    } catch (error) {
      console.error('Error fetching previous close:', error);
      throw error;
    }
  }

  /**
   * Get market opening price
   */
  async getOpeningPrice(symbol: string): Promise<number> {
    try {
      const response = await fetch(`${BACKEND_API}/market/opening-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ symbol })
      });

      const data = await response.json();
      return data.openingPrice;
    } catch (error) {
      console.error('Error fetching opening price:', error);
      throw error;
    }
  }

  /**
   * Get candle close price for specific time range
   */
  async getCandleClose(symbol: string, startTime: string, endTime: string): Promise<number> {
    try {
      const response = await fetch(`${BACKEND_API}/market/candle-close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ symbol, startTime, endTime })
      });

      const data = await response.json();
      return data.close;
    } catch (error) {
      console.error('Error fetching candle close:', error);
      throw error;
    }
  }

  /**
   * Subscribe to new candle updates
   */
  onNewCandle(callback: (candle: CandleData) => void) {
    this.candleListeners.push(callback);
    
    // Start WebSocket connection for real-time candles
    this.startCandleStream();
  }

  /**
   * Subscribe to price breakout events
   */
  onPriceBreak(callback: (price: number) => void) {
    this.priceListeners.push(callback);
    
    // Start WebSocket connection for real-time prices
    this.startPriceStream();
  }

  /**
   * Buy ATM option (Call or Put)
   */
  async buyATMOption(type: 'CALL' | 'PUT'): Promise<OrderResponse> {
    try {
      const response = await fetch(`${BACKEND_API}/orders/place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          transactionType: 'BUY',
          optionType: type,
          strikeType: 'ATM',
          quantity: 1,
          orderType: 'MARKET',
          productType: 'INTRADAY'
        })
      });

      const data = await response.json();
      console.log(`✅ ${type} option bought:`, data);
      return data;
    } catch (error) {
      console.error(`Error buying ${type} option:`, error);
      throw error;
    }
  }

  /**
   * Buy additional lots (averaging)
   */
  async buyMoreLots(type: 'CALL' | 'PUT', lots: number): Promise<OrderResponse> {
    try {
      const response = await fetch(`${BACKEND_API}/orders/place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          transactionType: 'BUY',
          optionType: type,
          strikeType: 'ATM',
          quantity: lots,
          orderType: 'MARKET',
          productType: 'INTRADAY'
        })
      });

      const data = await response.json();
      console.log(`✅ Added ${lots} more lot(s):`, data);
      return data;
    } catch (error) {
      console.error('Error buying more lots:', error);
      throw error;
    }
  }

  /**
   * Exit all positions for given option type
   */
  async exitAll(type: 'CALL' | 'PUT'): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_API}/orders/exit-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          optionType: type
        })
      });

      const data = await response.json();
      console.log(`✅ Exited all ${type} positions:`, data);
    } catch (error) {
      console.error('Error exiting positions:', error);
      throw error;
    }
  }

  /**
   * Get current index price
   */
  async getIndexPrice(symbol: string): Promise<number> {
    try {
      const response = await fetch(`${BACKEND_API}/market/current-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ symbol })
      });

      const data = await response.json();
      return data.price;
    } catch (error) {
      console.error('Error fetching index price:', error);
      throw error;
    }
  }

  /**
   * Get day high for symbol
   */
  async getDayHigh(symbol: string): Promise<number> {
    try {
      const response = await fetch(`${BACKEND_API}/market/day-high`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ symbol })
      });

      const data = await response.json();
      return data.dayHigh;
    } catch (error) {
      console.error('Error fetching day high:', error);
      throw error;
    }
  }

  /**
   * Get day low for symbol
   */
  async getDayLow(symbol: string): Promise<number> {
    try {
      const response = await fetch(`${BACKEND_API}/market/day-low`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ symbol })
      });

      const data = await response.json();
      return data.dayLow;
    } catch (error) {
      console.error('Error fetching day low:', error);
      throw error;
    }
  }

  /**
   * Get trigger candle high
   */
  getTriggerCandleHigh(): number {
    // This would be stored from the trigger candle
    return parseFloat(localStorage.getItem('triggerCandleHigh') || '0');
  }

  /**
   * Get trigger candle low
   */
  getTriggerCandleLow(): number {
    // This would be stored from the trigger candle
    return parseFloat(localStorage.getItem('triggerCandleLow') || '0');
  }

  /**
   * Subscribe to option price changes
   */
  onOptionPriceChange(callback: (price: number) => void) {
    this.priceListeners.push(callback);
    
    // Start WebSocket connection for real-time option prices
    this.startOptionPriceStream();
  }

  /**
   * Start WebSocket stream for candles
   */
  private startCandleStream() {
    // WebSocket implementation for real-time candles
    console.log('📊 Starting candle stream...');
    
    // Simulate candle updates (replace with actual WebSocket)
    setInterval(() => {
      const mockCandle: CandleData = {
        open: 45000,
        high: 45100,
        low: 44900,
        close: 45050,
        volume: 1000,
        timestamp: new Date().toISOString()
      };
      
      this.candleListeners.forEach(listener => listener(mockCandle));
    }, 5000); // Every 5 seconds
  }

  /**
   * Start WebSocket stream for prices
   */
  private startPriceStream() {
    console.log('💹 Starting price stream...');
    
    // Simulate price updates (replace with actual WebSocket)
    setInterval(() => {
      const mockPrice = 45000 + Math.random() * 200 - 100;
      this.priceListeners.forEach(listener => listener(mockPrice));
    }, 1000); // Every second
  }

  /**
   * Start WebSocket stream for option prices
   */
  private startOptionPriceStream() {
    console.log('📈 Starting option price stream...');
    
    // Simulate option price updates (replace with actual WebSocket)
    setInterval(() => {
      const mockOptionPrice = 100 + Math.random() * 50 - 25;
      this.priceListeners.forEach(listener => listener(mockOptionPrice));
    }, 1000); // Every second
  }
}

// Export singleton instance
export const dhanAPI = new DhanAPIService();
export default dhanAPI;
