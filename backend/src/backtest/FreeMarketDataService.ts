import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { Candle } from './DhanHistoricalDataService';

export interface FreeMarketDataResult {
  symbol: string;
  candles: Candle[];
  provider: 'Yahoo Finance (NSE Market Feed)';
  interval: number;
  timezone: 'Asia/Kolkata';
}

/**
 * Maps common index symbols to Yahoo Finance symbols.
 * ^NSEBANK = Nifty Bank (5-minute historical candles)
 * ^NSEI    = Nifty 50 (5-minute historical candles)
 */
const YAHOO_SYMBOL_MAP: Record<string, string> = {
  'BANKNIFTY': '^NSEBANK',
  'NIFTY BANK': '^NSEBANK',
  'NIFTY_BANK': '^NSEBANK',
  'NIFTY': '^NSEI',
  'NIFTY 50': '^NSEI',
  'NIFTY_50': '^NSEI',
  'FINNIFTY': 'NIFTY_FIN_SERVICE.NS',
  'MIDCPNIFTY': 'NIFTY_MID_SELECT.NS'
};

/**
 * FreeMarketDataService — 100% Free, zero-cost real market 5-minute candle service.
 * Fetches real NSE historical intraday market candles without requiring any paid API subscription.
 */
export class FreeMarketDataService {
  private cacheDir: string;

  constructor() {
    this.cacheDir = path.join(__dirname, '../../data/free_market_cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Fetch real 5-minute candles for the requested symbol and date range.
   */
  async get5MinCandles(
    symbol: string,
    fromDate?: string,
    toDate?: string
  ): Promise<Candle[]> {
    const cleanSym = symbol.toUpperCase().replace(/\s+/g, '_');
    const yahooSym = YAHOO_SYMBOL_MAP[cleanSym] ?? YAHOO_SYMBOL_MAP[symbol.toUpperCase()] ?? (cleanSym.includes('BANK') ? '^NSEBANK' : '^NSEI');

    const cacheFile = path.join(this.cacheDir, `${cleanSym}_5m.json`);

    // 1. Try to fetch fresh live 5-minute market candles from free Yahoo Finance API
    try {
      logger.info(`[FreeMarketDataService] Fetching real 5m market candles for ${symbol} (${yahooSym})...`);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=5m&range=1mo`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      const result = res.data?.chart?.result?.[0];
      const timestamps: number[] = result?.timestamp ?? [];
      const quotes = result?.indicators?.quote?.[0] ?? {};
      const open: number[] = quotes.open ?? [];
      const high: number[] = quotes.high ?? [];
      const low: number[] = quotes.low ?? [];
      const close: number[] = quotes.close ?? [];
      const volume: number[] = quotes.volume ?? [];

      if (Array.isArray(timestamps) && timestamps.length > 0) {
        const candles: Candle[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const ts = timestamps[i];
          const o = open[i];
          const h = high[i];
          const l = low[i];
          const c = close[i];
          const v = volume[i] ?? 0;

          // Filter out null/undefined bars (market closed intervals)
          if (o === null || h === null || l === null || c === null || isNaN(o)) continue;

          const date = this.toISTDate(ts);
          const time = this.toISTTime(ts);
          const isoTime = this.toISTIso(ts);

          // Only keep regular Indian market trading hours (09:15 to 15:30 IST)
          if (time < '09:15' || time > '15:30') continue;

          candles.push({
            timestamp: ts,
            isoTime,
            date,
            time,
            open: Number(o.toFixed(2)),
            high: Number(h.toFixed(2)),
            low: Number(l.toFixed(2)),
            close: Number(c.toFixed(2)),
            volume: Number(v) || 0
          });
        }

        if (candles.length > 0) {
          candles.sort((a, b) => a.timestamp - b.timestamp);
          try {
            fs.writeFileSync(cacheFile, JSON.stringify(candles, null, 2), 'utf8');
          } catch (_) {}
          logger.info(`[FreeMarketDataService] Successfully fetched ${candles.length} real 5m candles for ${symbol}`);
          return this.filterDateRange(candles, fromDate, toDate);
        }
      }
    } catch (err: any) {
      logger.warn(`[FreeMarketDataService] Live fetch failed (${err.message}). Checking disk cache...`);
    }

    // 2. Fallback to cached real market candles
    if (fs.existsSync(cacheFile)) {
      try {
        const raw = fs.readFileSync(cacheFile, 'utf8');
        const cached: Candle[] = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          logger.info(`[FreeMarketDataService] Loaded ${cached.length} cached real 5m candles for ${symbol}`);
          return this.filterDateRange(cached, fromDate, toDate);
        }
      } catch (_) {}
    }

    throw new Error(`FREE_MARKET_DATA_UNAVAILABLE: Could not retrieve real 5-minute market candles for ${symbol}. Please check internet connection.`);
  }

  private filterDateRange(candles: Candle[], fromDate?: string, toDate?: string): Candle[] {
    if (!fromDate && !toDate) return candles;
    return candles.filter((c) => {
      if (fromDate && c.date < fromDate) return false;
      if (toDate && c.date > toDate) return false;
      return true;
    });
  }

  private toISTDate(epochSeconds: number): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(epochSeconds * 1000));
  }

  private toISTTime(epochSeconds: number): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(epochSeconds * 1000));
  }

  private toISTIso(epochSeconds: number): string {
    const date = new Date(epochSeconds * 1000);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}+05:30`;
  }
}

export const freeMarketDataService = new FreeMarketDataService();