import axios, { AxiosInstance } from 'axios';
import path from 'path';
import fs from 'fs';
import { BrokerRegistry } from '../brokers/BrokerRegistry';
import { decryptToken } from '../security/encryption';
import { logger } from '../utils/logger';
import { DHAN_CONFIG } from '../brokers/dhan/config';

export type ExchangeSegment = 'IDX_I' | 'NSE_FNO' | 'NSE_EQ' | 'BSE_FNO' | 'BSE_EQ';

export interface Candle {
  timestamp: number;
  isoTime: string;
  date: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface OptionCandle extends Candle {
  strike: number;
  optionType: 'CE' | 'PE';
  spot?: number;
  iv?: number;
}

export interface DhanAuthContext {
  accessToken: string;
  clientId: string;
}

export interface SecurityMetadata {
  securityId: string;
  exchangeSegment: ExchangeSegment;
  instrument: string;
}

export const DHAN_SYMBOL_SECURITY_MAP: Record<string, SecurityMetadata> = {
  'NIFTY 50': { securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY': { securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY50': { securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'BANKNIFTY': { securityId: '25', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY BANK': { securityId: '25', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY_BANK': { securityId: '25', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'FINNIFTY': { securityId: '27', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY FIN SERVICE': { securityId: '27', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'MIDCPNIFTY': { securityId: '28', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'SENSEX': { securityId: '51', exchangeSegment: 'BSE_FNO', instrument: 'INDEX' },
  'RELIANCE': { securityId: '2885', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' },
  'TCS': { securityId: '11536', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' },
  'HDFCBANK': { securityId: '1333', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' },
  'INFY': { securityId: '1594', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' },
  'ICICIBANK': { securityId: '4963', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' },
  'SBIN': { securityId: '3045', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' },
  'BHARTIARTL': { securityId: '10604', exchangeSegment: 'NSE_EQ', instrument: 'EQUITY' }
};

export class DhanHistoricalDataService {
  private http: AxiosInstance;

  constructor(auth: DhanAuthContext) {
    this.http = axios.create({
      baseURL: DHAN_CONFIG.BASE_URL,
      timeout: 25000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'access-token': auth.accessToken,
        'client-id': auth.clientId
      }
    });
  }

  /**
   * Resolves Dhan credentials for a specific authenticated user.
   * Priority:
   * 1. Direct custom credentials if supplied in request
   * 2. User's active connected Dhan adapter from BrokerRegistry
   * 3. User's encrypted connected broker in data/broker-connections.json
   * 4. System fallback: process.env.DHAN_ACCESS_TOKEN and process.env.DHAN_CLIENT_ID
   */
  static resolveAuth(
    userId?: string,
    customCreds?: { accessToken?: string; clientId?: string }
  ): DhanAuthContext | null {
    if (customCreds?.accessToken && customCreds?.clientId) {
      return { accessToken: customCreds.accessToken, clientId: customCreds.clientId };
    }

    const registry = BrokerRegistry.getInstance();

    if (userId) {
      const adapter = registry.getAdapter(userId, 'dhan');
      if (adapter && adapter.getStatus()) {
        const creds = adapter.getCredentials();
        if (creds?.accessToken && creds?.clientId) {
          return { accessToken: creds.accessToken, clientId: creds.clientId };
        }
      }

      const storageFile = path.join(__dirname, '../../data/broker-connections.json');
      if (fs.existsSync(storageFile)) {
        try {
          const rawList: any[] = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
          const userDhan = rawList.find(
            (c) => c.userId === userId && c.broker === 'dhan' && c.status === 'Connected'
          );
          if (userDhan && userDhan.clientId && userDhan.encryptedAccessToken) {
            const accessToken = decryptToken(userDhan.encryptedAccessToken);
            if (accessToken) {
              return { accessToken, clientId: userDhan.clientId };
            }
          }
        } catch (_) {}
      }
    }

    const envToken = process.env.DHAN_ACCESS_TOKEN;
    const envClient = process.env.DHAN_CLIENT_ID;
    if (envToken && envClient) {
      return { accessToken: envToken, clientId: envClient };
    }

    return null;
  }

  /**
   * Resolves security metadata from Dhan's scrip list
   */
  static getSecurityMetadata(symbol: string): SecurityMetadata {
    const clean = symbol.toUpperCase().trim();
    if (DHAN_SYMBOL_SECURITY_MAP[clean]) {
      return DHAN_SYMBOL_SECURITY_MAP[clean];
    }
    const cleanUnderscore = clean.replace(/_/g, ' ');
    if (DHAN_SYMBOL_SECURITY_MAP[cleanUnderscore]) {
      return DHAN_SYMBOL_SECURITY_MAP[cleanUnderscore];
    }
    if (clean.includes('BANK')) {
      return DHAN_SYMBOL_SECURITY_MAP['BANKNIFTY'];
    }
    if (clean.includes('NIFTY')) {
      return DHAN_SYMBOL_SECURITY_MAP['NIFTY 50'];
    }
    return {
      securityId: '13',
      exchangeSegment: 'IDX_I',
      instrument: 'INDEX'
    };
  }

  /**
   * Fetch 5m or 15m intraday candles from DhanHQ /charts/intraday
   * Automatically chunks date spans > 85 days to respect Dhan's 90-day intraday limit.
   */
  async getIntradayCandles(params: {
    securityId: string;
    exchangeSegment: ExchangeSegment;
    instrument: string;
    fromDate: string;
    toDate: string;
    interval?: 1 | 5 | 15 | 25 | 60;
    oi?: boolean;
  }): Promise<Candle[]> {
    const startDate = new Date(params.fromDate);
    const endDate = new Date(params.toDate);
    const dateChunks = chunkDateRange(startDate, endDate, 85);

    const allCandles: Candle[] = [];
    const seenTimestamps = new Set<number>();

    for (const chunk of dateChunks) {
      const fromFormatted = formatDhanDate(chunk.fromDate);
      const toFormatted = formatDhanDate(chunk.toDate);

      try {
        const response = await this.http.post('/charts/intraday', {
          securityId: params.securityId,
          exchangeSegment: params.exchangeSegment,
          instrument: params.instrument,
          interval: String(params.interval ?? 5),
          oi: params.oi ?? false,
          fromDate: fromFormatted,
          toDate: toFormatted
        });

        const candles = this.parseCandleResponse(response.data);
        for (const c of candles) {
          if (!seenTimestamps.has(c.timestamp)) {
            seenTimestamps.add(c.timestamp);
            allCandles.push(c);
          }
        }
      } catch (err: any) {
        this.handleDhanError(err, 'charts/intraday');
      }
    }

    return allCandles.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Fetch daily candles from DhanHQ /charts/historical
   */
  async getHistoricalDailyCandles(params: {
    securityId: string;
    exchangeSegment: ExchangeSegment;
    instrument: string;
    fromDate: string;
    toDate: string;
    expiryCode?: number;
    oi?: boolean;
  }): Promise<Candle[]> {
    try {
      const response = await this.http.post('/charts/historical', {
        securityId: params.securityId,
        exchangeSegment: params.exchangeSegment,
        instrument: params.instrument,
        expiryCode: params.expiryCode ?? 0,
        oi: params.oi ?? false,
        fromDate: params.fromDate.split(' ')[0],
        toDate: params.toDate.split(' ')[0]
      });

      return this.parseCandleResponse(response.data);
    } catch (err: any) {
      this.handleDhanError(err, 'charts/historical');
      return [];
    }
  }

  /**
   * Fetch options candles from DhanHQ /charts/rollingoption
   */
  async getExpiredOptionCandles(params: {
    securityId: string;
    exchangeSegment: 'NSE_FNO' | 'BSE_FNO';
    instrument: 'OPTIDX' | 'OPTSTK';
    expiryFlag: 'WEEK' | 'MONTH';
    expiryCode: number;
    strike: string;
    optionType: 'CALL' | 'PUT';
    fromDate: string;
    toDate: string;
    interval?: 1 | 5 | 15 | 25 | 60;
  }): Promise<OptionCandle[]> {
    try {
      const response = await this.http.post('/charts/rollingoption', {
        exchangeSegment: params.exchangeSegment,
        interval: String(params.interval ?? 5),
        securityId: params.securityId,
        instrument: params.instrument,
        expiryFlag: params.expiryFlag,
        expiryCode: params.expiryCode,
        strike: params.strike,
        drvOptionType: params.optionType,
        requiredData: ['open', 'high', 'low', 'close', 'volume', 'oi', 'iv', 'strike', 'spot'],
        fromDate: params.fromDate,
        toDate: params.toDate
      });
      return this.parseRollingOptionResponse(response.data, params.optionType);
    } catch (err: any) {
      this.handleDhanError(err, 'charts/rollingoption');
      return [];
    }
  }

  /**
   * High-level method to fetch real Dhan candles for any index or stock symbol
   */
  async getCandlesForSymbol(
    symbol: string,
    fromDate: string,
    toDate: string,
    interval: 1 | 5 | 15 | 25 | 60 = 5
  ): Promise<Candle[]> {
    const meta = DhanHistoricalDataService.getSecurityMetadata(symbol);
    return this.getIntradayCandles({
      securityId: meta.securityId,
      exchangeSegment: meta.exchangeSegment,
      instrument: meta.instrument,
      fromDate,
      toDate,
      interval
    });
  }


  /**
   * Resolve the fixed ATM option selected at the first 5-minute candle close.
   * Dhan's rolling-options API is relative to ATM, so we request ATM +/- 10
   * strikes and select the exact strike for each historical minute.
   */
  async getFixedStrikeOptionSeries(params: {
    symbol: string;
    fromDate: string;
    toDate: string;
    optionType: 'CE' | 'PE';
    strikeStep: number;
    referenceTime?: string;
    expiryFlag?: 'WEEK' | 'MONTH';
  }): Promise<{ candles1m: OptionCandle[]; candles5m: OptionCandle[]; strikesByDate: Record<string, number> }> {
    const meta = DhanHistoricalDataService.getSecurityMetadata(params.symbol);
    if (meta.exchangeSegment !== 'IDX_I') {
      throw new Error('FIXED_ATM_OPTIONS_UNSUPPORTED: This backtest currently supports index options only.');
    }

    const spot = await this.getIntradayCandles({
      securityId: meta.securityId,
      exchangeSegment: meta.exchangeSegment,
      instrument: meta.instrument,
      fromDate: params.fromDate,
      toDate: params.toDate,
      interval: 5
    });

    const referenceTime = params.referenceTime ?? '09:15';
    const strikesByDate: Record<string, number> = {};
    for (const candle of spot) {
      if (candle.time === referenceTime && strikesByDate[candle.date] === undefined) {
        strikesByDate[candle.date] = Math.round(candle.close / params.strikeStep) * params.strikeStep;
      }
    }

    const offsets = Array.from({ length: 21 }, (_, i) => i - 10);
    const optionType = params.optionType === 'CE' ? 'CALL' : 'PUT';
    const expiryFlag = params.expiryFlag ?? 'WEEK';

    const series: OptionCandle[][] = [];
    for (const offset of offsets) {
      series.push(await this.getExpiredOptionCandles({
        securityId: meta.securityId,
        exchangeSegment: 'NSE_FNO',
        instrument: 'OPTIDX',
        expiryFlag,
        expiryCode: 0,
        strike: offset === 0 ? 'ATM' : offset > 0 ? `ATM+${offset}` : `ATM${offset}`,
        optionType,
        fromDate: params.fromDate,
        toDate: params.toDate,
        interval: 1
      }));
    }

    const selected = new Map<string, OptionCandle>();
    for (const candles of series) {
      for (const candle of candles) {
        const targetStrike = strikesByDate[candle.date];
        if (targetStrike === undefined || candle.strike !== targetStrike) continue;
        const key = `${candle.date}:${candle.timestamp}`;
        if (selected.has(key)) throw new Error(`DUPLICATE_OPTION_CANDLE:${key}`);
        selected.set(key, candle);
      }
    }

    const candles1m = Array.from(selected.values()).sort((a, b) => a.timestamp - b.timestamp);
    const expectedMinutes = 356;
    const dates = Object.keys(strikesByDate);

    for (const date of dates) {
      const day = candles1m.filter((c) => c.date === date && c.time >= '09:15' && c.time <= '15:10');
      const fiveMinuteCount = candles1m.filter((c) => c.date === date && c.time >= '09:15' && c.time <= '15:05').length;
      if (day.length < expectedMinutes || fiveMinuteCount < 71) {
        throw new Error(
          `INCOMPLETE_OPTION_DATA: ${params.optionType} ${date} fixed strike ${strikesByDate[date]} has ${day.length}/${expectedMinutes} one-minute candles and ${fiveMinuteCount}/351 signal minutes before the 15:10 square-off. Backtest stopped to avoid estimated or fabricated values.`
        );
      }
    }

    const fiveMinute = new Map<string, OptionCandle[]>();
    for (const candle of candles1m) {
      if (candle.time < '09:15' || candle.time > '15:10') continue;
      const minute = Number(candle.time.slice(3, 5));
      const bucketMinute = Math.floor(minute / 5) * 5;
      const bucketTime = `${candle.time.slice(0, 3)}${String(bucketMinute).padStart(2, '0')}`;
      const key = `${candle.date}:${bucketTime}`;
      const bucket = fiveMinute.get(key) ?? [];
      bucket.push(candle);
      fiveMinute.set(key, bucket);
    }

    const candles5m: OptionCandle[] = [];
    for (const bucket of fiveMinute.values()) {
      bucket.sort((a, b) => a.timestamp - b.timestamp);
      if (bucket.length !== 5) continue;
      candles5m.push({
        ...bucket[0],
        open: bucket[0].open,
        high: Math.max(...bucket.map((c) => c.high)),
        low: Math.min(...bucket.map((c) => c.low)),
        close: bucket[bucket.length - 1].close,
        volume: bucket.reduce((sum, c) => sum + c.volume, 0),
        oi: bucket[bucket.length - 1].oi,
        iv: bucket[bucket.length - 1].iv,
        spot: bucket[bucket.length - 1].spot
      });
    }

    return {
      candles1m: candles1m.filter((c) => c.time >= '09:15' && c.time <= '15:10'),
      candles5m: candles5m.sort((a, b) => a.timestamp - b.timestamp),
      strikesByDate
    };
  }

  private handleDhanError(err: any, endpoint: string): never {
    const status = err.response?.status;
    const data = err.response?.data;
    const errorCode = data?.errorCode || data?.['806'] || data?.data?.['806'];
    const msg = data?.errorMessage || data?.message || err.message;

    if (errorCode === 'DH-902' || msg?.includes('Data APIs') || msg?.includes('DH-902') || msg?.includes('not subscribed')) {
      throw new Error(
        "DHAN_DATA_API_NOT_SUBSCRIBED (DH-902): Your DhanHQ access token is valid and active, but your Dhan account has not subscribed to 'Data APIs' (dataPlan is Deactive in your Dhan profile). To fetch historical candle data for backtesting, please log in to https://dhanhq.co (or web.dhan.co -> Profile -> DhanHQ Trading APIs) and activate the 'Data APIs' subscription."
      );
    }

    if (status === 401 || errorCode === 'DH-901' || msg?.includes('Invalid_Authentication')) {
      throw new Error(
        'DHAN_TOKEN_EXPIRED: Your DhanHQ access token is invalid or expired. Please reconnect your Dhan account on the Brokers page.'
      );
    }

    if (errorCode === 'DH-905') {
      throw new Error(
        `DHAN_INVALID_INSTRUMENT (DH-905): Security ID or exchange segment mismatch on ${endpoint}. Verify instrument master.`
      );
    }

    throw new Error(`DHAN_API_ERROR: DhanHQ /${endpoint} failed (${status || 'Network'}): ${msg}`);
  }

  private parseCandleResponse(data: any): Candle[] {
    const timestamps: any[] = data?.start_Time ?? data?.timestamp ?? [];
    const open: any[] = data?.open ?? [];
    const high: any[] = data?.high ?? [];
    const low: any[] = data?.low ?? [];
    const close: any[] = data?.close ?? [];
    const volume: any[] = data?.volume ?? [];
    const oi: any[] = data?.oi ?? [];

    if (!Array.isArray(timestamps) || timestamps.length === 0) {
      throw new Error('FRESH_DHAN_DATA_UNAVAILABLE: DhanHQ chart API returned zero candles for requested range');
    }

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = Number(timestamps[i]);
      const o = Number(open[i]);
      const h = Number(high[i]);
      const l = Number(low[i]);
      const c = Number(close[i]);
      const v = Number(volume[i] ?? 0);

      if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) {
        continue;
      }

      const candle: Candle = {
        timestamp: ts,
        isoTime: this.toISTIso(ts),
        date: this.toISTDate(ts),
        time: this.toISTTime(ts),
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v
      };

      if (oi[i] !== undefined) candle.oi = Number(oi[i]);
      this.validateCandle(candle);
      candles.push(candle);
    }
    return candles.sort((a, b) => a.timestamp - b.timestamp);
  }

  private parseRollingOptionResponse(data: any, requestedOptionType: 'CALL' | 'PUT'): OptionCandle[] {
    const root = requestedOptionType === 'CALL'
      ? data?.data?.ce ?? data?.ce
      : data?.data?.pe ?? data?.pe;

    if (!root) {
      throw new Error('FRESH_DHAN_DATA_UNAVAILABLE: /charts/rollingoption returned no option data');
    }

    const timestamps: any[] = root.timestamp ?? root.start_Time ?? [];
    if (!Array.isArray(timestamps) || timestamps.length === 0) {
      throw new Error('FRESH_DHAN_DATA_UNAVAILABLE: /charts/rollingoption returned no candles');
    }

    const open = root.open ?? [];
    const high = root.high ?? [];
    const low = root.low ?? [];
    const close = root.close ?? [];
    const volume = root.volume ?? [];
    const oi = root.oi ?? [];
    const iv = root.iv ?? [];
    const strike = root.strike ?? [];
    const spot = root.spot ?? [];

    const result: OptionCandle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = Number(timestamps[i]);
      const candle: OptionCandle = {
        timestamp: ts,
        isoTime: this.toISTIso(ts),
        date: this.toISTDate(ts),
        time: this.toISTTime(ts),
        open: Number(open[i]),
        high: Number(high[i]),
        low: Number(low[i]),
        close: Number(close[i]),
        volume: Number(volume[i] ?? 0),
        strike: Number(strike[i] ?? 0),
        optionType: requestedOptionType === 'CALL' ? 'CE' : 'PE',
        spot: spot[i] !== undefined ? Number(spot[i]) : undefined,
        iv: iv[i] !== undefined ? Number(iv[i]) : undefined,
        oi: oi[i] !== undefined ? Number(oi[i]) : undefined
      };
      this.validateCandle(candle);
      result.push(candle);
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  private validateCandle(candle: Candle): void {
    if (!Number.isFinite(candle.open) || !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) || !Number.isFinite(candle.close)) {
      throw new Error(`INVALID_DHAN_CANDLE: Non-finite OHLC at timestamp ${candle.timestamp}`);
    }
    if (candle.high < candle.low) {
      throw new Error(`INVALID_OHLC_RANGE: high < low at timestamp ${candle.timestamp}`);
    }
  }

  toISTDate(epochSeconds: number): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(epochSeconds * 1000));
  }

  toISTTime(epochSeconds: number): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(epochSeconds * 1000));
  }

  toISTIso(epochSeconds: number): string {
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

export function chunkDateRange(
  startDate: Date,
  endDate: Date,
  maxDaysPerChunk = 85
): Array<{ fromDate: Date; toDate: Date }> {
  const chunks: Array<{ fromDate: Date; toDate: Date }> = [];
  let cur = new Date(startDate);
  while (cur < endDate) {
    const next = new Date(cur);
    next.setDate(next.getDate() + maxDaysPerChunk);
    const chunkEnd = next > endDate ? new Date(endDate) : next;
    chunks.push({ fromDate: new Date(cur), toDate: new Date(chunkEnd) });
    cur = new Date(chunkEnd);
    cur.setDate(cur.getDate() + 1);
  }
  return chunks;
}

export function formatDhanDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}