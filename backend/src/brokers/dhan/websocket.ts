import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { DHAN_CONFIG } from './config';
import { MarketTick } from '../types';
import { logger } from '../../utils/logger';

export class DhanWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private clientId: string;
  private accessToken: string;
  private isConnected: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 3;
  private subscribedSymbols: Set<string> = new Set();
  private isConnecting: boolean = false;

  constructor(clientId: string, accessToken: string) {
    super();
    this.clientId = clientId;
    this.accessToken = accessToken;
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected && this.ws) {
        return resolve(true);
      }

      if (this.isConnecting) {
        return resolve(false);
      }

      this.isConnecting = true;

      try {
        const wsUrl = `${DHAN_CONFIG.WS_URL}?version=2&token=${this.accessToken}&clientId=${this.clientId}&authType=2`;

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          logger.info('✅ [Dhan WebSocket] Market stream ready');
          this.emit('connected');

          this.startHeartbeat();

          if (this.subscribedSymbols.size > 0) {
            this.resubscribeAll();
          }

          resolve(true);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (err: Error) => {
          this.isConnecting = false;
          logger.warn('[Dhan WebSocket Notice]', err.message);
          if (this.listenerCount('error') > 0) {
            this.emit('error', err);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.isConnected = false;
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason: reason.toString() });

          // Only reconnect if we have active symbols to watch
          if (this.subscribedSymbols.size > 0) {
            this.scheduleReconnect();
          }
          resolve(false);
        });
      } catch (err: any) {
        this.isConnecting = false;
        logger.warn('[Dhan WebSocket Connect Notice]', err.message);
        resolve(false);
      }
    });
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  public subscribe(symbols: string[]): void {
    symbols.forEach(s => this.subscribedSymbols.add(s));

    if (!this.isConnected) {
      this.connect().then(() => this.resubscribeAll());
      return;
    }

    if (!this.ws) return;

    try {
      const subscribePayload = {
        RequestCode: 15,
        InstrumentCount: symbols.length,
        InstrumentList: symbols.map(s => ({
          ExchangeSegment: 'NSE_EQ',
          SecurityId: s
        }))
      };

      this.ws.send(JSON.stringify(subscribePayload));
      logger.info(`📡 [Dhan WebSocket] Subscribed to ${symbols.length} instruments`);
    } catch (err: any) {
      logger.warn('[Dhan WebSocket] Subscribe failed:', err.message);
    }
  }

  public unsubscribe(symbols: string[]): void {
    symbols.forEach(s => this.subscribedSymbols.delete(s));

    if (!this.isConnected || !this.ws) return;

    try {
      const unsubscribePayload = {
        RequestCode: 16,
        InstrumentCount: symbols.length,
        InstrumentList: symbols.map(s => ({
          ExchangeSegment: 'NSE_EQ',
          SecurityId: s
        }))
      };

      this.ws.send(JSON.stringify(unsubscribePayload));
    } catch (err: any) {
      logger.warn('[Dhan WebSocket] Unsubscribe failed:', err.message);
    }
  }

  private resubscribeAll(): void {
    if (this.subscribedSymbols.size > 0 && this.isConnected && this.ws) {
      try {
        const symbols = Array.from(this.subscribedSymbols);
        const subscribePayload = {
          RequestCode: 15,
          InstrumentCount: symbols.length,
          InstrumentList: symbols.map(s => ({
            ExchangeSegment: 'NSE_EQ',
            SecurityId: s
          }))
        };
        this.ws.send(JSON.stringify(subscribePayload));
      } catch (e) {
        // Ignored
      }
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        this.processTick(parsed);
      } else if (Buffer.isBuffer(data)) {
        this.parseBinaryPacket(data);
      }
    } catch (err: any) {
      logger.warn('[Dhan WebSocket] Error parsing market packet:', err.message);
    }
  }

  private parseBinaryPacket(buffer: Buffer): void {
    if (buffer.length < 8) return;

    try {
      const responseCode = buffer.readInt8(0);
      if (responseCode === 2 || responseCode === 4) {
        const securityId = buffer.readInt32LE(4).toString();
        const ltp = buffer.readFloatLE(8);

        const tick: MarketTick = {
          symbol: securityId,
          securityId: securityId,
          exchange: 'NSE',
          ltp: Number(ltp.toFixed(2)),
          timestamp: new Date()
        };

        this.emit('tick', tick);
      }
    } catch (e) {
      // Ignored
    }
  }

  private processTick(data: any): void {
    if (!data) return;

    const tick: MarketTick = {
      symbol: data.symbol || data.securityId || 'UNKNOWN',
      securityId: data.securityId || data.symbol || '',
      exchange: data.exchange || 'NSE',
      ltp: Number(data.ltp || data.lastPrice || data.price || 0),
      open: data.open ? Number(data.open) : undefined,
      high: data.high ? Number(data.high) : undefined,
      low: data.low ? Number(data.low) : undefined,
      close: data.close ? Number(data.close) : undefined,
      volume: data.volume ? Number(data.volume) : undefined,
      timestamp: new Date()
    };

    this.emit('tick', tick);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        try {
          this.ws.ping();
        } catch (e) {
          // ignore
        }
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const backoffDelay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.subscribedSymbols.size > 0) {
        this.connect();
      }
    }, backoffDelay);
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}
