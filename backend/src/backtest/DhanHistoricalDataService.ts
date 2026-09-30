import axios, { AxiosInstance } from 'axios';
import { storedDhanAuth } from '../brokers/brokerStorage';
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
  private http: AxiosInstance | null = null;
  private requestTail: Promise<unknown> = Promise.resolve();
  private nextRequestAt = 0;
  public isUsingDhanApi = false;

  constructor(auth?: DhanAuthContext) {
    if (auth?.accessToken && auth?.clientId) {
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
  }

  private postData(endpoint: string, body: object): Promise<any> {
    if (!this.http) throw new Error('DHAN_AUTH_REQUIRED');
    const request = this.requestTail.then(async () => {
      const waitMs = Math.max(0, this.nextRequestAt - Date.now());
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      this.nextRequestAt = Date.now() + 250; // Dhan Data API: at most 5 requests/second.
      return this.http!.post(endpoint, body);
    });
    this.requestTail = request.then(() => undefined, () => undefined);
    return request;
  }

  /**
   * Resolves Dhan credentials for a specific authenticated user.
   * Priority:
   * 1. Explicit credentials supplied by trusted server code
   * 2. The current user's encrypted broker connection
   * 3. Server credentials only for jobs without a user identity
   */
  static resolveAuth(
    userId?: string,
    customCreds?: { accessToken?: string; clientId?: string }
  ): DhanAuthContext | null {
    if (customCreds?.accessToken && customCreds?.clientId) {
      return { accessToken: customCreds.accessToken, clientId: customCreds.clientId };
    }

    if (userId) {
      return storedDhanAuth(userId);
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
    throw new Error(`UNSUPPORTED_SYMBOL: ${symbol}`);
  }

  /**
   * Fetch intraday candles from DhanHQ /charts/intraday.
   * Inactive Data API access fails without producing a modeled report.
   */
  async getIntradayCandles(params: {
    securityId?: string;
    exchangeSegment?: ExchangeSegment;
    instrument?: string;
    symbol?: string;
    fromDate: string;
    toDate: string;
    interval?: 1 | 5 | 15 | 25 | 60;
    oi?: boolean;
  }): Promise<Candle[]> {
    if (!this.http) throw new Error('DHAN_AUTH_REQUIRED: Connect your Dhan account to run a historical options backtest.');

    try {
      const startDate = new Date(`${params.fromDate.slice(0, 10)}T00:00:00Z`);
      const endDate = new Date(`${params.toDate.slice(0, 10)}T00:00:00Z`);
      const dateChunks = chunkDateRange(startDate, endDate, 85);

      const allCandles: Candle[] = [];
      const seenTimestamps = new Set<number>();

      for (const chunk of dateChunks) {
        const fromFormatted = formatDhanDate(chunk.fromDate);
        const toFormatted = formatDhanDate(chunk.toDate);

        const response = await this.postData('/charts/intraday', {
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
      }

      if (allCandles.length > 0) {
        this.isUsingDhanApi = true;
        return allCandles.sort((a, b) => a.timestamp - b.timestamp);
      }
    } catch (err: any) {
      this.handleDhanError(err, 'charts/intraday');
    }
    throw new Error('NO_HISTORICAL_SPOT_DATA: Dhan returned no spot candles.');
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
    if (!this.http) return [];
    const all: OptionCandle[] = [];
    const chunks = chunkDateRange(new Date(`${params.fromDate}T00:00:00Z`), new Date(`${params.toDate}T00:00:00Z`), 30);
    for (const chunk of chunks) {
      try {
        const response = await this.postData('/charts/rollingoption', {
          exchangeSegment: params.exchangeSegment,
          interval: String(params.interval ?? 5),
          securityId: params.securityId,
          instrument: params.instrument,
          expiryFlag: params.expiryFlag,
          expiryCode: params.expiryCode,
          strike: params.strike,
          drvOptionType: params.optionType,
          requiredData: ['open', 'high', 'low', 'close', 'volume', 'oi', 'iv', 'strike', 'spot'],
          fromDate: chunk.fromDate.toISOString().slice(0, 10),
          toDate: chunk.toDate.toISOString().slice(0, 10)
        });
        all.push(...this.parseRollingOptionResponse(response.data, params.optionType));
      } catch (err: any) {
        this.handleDhanError(err, 'charts/rollingoption');
      }
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Resolve the fixed ATM option from Dhan expired-option candles. */
  async getFixedStrikeOptionSeries(params: {
    symbol: string;
    fromDate: string;
    toDate: string;
    optionType: 'CE' | 'PE';
    strikeStep: number;
    referenceTime?: string;
    expiryFlag?: 'WEEK' | 'MONTH';
    preloadedSpot?: Candle[];
  }): Promise<{ candles1m: OptionCandle[]; candles5m: OptionCandle[]; strikesByDate: Record<string, number> }> {
    const meta = DhanHistoricalDataService.getSecurityMetadata(params.symbol);
    const spot = params.preloadedSpot || await this.getIntradayCandles({
      securityId: meta.securityId,
      exchangeSegment: meta.exchangeSegment,
      instrument: meta.instrument,
      symbol: params.symbol,
      fromDate: params.fromDate,
      toDate: params.toDate,
      interval: 5
    });

    if (!spot.length) {
      throw new Error(`NO_HISTORICAL_SPOT_DATA: Could not fetch spot candles for ${params.symbol}`);
    }

    if (!this.http || !this.isUsingDhanApi) {
      throw new Error('DHAN_AUTH_REQUIRED: Verified Dhan historical data is required for options backtesting.');
    }
    // Resolve the fixed ATM contract from actual Dhan expired-option candles.
    if (this.isUsingDhanApi) {
      try {
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

        if (Object.keys(strikesByDate).length > 0) {
          const series: OptionCandle[][] = [];
          for (let i = 0; i < offsets.length; i += 5) {
            const batch = offsets.slice(i, i + 5);
            series.push(...await Promise.all(batch.map(offset => this.getExpiredOptionCandles({
              securityId: meta.securityId, exchangeSegment: 'NSE_FNO', instrument: 'OPTIDX',
              expiryFlag, expiryCode: 0,
              strike: offset === 0 ? 'ATM' : offset > 0 ? `ATM+${offset}` : `ATM${offset}`,
              optionType, fromDate: params.fromDate, toDate: params.toDate, interval: 1
            }))));
          }

          const selected = new Map<string, OptionCandle>();
          for (const candles of series) {
            for (const candle of candles) {
              const targetStrike = strikesByDate[candle.date];
              if (targetStrike === undefined || candle.strike !== targetStrike) continue;
              const key = `${candle.date}:${candle.timestamp}`;
              const previous = selected.get(key);
              if (previous && (previous.open !== candle.open || previous.high !== candle.high ||
                  previous.low !== candle.low || previous.close !== candle.close || previous.volume !== candle.volume)) {
                throw new Error(`CONFLICTING_OPTION_CANDLES: ${key}`);
              }
              selected.set(key, candle);
            }
          }

          const candles1m = Array.from(selected.values()).sort((a, b) => a.timestamp - b.timestamp);
          const expectedMinutes = 356;
          const dates = Object.keys(strikesByDate);
          let allDaysComplete = true;

          for (const date of dates) {
            const day = candles1m.filter((c) => c.date === date && c.time >= '09:15' && c.time <= '15:10');
            const firstTimestamp = Date.parse(`${date}T09:15:00+05:30`) / 1000;
            if (day.length !== expectedMinutes || day.some((c, i) => c.timestamp !== firstTimestamp + i * 60)) {
              allDaysComplete = false;
              break;
            }
          }

          if (allDaysComplete && candles1m.length >= expectedMinutes * dates.length) {
            const fiveMinute = new Map<string, OptionCandle[]>();
            for (const candle of candles1m) {
              if (candle.time < '09:15' || candle.time >= '15:10') continue;
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
              if (bucket.length !== 5 || bucket.some((c, i) => c.timestamp !== bucket[0].timestamp + i * 60)) {
                throw new Error(`INCOMPLETE_OPTION_SIGNAL_CANDLE: ${bucket[0]?.date} ${bucket[0]?.time}`);
              }
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
        }
      } catch (err: any) {
        if (err.message?.startsWith('CONFLICTING_OPTION_CANDLES') || err.message?.startsWith('INCOMPLETE_OPTION_SIGNAL_CANDLE')) throw err;
        this.handleDhanError(err, 'charts/rollingoption');
      }
    }
    throw new Error('INCOMPLETE_OPTION_DATA: Dhan did not return a complete fixed-strike option series.');
  }

  private handleDhanError(err: any, endpoint: string): never {
    const status = err.response?.status;
    const data = err.response?.data;
    const errorCode = String(data?.errorCode ?? data?.errorCodeInt ?? data?.errorCodeNum ?? '');
    const msg = data?.errorMessage || data?.message || err.message;

    if (errorCode === 'DH-902' || errorCode === '806' || msg?.includes('Data APIs') || msg?.includes('DH-902') || msg?.includes('not subscribed')) {
      throw new Error(
        'DHAN_DATA_API_NOT_SUBSCRIBED (DH-902): The connected Dhan account is valid for trading, but Dhan denied access to historical minute candles. Please activate/subscribe to Data APIs in DhanHQ (web.dhan.co -> My Profile -> Access DhanHQ APIs) and generate a new Access Token.'
      );
    }

    if (status === 401 || errorCode === 'DH-901' || errorCode === '807' || msg?.includes('Invalid_Authentication')) {
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

      if (!Number.isFinite(ts) || !Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) {
        throw new Error(`INVALID_DHAN_CANDLE: Missing or invalid OHLC at index ${i}`);
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
      return [];
    }

    const timestamps: any[] = root.timestamp ?? root.start_Time ?? [];
    if (!Array.isArray(timestamps) || timestamps.length === 0) {
      return [];
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
      if (!Number.isFinite(candle.strike) || candle.strike <= 0) {
        throw new Error(`INVALID_OPTION_STRIKE: ${candle.isoTime}`);
      }
      result.push(candle);
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  private validateCandle(candle: Candle): void {
    if (!Number.isFinite(candle.open) || !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) || !Number.isFinite(candle.close)) {
      throw new Error(`INVALID_DHAN_CANDLE: Non-finite OHLC at timestamp ${candle.timestamp}`);
    }
    if (candle.high < Math.max(candle.open, candle.close) ||
        candle.low > Math.min(candle.open, candle.close) || candle.low < 0) {
      throw new Error(`INVALID_OHLC_RANGE: ${candle.isoTime}`);
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
    next.setUTCDate(next.getUTCDate() + maxDaysPerChunk);
    const chunkEnd = next > endDate ? new Date(endDate) : next;
    chunks.push({ fromDate: new Date(cur), toDate: new Date(chunkEnd) });
    cur = new Date(chunkEnd);
  }
  return chunks;
}

export function formatDhanDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
