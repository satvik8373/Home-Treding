import { Server as SocketIOServer } from 'socket.io';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { logger } from '../utils/logger';
import { isMarketOpen, getMarketStatus } from '../utils/marketHours';

interface InstrumentSeed {
  symbol: string;
  name: string;
  securityId: string;
  basePrice: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
}

const INSTRUMENT_SEEDS: InstrumentSeed[] = [
  { symbol: 'NIFTY 50', name: 'NIFTY 50 Index', securityId: '13', basePrice: 24100.70, open: 24128.95, high: 24188.30, low: 24076.85, prevClose: 24207.80, volume: 1854200 },
  { symbol: 'BANKNIFTY', name: 'NIFTY Bank Index', securityId: '25', basePrice: 57336.05, open: 57470.45, high: 57596.40, low: 57264.00, prevClose: 57783.80, volume: 923500 },
  { symbol: 'FINNIFTY', name: 'NIFTY Financial Services', securityId: '27', basePrice: 26204.00, open: 26262.65, high: 26316.25, low: 26155.45, prevClose: 26280.65, volume: 450200 },
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', securityId: '2885', basePrice: 1283.60, open: 1285.40, high: 1291.80, low: 1281.10, prevClose: 1282.20, volume: 4827869 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', securityId: '11536', basePrice: 2339.10, open: 2272.10, high: 2348.50, low: 2263.30, prevClose: 2248.40, volume: 2932861 },
  { symbol: 'INFY', name: 'Infosys Ltd', securityId: '1594', basePrice: 1137.20, open: 1128.00, high: 1145.00, low: 1123.30, prevClose: 1110.80, volume: 7033882 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', securityId: '1333', basePrice: 714.60, open: 709.10, high: 717.00, low: 707.00, prevClose: 711.00, volume: 11921716 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', securityId: '4963', basePrice: 1419.90, open: 1435.00, high: 1439.80, low: 1418.90, prevClose: 1443.00, volume: 6271244 },
  { symbol: 'SBIN', name: 'State Bank of India', securityId: '3045', basePrice: 1046.70, open: 1047.40, high: 1051.20, low: 1040.50, prevClose: 1042.90, volume: 3337637 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', securityId: '10604', basePrice: 1877.80, open: 1884.00, high: 1894.30, low: 1867.60, prevClose: 1878.30, volume: 4665642 }
];

export class MarketStreamer {
  private io: SocketIOServer;
  private intervalId: NodeJS.Timeout | null = null;
  private currentPrices: Map<string, number> = new Map();
  private lastClosedBroadcastTime: number = 0;

  constructor(io: SocketIOServer) {
    this.io = io;
    INSTRUMENT_SEEDS.forEach(s => this.currentPrices.set(s.symbol, s.basePrice));
  }

  public start(intervalMs: number = 1000): void {
    if (this.intervalId) return;

    logger.info(`⚡ [MarketStreamer] Market streamer initialized (${intervalMs}ms interval)`);

    this.intervalId = setInterval(() => {
      this.broadcastTicks();
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private broadcastTicks(): void {
    const marketOpen = isMarketOpen();
    const status = getMarketStatus();
    const now = Date.now();

    // When market is closed, only broadcast a static status heartbeat once every 5 seconds
    if (!marketOpen) {
      if (now - this.lastClosedBroadcastTime < 5000) {
        return;
      }
      this.lastClosedBroadcastTime = now;
    }

    const ticks = INSTRUMENT_SEEDS.map(inst => {
      let price: number;
      let volume: number = inst.volume;

      if (marketOpen) {
        // Real-market micro-tick fluctuation during open market hours only (0.01% - 0.03%)
        const current = this.currentPrices.get(inst.symbol) || inst.basePrice;
        const tickDelta = (Math.random() - 0.49) * (inst.basePrice * 0.0003);
        price = Number((current + tickDelta).toFixed(2));
        this.currentPrices.set(inst.symbol, price);
        volume = inst.volume + Math.floor(Math.random() * 50);
      } else {
        // Market is CLOSED: strictly freeze prices at official close/base prices
        price = this.currentPrices.get(inst.symbol) || inst.basePrice;
      }

      const changeAbs = Number((price - inst.prevClose).toFixed(2));
      const changePct = Number(((changeAbs / inst.prevClose) * 100).toFixed(2));

      const tick = {
        symbol: inst.symbol,
        name: inst.name,
        securityId: inst.securityId,
        exchange: 'NSE',
        price,
        ltp: price,
        open: inst.open,
        high: Math.max(inst.high, price),
        low: Math.min(inst.low, price),
        close: price,
        prevClose: inst.prevClose,
        change: changeAbs,
        changePercent: changePct,
        volume,
        isOpen: marketOpen,
        marketStatus: status.status,
        timestamp: new Date().toISOString()
      };

      // Emit per-symbol room and global tick
      this.io.to(`market_${inst.symbol}`).emit('market_tick', tick);
      this.io.emit('market_tick', tick);

      return tick;
    });

    // Emit consolidated batch update
    this.io.emit('market_data_update', {
      success: true,
      isOpen: marketOpen,
      marketStatus: status,
      data: ticks,
      timestamp: new Date().toISOString()
    });
  }
}
