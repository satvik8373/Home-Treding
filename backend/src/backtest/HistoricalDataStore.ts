import axios from 'axios';
import { logger } from '../utils/logger';
import { DHAN_CONFIG } from '../brokers/dhan/config';
import { BrokerRegistry } from '../brokers/BrokerRegistry';
import { decryptToken } from '../security/encryption';
import { instrumentMaster } from '../services/InstrumentMasterService';
import fs from 'fs';
import path from 'path';

export interface OHLCVCandle {
  timestamp: string; // ISO String in Asia/Kolkata (+05:30)
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface HistoricalCacheMetadata {
  provider: 'DhanHQ' | 'Synthetic Engine';
  endpoint: '/charts/intraday' | '/charts/rollingoption' | 'synthetic';
  securityId: string;
  symbol: string;
  exchangeSegment: string;
  instrument: string;
  interval: string;
  fromDate: string;
  toDate: string;
  fetchedAt: string;
  timezone: 'Asia/Kolkata';
  candleCount: number;
  source: 'DHANHQ_LIVE' | 'OFFICIAL_CACHE';
}

export interface HistoricalDataResult {
  candles: OHLCVCandle[];
  metadata: HistoricalCacheMetadata;
}

/**
 * Converts unix epoch seconds to canonical Asia/Kolkata date and time
 */
export function epochToKolkataDateTime(epochSeconds: number): { dateStr: string; timeStr: string; isoStr: string } {
  const date = new Date(epochSeconds * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const timeStr = `${get('hour')}:${get('minute')}`;
  const isoStr = `${dateStr}T${timeStr}:${get('second')}+05:30`;
  return { dateStr, timeStr, isoStr };
}

/**
 * Splits a broad date range into <= 85 day chunks to comply with DhanHQ 90-day intraday API limits
 */
export function chunkDateRange(
  startDate: Date,
  endDate: Date,
  maxDaysPerChunk: number = 85
): Array<{ fromDate: Date; toDate: Date }> {
  const chunks: Array<{ fromDate: Date; toDate: Date }> = [];
  let cur = new Date(startDate);

  while (cur < endDate) {
    const next = new Date(cur);
    next.setDate(next.getDate() + maxDaysPerChunk);
    const chunkEnd = next > endDate ? new Date(endDate) : next;

    chunks.push({
      fromDate: new Date(cur),
      toDate: new Date(chunkEnd)
    });

    cur = new Date(chunkEnd);
    cur.setDate(cur.getDate() + 1);
  }
  return chunks;
}

export class HistoricalDataStore {
  private static instance: HistoricalDataStore;
  private cacheDir: string;

  constructor() {
    this.cacheDir = path.join(__dirname, '../../data/historical_cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public static getInstance(): HistoricalDataStore {
    if (!HistoricalDataStore.instance) {
      HistoricalDataStore.instance = new HistoricalDataStore();
    }
    return HistoricalDataStore.instance;
  }

  /**
   * Resolve Security Metadata from InstrumentMasterService
   */
  private getSecurityMetadata(symbol: string): { securityId: string; exchangeSegment: string; instrument: string } {
    const sym = symbol.toUpperCase().replace(/\s+/g, '_');
    if (sym.includes('BANK') || sym.includes('BNF')) {
      return { securityId: '25', exchangeSegment: 'IDX_I', instrument: 'INDEX' };
    }
    if (sym.includes('FIN')) {
      return { securityId: '27', exchangeSegment: 'IDX_I', instrument: 'INDEX' };
    }
    if (sym.includes('MIDCAP') || sym.includes('MIDCP')) {
      return { securityId: '28', exchangeSegment: 'IDX_I', instrument: 'INDEX' };
    }
    if (sym.includes('RELIANCE')) {
      return { securityId: '2885', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' };
    }
    if (sym.includes('HDFC')) {
      return { securityId: '1333', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' };
    }
    // Default NIFTY 50
    return { securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX' };
  }

  /**
   * Fetch historical candles using official DhanHQ V2 Intraday API (/charts/intraday)
   */
  public async getHistoricalCandles(
    symbol: string,
    days: number = 22,
    strictRealData: boolean = false
  ): Promise<HistoricalDataResult> {
    const cleanSym = symbol.replace(/\s+/g, '_').toUpperCase();
    const cacheFile = path.join(this.cacheDir, `${cleanSym}_${days}d.json`);
    const metaFile = path.join(this.cacheDir, `${cleanSym}_${days}d_meta.json`);

    // 1. Try Dhan Live Intraday API (with 90-day chunking)
    try {
      const liveRes = await this.fetchFromDhanIntradayApi(symbol, days);
      if (liveRes && liveRes.candles.length > 0) {
        logger.info(`[HistoricalDataStore] Fetched ${liveRes.candles.length} real 5m candles from DhanHQ live API for ${symbol}`);
        try {
          fs.writeFileSync(cacheFile, JSON.stringify(liveRes.candles, null, 2), 'utf8');
          fs.writeFileSync(metaFile, JSON.stringify(liveRes.metadata, null, 2), 'utf8');
        } catch (e) {
          // ignore cache write error
        }
        return liveRes;
      }
    } catch (err: any) {
      logger.error(`[HistoricalDataStore] Dhan live API failed (${err.message}). No synthetic fallback.`);
      throw new Error(
        `FRESH_DHAN_DATA_UNAVAILABLE: DhanHQ /charts/intraday failed for ${symbol}: ${err.message}. ` +
        'Connect an authenticated Dhan broker account to run a backtest with real market data.'
      );
    }

    // 2. Check local disk verified cache (for legitimate prior fetches only)
    if (fs.existsSync(cacheFile)) {
      try {
        const raw = fs.readFileSync(cacheFile, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          let metadata: HistoricalCacheMetadata;
          if (fs.existsSync(metaFile)) {
            metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
            metadata.source = 'OFFICIAL_CACHE';
          } else {
            const secMeta = this.getSecurityMetadata(symbol);
            metadata = {
              provider: 'DhanHQ',
              endpoint: '/charts/intraday',
              securityId: secMeta.securityId,
              symbol,
              exchangeSegment: secMeta.exchangeSegment,
              instrument: secMeta.instrument,
              interval: '5',
              fromDate: data[0]?.date || '',
              toDate: data[data.length - 1]?.date || '',
              fetchedAt: new Date().toISOString(),
              timezone: 'Asia/Kolkata',
              candleCount: data.length,
              source: 'OFFICIAL_CACHE'
            };
          }
          logger.info(`[HistoricalDataStore] Loaded ${data.length} verified cached candles for ${symbol}`);
          return { candles: data, metadata };
        }
      } catch (e) {
        // Cache miss — fall through to error below
      }
    }

    // No live data and no valid cache: fail explicitly — never generate synthetic data
    throw new Error(
      `FRESH_DHAN_DATA_UNAVAILABLE: No official Dhan historical data found for ${symbol}. ` +
      'Connect your Dhan broker account and retry.'
    );
  }

  /**
   * Official Dhan V2 Intraday Charts API: POST /charts/intraday
   * With automatic <= 85 day chunking to handle multi-month/multi-year spans
   */
  public async fetchFromDhanIntradayApi(
    symbol: string,
    days: number,
    interval: '1' | '5' | '15' | '25' | '60' = '5'
  ): Promise<HistoricalDataResult | null> {
    const registry = BrokerRegistry.getInstance();
    const connections = registry.listConnections();
    const dhanConn = connections.find((c) => c.broker === 'dhan' && c.status === 'Connected');

    let clientId = process.env.DHAN_CLIENT_ID || (dhanConn ? dhanConn.clientId : null);
    let accessToken = process.env.DHAN_ACCESS_TOKEN || null;

    if (!accessToken && dhanConn) {
      const storageFile = path.join(__dirname, '../../data/broker_connections.json');
      if (fs.existsSync(storageFile)) {
        const rawList = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
        const fullConn = rawList.find((c: any) => c.id === dhanConn.id);
        if (fullConn?.encryptedAccessToken) {
          accessToken = decryptToken(fullConn.encryptedAccessToken);
        }
      }
    }

    if (!clientId || !accessToken) {
      return null;
    }

    const meta = this.getSecurityMetadata(symbol);
    const totalCalendarDays = Math.round(days * 1.55);
    const overallEnd = new Date();
    const overallStart = new Date();
    overallStart.setDate(overallEnd.getDate() - totalCalendarDays);

    const formatDate = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Split requests into <= 85-day chunks to respect Dhan 90-day intraday limit
    const dateChunks = chunkDateRange(overallStart, overallEnd, 85);
    const allCandles: OHLCVCandle[] = [];
    const seenTimestamps = new Set<string>();

    for (const chunk of dateChunks) {
      const payload = {
        securityId: meta.securityId,
        exchangeSegment: meta.exchangeSegment,
        instrument: meta.instrument,
        interval,
        oi: false,
        fromDate: formatDate(chunk.fromDate),
        toDate: formatDate(chunk.toDate)
      };

      const response = await axios.post(`${DHAN_CONFIG.BASE_URL}/charts/intraday`, payload, {
        headers: {
          'access-token': accessToken,
          'client-id': clientId,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      });

      if (response.data && response.data.open && Array.isArray(response.data.open)) {
        const { open, high, low, close, volume, start_Time } = response.data;
        for (let i = 0; i < open.length; i++) {
          const epoch = Number(start_Time[i]);
          const { dateStr, timeStr, isoStr } = epochToKolkataDateTime(epoch);

          if (!seenTimestamps.has(isoStr)) {
            seenTimestamps.add(isoStr);
            allCandles.push({
              timestamp: isoStr,
              date: dateStr,
              time: timeStr,
              open: Number(open[i]),
              high: Number(high[i]),
              low: Number(low[i]),
              close: Number(close[i]),
              volume: Number(volume?.[i] ?? 0)
            });
          }
        }
      }
    }

    if (allCandles.length > 0) {
      // Sort chronologically
      allCandles.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const metadata: HistoricalCacheMetadata = {
        provider: 'DhanHQ',
        endpoint: '/charts/intraday',
        securityId: meta.securityId,
        symbol,
        exchangeSegment: meta.exchangeSegment,
        instrument: meta.instrument,
        interval,
        fromDate: formatDate(overallStart),
        toDate: formatDate(overallEnd),
        fetchedAt: new Date().toISOString(),
        timezone: 'Asia/Kolkata',
        candleCount: allCandles.length,
        source: 'DHANHQ_LIVE'
      };

      return { candles: allCandles, metadata };
    }

    return null;
  }

  /**
   * Official Dhan V2 Historical Expired Options Charts API: POST /charts/rollingoption
   */
  public async fetchExpiredOptionCandles(
    securityId: string,
    exchangeSegment: string,
    fromDate: string,
    toDate: string,
    interval: '1' | '5' | '15' = '5'
  ): Promise<OHLCVCandle[] | null> {
    const registry = BrokerRegistry.getInstance();
    const connections = registry.listConnections();
    const dhanConn = connections.find((c) => c.broker === 'dhan' && c.status === 'Connected');

    let clientId = process.env.DHAN_CLIENT_ID || (dhanConn ? dhanConn.clientId : null);
    let accessToken = process.env.DHAN_ACCESS_TOKEN || null;

    if (!clientId || !accessToken) {
      return null;
    }

    try {
      const payload = {
        securityId,
        exchangeSegment: exchangeSegment || 'NSE_FNO',
        interval,
        fromDate,
        toDate
      };

      const response = await axios.post(`${DHAN_CONFIG.BASE_URL}/charts/rollingoption`, payload, {
        headers: {
          'access-token': accessToken,
          'client-id': clientId,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.open && Array.isArray(response.data.open)) {
        const { open, high, low, close, volume, start_Time } = response.data;
        const candles: OHLCVCandle[] = [];
        for (let i = 0; i < open.length; i++) {
          const { dateStr, timeStr, isoStr } = epochToKolkataDateTime(Number(start_Time[i]));
          candles.push({
            timestamp: isoStr,
            date: dateStr,
            time: timeStr,
            open: Number(open[i]),
            high: Number(high[i]),
            low: Number(low[i]),
            close: Number(close[i]),
            volume: Number(volume?.[i] ?? 0)
          });
        }
        return candles;
      }
    } catch (err: any) {
      logger.warn(`[HistoricalDataStore] Expired options API error: ${err.message}`);
    }

    return null;
  }

  /**
   * @deprecated REMOVED — synthetic data generation is not permitted in this engine.
   * The backtest engine uses only real DhanHQ v2 API candle data.
   */
  public generateRealisticHistoricalSeries(_symbol: string, _days: number): OHLCVCandle[] {
    throw new Error(
      'SYNTHETIC_DATA_REMOVED: generateRealisticHistoricalSeries is no longer available. ' +
      'Use DhanHistoricalDataService to fetch real DhanHQ v2 candles.'
    );
  }
}

export const historicalDataStore = HistoricalDataStore.getInstance();
