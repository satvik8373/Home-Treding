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

export class DhanHistoricalDataService {
  private http: AxiosInstance;

  constructor(auth: DhanAuthContext) {
    this.http = axios.create({
      baseURL: DHAN_CONFIG.BASE_URL,
      timeout: 20_000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'access-token': auth.accessToken,
        'client-id': auth.clientId
      }
    });
  }

  static resolveAuth(): DhanAuthContext | null {
    const envToken = process.env.DHAN_ACCESS_TOKEN;
    const envClient = process.env.DHAN_CLIENT_ID;
    if (envToken && envClient) return { accessToken: envToken, clientId: envClient };

    const registry = BrokerRegistry.getInstance();
    const adapter = registry.getPrimaryAdapter() || registry.getAdapter('default', 'dhan');
    if (adapter && adapter.getStatus()) {
      const creds = adapter.getCredentials();
      if (creds?.accessToken && creds?.clientId) {
        return { accessToken: creds.accessToken, clientId: creds.clientId };
      }
    }

    const connections = registry.listConnections();
    const dhanConn = connections.find((c) => c.broker === 'dhan' && c.status === 'Connected');
    if (!dhanConn) return null;

    const clientId = dhanConn.clientId;
    let accessToken: string | null = null;

    const storageFile = path.join(__dirname, '../../data/broker-connections.json');
    if (fs.existsSync(storageFile)) {
      try {
        const rawList: any[] = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
        const fullConn = rawList.find((c) => c.id === dhanConn.id);
        if (fullConn?.encryptedAccessToken) accessToken = decryptToken(fullConn.encryptedAccessToken);
      } catch (_) {}
    }

    if (!accessToken || !clientId) return null;
    return { accessToken, clientId };
  }

  async getIntradayCandles(params: {
    securityId: string;
    exchangeSegment: ExchangeSegment;
    instrument: string;
    fromDate: string;
    toDate: string;
    interval?: 1 | 5 | 15 | 25 | 60;
    oi?: boolean;
  }): Promise<Candle[]> {
    const response = await this.http.post('/charts/intraday', {
      securityId: params.securityId,
      exchangeSegment: params.exchangeSegment,
      instrument: params.instrument,
      interval: String(params.interval ?? 5),
      oi: params.oi ?? false,
      fromDate: params.fromDate,
      toDate: params.toDate
    });
    return this.parseCandleResponse(response.data);
  }

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
      throw new Error('FRESH_DHAN_DATA_UNAVAILABLE: /charts/intraday returned no candles');
    }

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = Number(timestamps[i]);
      const candle: Candle = {
        timestamp: ts, isoTime: this.toISTIso(ts), date: this.toISTDate(ts),
        time: this.toISTTime(ts), open: Number(open[i]), high: Number(high[i]),
        low: Number(low[i]), close: Number(close[i]), volume: Number(volume[i] ?? 0)
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

    if (!root) throw new Error('FRESH_DHAN_DATA_UNAVAILABLE: /charts/rollingoption returned no option data');

    const timestamps: any[] = root.timestamp ?? root.start_Time ?? [];
    if (!Array.isArray(timestamps) || timestamps.length === 0) {
      throw new Error('FRESH_DHAN_DATA_UNAVAILABLE: /charts/rollingoption returned no candles');
    }

    const open = root.open ?? []; const high = root.high ?? []; const low = root.low ?? [];
    const close = root.close ?? []; const volume = root.volume ?? []; const oi = root.oi ?? [];
    const iv = root.iv ?? []; const strike = root.strike ?? []; const spot = root.spot ?? [];

    const result: OptionCandle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = Number(timestamps[i]);
      const candle: OptionCandle = {
        timestamp: ts, isoTime: this.toISTIso(ts), date: this.toISTDate(ts),
        time: this.toISTTime(ts), open: Number(open[i]), high: Number(high[i]),
        low: Number(low[i]), close: Number(close[i]), volume: Number(volume[i] ?? 0),
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

export function chunkDateRange(startDate: Date, endDate: Date, maxDaysPerChunk = 85): Array<{ fromDate: Date; toDate: Date }> {
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