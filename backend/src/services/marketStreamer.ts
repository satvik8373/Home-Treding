import { Server as SocketIOServer } from 'socket.io';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { logger } from '../utils/logger';
import { isMarketOpen, getMarketStatus } from '../utils/marketHours';
import { nifty009Engine } from '../strategies/nifty009/Nifty009Engine';
import { INDIAN_INSTRUMENTS, fetchLiveQuote } from '../controllers/marketController';

export interface MarketTickData {
  symbol: string;
  name: string;
  securityId: string;
  exchange: string;
  price: number;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  isOpen: boolean;
  marketStatus: string;
  timestamp: string;
  source: string;
}

export class MarketStreamer {
  private static instance: MarketStreamer | null = null;
  private io: SocketIOServer;
  private intervalId: NodeJS.Timeout | null = null;
  private currentPrices: Map<string, number> = new Map();
  private latestTicks: Map<string, MarketTickData> = new Map();
  private isSyncing: boolean = false;
  private lastSyncTime: number = 0;
  private isListeningToDhanWs: boolean = false;

  constructor(io: SocketIOServer) {
    this.io = io;
    MarketStreamer.instance = this;
  }

  public static getInstance(): MarketStreamer | null {
    return MarketStreamer.instance;
  }

  public getPrice(symbol: string): number | undefined {
    return this.currentPrices.get(symbol);
  }

  public getTick(symbol: string): MarketTickData | undefined {
    return this.latestTicks.get(symbol);
  }

  public start(intervalMs: number = 3000): void {
    if (this.intervalId) return;

    logger.info(`⚡ [MarketStreamer] Real Market Streamer initialized (${intervalMs}ms interval, zero synthetic data)`);

    // Initial sync
    this.syncRealMarketData();

    // Check Dhan WebSocket subscription
    this.attachDhanFeed();

    this.intervalId = setInterval(() => {
      this.syncRealMarketData();
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Connect to Dhan WebSocket feed if adapter is connected
   */
  public attachDhanFeed(): void {
    if (this.isListeningToDhanWs) return;

    const adapter = brokerRegistry.getPrimaryAdapter() as any;
    if (adapter && typeof adapter.on === 'function') {
      adapter.on('tick', (tick: any) => {
        if (!tick || !tick.securityId || !tick.ltp) return;

        // Map security ID to instrument
        const inst = INDIAN_INSTRUMENTS.find(i => i.securityId === String(tick.securityId));
        const symbol = inst ? inst.symbol : String(tick.securityId);
        const price = Number(tick.ltp);

        this.currentPrices.set(symbol, price);

        const marketOpen = isMarketOpen();
        const status = getMarketStatus();

        const tickData: MarketTickData = {
          symbol,
          name: inst?.name || symbol,
          securityId: String(tick.securityId),
          exchange: 'NSE',
          price,
          ltp: price,
          open: tick.open || price,
          high: tick.high || price,
          low: tick.low || price,
          close: price,
          prevClose: tick.prevClose || price,
          change: tick.prevClose ? Number((price - tick.prevClose).toFixed(2)) : 0,
          changePercent: tick.prevClose ? Number((((price - tick.prevClose) / tick.prevClose) * 100).toFixed(2)) : 0,
          volume: tick.volume || 0,
          isOpen: marketOpen,
          marketStatus: status.status,
          timestamp: new Date().toISOString(),
          source: 'DhanHQ v2 Real-Time Feed'
        };

        this.latestTicks.set(symbol, tickData);

        // Emit to symbol room and global tick
        this.io.to(`market_${symbol}`).emit('market_tick', tickData);
        this.io.emit('market_tick', tickData);

        // Feed real tick into strategy engine
        if (symbol === 'NIFTY 50' || symbol === 'NIFTY') {
          nifty009Engine.onMarketTick(symbol, price, tick.volume || 0);
        }
      });

      this.isListeningToDhanWs = true;
      logger.info('📡 [MarketStreamer] Hooked into Dhan live tick listener');
    }
  }

  /**
   * Authoritative sync from Dhan batch quotes or verified NSE quotes
   */
  private async syncRealMarketData(): Promise<void> {
    if (this.isSyncing) return;

    const now = Date.now();
    const marketOpen = isMarketOpen();
    const minInterval = marketOpen ? 2500 : 30000; // 2.5s when open, 30s when closed

    if (now - this.lastSyncTime < minInterval) return;

    this.isSyncing = true;
    this.lastSyncTime = now;

    try {
      this.attachDhanFeed();

      const adapter = brokerRegistry.getPrimaryAdapter() as any;
      let quotes: any[] = [];

      // 1. Try Dhan batch quotes if connected
      if (adapter && typeof adapter.getBatchQuotes === 'function') {
        try {
          const batch = await adapter.getBatchQuotes(INDIAN_INSTRUMENTS);
          if (Array.isArray(batch) && batch.length > 0) {
            quotes = batch.filter(q => q && q.ltp > 0);
          }
        } catch (_) {}
      }

      // 2. Fallback to real NSE / Yahoo live quotes for missing instruments
      if (quotes.length < INDIAN_INSTRUMENTS.length) {
        const foundSymbols = new Set(quotes.map(q => q.symbol));
        const missing = INDIAN_INSTRUMENTS.filter(i => !foundSymbols.has(i.symbol));

        const fetched = await Promise.all(
          missing.map(async (inst) => fetchLiveQuote(inst).catch(() => null))
        );

        for (const item of fetched) {
          if (item && item.price > 0) {
            quotes.push({
              symbol: item.symbol,
              name: item.name,
              securityId: item.securityId,
              exchange: 'NSE',
              ltp: item.price,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              prevClose: item.prevClose,
              change: item.change,
              changePercent: item.changePercent,
              volume: item.volume,
              source: item.source || 'NSE Live Feed'
            });
          }
        }
      }

      const status = getMarketStatus();

      const ticks: MarketTickData[] = quotes.map(q => {
        const price = Number(q.ltp);
        this.currentPrices.set(q.symbol, price);

        const tickData: MarketTickData = {
          symbol: q.symbol,
          name: q.name || q.symbol,
          securityId: q.securityId,
          exchange: q.exchange || 'NSE',
          price,
          ltp: price,
          open: q.open || price,
          high: q.high || price,
          low: q.low || price,
          close: price,
          prevClose: q.prevClose || price,
          change: q.change ?? Number((price - (q.prevClose || price)).toFixed(2)),
          changePercent: q.changePercent ?? 0,
          volume: q.volume || 0,
          isOpen: marketOpen,
          marketStatus: status.status,
          timestamp: new Date().toISOString(),
          source: q.source || (adapter ? 'DhanHQ v2 API' : 'NSE Live Feed')
        };

        this.latestTicks.set(q.symbol, tickData);

        // Emit individual tick
        this.io.to(`market_${q.symbol}`).emit('market_tick', tickData);

        // Feed real tick into strategy engine (only for NIFTY 50)
        if (q.symbol === 'NIFTY 50' || q.symbol === 'NIFTY') {
          nifty009Engine.onMarketTick(q.symbol, price, q.volume || 0);
        }

        return tickData;
      });

      if (ticks.length > 0) {
        // Emit consolidated batch update
        this.io.emit('market_data_update', {
          success: true,
          isOpen: marketOpen,
          marketStatus: status,
          data: ticks,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      logger.warn('[MarketStreamer] Real market sync warning:', err.message);
    } finally {
      this.isSyncing = false;
    }
  }
}
