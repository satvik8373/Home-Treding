import axios from 'axios';
import { logger } from '../utils/logger';
import { Candle } from './DhanHistoricalDataService';

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  'BANKNIFTY': '^NSEBANK',
  'NIFTY BANK': '^NSEBANK',
  'NIFTY_BANK': '^NSEBANK',
  'NIFTY': '^NSEI',
  'NIFTY 50': '^NSEI',
  'NIFTY50': '^NSEI',
  'NIFTY_50': '^NSEI',
  'FINNIFTY': 'NIFTY_FIN_SERVICE.NS',
  'NIFTY FIN SERVICE': 'NIFTY_FIN_SERVICE.NS',
  'MIDCPNIFTY': 'NIFTY_MID_SELECT.NS',
  'RELIANCE': 'RELIANCE.NS',
  'TCS': 'TCS.NS',
  'HDFCBANK': 'HDFCBANK.NS',
  'INFY': 'INFY.NS',
  'ICICIBANK': 'ICICIBANK.NS',
  'SBIN': 'SBIN.NS',
  'BHARTIARTL': 'BHARTIARTL.NS'
};

/**
 * FreeMarketDataService — 100% Real Live Market API Feed (Zero Disk Files, Zero Fake Data).
 * Executes real outgoing HTTP requests to fetch authentic NSE market candlestick data.
 */
export class FreeMarketDataService {
  // In-memory cache only (5-minute TTL) to avoid duplicate network calls; ZERO disk writes.
  private memoryCache = new Map<string, { candles: Candle[]; fetchedAt: number }>();

  /**
   * Fetch real 5-minute candles directly via live market API call.
   */
  async get5MinCandles(
    symbol: string,
    fromDate?: string,
    toDate?: string
  ): Promise<Candle[]> {
    const cleanSym = symbol.toUpperCase().replace(/\s+/g, '_');
    let yahooSym = YAHOO_SYMBOL_MAP[cleanSym] ?? YAHOO_SYMBOL_MAP[symbol.toUpperCase()];
    if (!yahooSym) {
      if (cleanSym.includes('BANK')) yahooSym = '^NSEBANK';
      else if (cleanSym.includes('NIFTY') || cleanSym.includes('NIFTY50')) yahooSym = '^NSEI';
      else if (cleanSym.startsWith('^') || cleanSym.endsWith('.NS')) yahooSym = cleanSym;
      else yahooSym = `${cleanSym}.NS`;
    }

    // Check in-memory cache (5-minute TTL)
    const cacheKey = `${cleanSym}_${fromDate || 'default'}_${toDate || 'default'}`;
    const cached = this.memoryCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < 5 * 60 * 1000) {
      logger.info(`[FreeMarketDataService] Serving ${cached.candles.length} real 5m candles for ${symbol} from memory`);
      return cached.candles;
    }

    // Determine query range or period (Yahoo strictly caps 5m candles at last 59 days)
    const nowSec = Math.floor(Date.now() / 1000);
    const maxHistoricalSec = nowSec - (58 * 86400);

    let queryParam = 'interval=5m&range=1mo';
    if (fromDate && toDate) {
      let p1 = Math.floor(new Date(`${fromDate}T00:00:00+05:30`).getTime() / 1000);
      let p2 = Math.floor(new Date(`${toDate}T23:59:59+05:30`).getTime() / 1000);

      if (isNaN(p1)) p1 = nowSec - (30 * 86400);
      if (isNaN(p2) || p2 > nowSec) p2 = nowSec;

      p1 = Math.max(p1, maxHistoricalSec);
      if (p1 >= p2) {
        p1 = maxHistoricalSec;
        p2 = nowSec;
      }

      queryParam = `interval=5m&period1=${p1}&period2=${p2}`;
    }

    logger.info(`[FreeMarketDataService] Executing REAL LIVE API CALL for ${symbol} (${yahooSym}, params: ${queryParam})...`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?${queryParam}`;
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

    if (!Array.isArray(timestamps) || timestamps.length === 0) {
      throw new Error(`NO_MARKET_DATA: Live market API returned 0 candles for ${symbol}`);
    }

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const o = open[i];
      const h = high[i];
      const l = low[i];
      const c = close[i];
      const v = volume[i] ?? 0;

      if (o === null || h === null || l === null || c === null || isNaN(o) || isNaN(c)) continue;

      const date = this.toISTDate(ts);
      const time = this.toISTTime(ts);
      const isoTime = this.toISTIso(ts);

      // Only include Indian market trading hours (09:15 to 15:30 IST)
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
        volume: Number(v)
      });
    }

    if (candles.length === 0) {
      throw new Error(`NO_MARKET_DATA: No valid trading-hour candles returned for ${symbol}`);
    }

    logger.info(`[FreeMarketDataService] Successfully fetched ${candles.length} REAL live 5m candles for ${symbol} via API call`);
    this.memoryCache.set(cacheKey, { candles, fetchedAt: now });
    return candles;
  }

  private toISTDate(epochSeconds: number): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(epochSeconds * 1000));
  }

  private toISTTime(epochSeconds: number): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(epochSeconds * 1000));
  }

  private toISTIso(epochSeconds: number): string {
    const date = new Date(epochSeconds * 1000);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(date);
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}+05:30`;
  }
}

export const freeMarketDataService = new FreeMarketDataService();
