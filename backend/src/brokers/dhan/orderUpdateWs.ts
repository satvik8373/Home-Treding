/**
 * DhanHQ v2 Live Order Update WebSocket Client
 * Streams real-time order lifecycle events directly from Dhan
 * Reference: https://dhanhq.co/docs/v2/order-update/
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { DHAN_CONFIG } from './config';
import { logger } from '../../utils/logger';

export class DhanOrderUpdateWsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private clientId: string;
  private accessToken: string;
  private isConnected: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;

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

      try {
        const wsUrl = `${DHAN_CONFIG.ORDER_UPDATE_WS_URL}?token=${this.accessToken}&clientId=${this.clientId}&authType=2`;

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          logger.info('✅ [Dhan Order Update WS] Connected to live order feed');
          this.emit('connected');

          this.startHeartbeat();
          resolve(true);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const parsed = JSON.parse(data.toString());
            this.emit('orderUpdate', parsed);
          } catch (e) {
            // Ignored
          }
        });

        this.ws.on('error', (err: Error) => {
          logger.warn('[Dhan Order Update WS Notice]', err.message);
          if (this.listenerCount('error') > 0) {
            this.emit('error', err);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason: reason.toString() });
          this.scheduleReconnect();
          resolve(false);
        });
      } catch (err: any) {
        logger.warn('[Dhan Order Update WS Connect Error]', err.message);
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

    const backoffDelay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 60000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, backoffDelay);
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}
