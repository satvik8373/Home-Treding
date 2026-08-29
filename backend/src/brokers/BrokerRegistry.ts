import fs from 'fs';
import path from 'path';
import { BrokerAdapter } from './BrokerAdapter';
import { DhanAdapter } from './dhan/DhanAdapter';
import { BrokerName, BrokerCredentials, BrokerAccountProfile, BrokerStatus } from './types';
import { encryptToken, decryptToken, maskIdentifier } from '../security/encryption';
import { logger } from '../utils/logger';

export interface StoredBrokerConnection {
  id: string;
  userId: string;
  broker: BrokerName;
  clientId: string;
  maskedClientId: string;
  accountName: string;
  status: BrokerStatus;
  terminalActivated: boolean;
  encryptedAccessToken: string;
  connectedAt: string;
  lastHeartbeat: string;
}

export class BrokerRegistry {
  private static instance: BrokerRegistry;
  private adapters: Map<string, BrokerAdapter> = new Map();
  private storageFile: string;

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.storageFile = path.join(dataDir, 'broker-connections.json');
    this.loadPersistedConnections();
  }

  public static getInstance(): BrokerRegistry {
    if (!BrokerRegistry.instance) {
      BrokerRegistry.instance = new BrokerRegistry();
    }
    return BrokerRegistry.instance;
  }

  /**
   * Register and connect a new broker instance
   */
  public async connectBroker(params: {
    userId: string;
    broker: BrokerName;
    clientId: string;
    accessToken: string;
  }): Promise<BrokerAccountProfile> {
    const { userId, broker, clientId, accessToken } = params;

    let adapter: BrokerAdapter;
    if (broker === 'dhan') {
      adapter = new DhanAdapter();
    } else {
      throw new Error(`Broker "${broker}" is not supported yet.`);
    }

    // Connect to broker
    const profile = await adapter.connect({ clientId, accessToken });

    // Store in active adapter map
    const connectionKey = this.makeKey(userId, broker, clientId);
    this.adapters.set(connectionKey, adapter);

    // Save encrypted connection to disk
    this.persistConnection({
      id: connectionKey,
      userId,
      broker,
      clientId,
      maskedClientId: maskIdentifier(clientId),
      accountName: profile.accountName,
      status: 'Connected',
      terminalActivated: profile.terminalActivated,
      encryptedAccessToken: encryptToken(accessToken),
      connectedAt: profile.connectedAt.toISOString(),
      lastHeartbeat: new Date().toISOString()
    });

    return profile;
  }

  /**
   * Disconnect and remove a broker connection
   */
  public async disconnectBroker(userId: string, brokerId: string): Promise<boolean> {
    const adapter = this.adapters.get(brokerId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(brokerId);
    }

    this.removePersistedConnection(brokerId);
    return true;
  }

  /**
   * Get active adapter instance
   */
  public getAdapter(userId: string, broker: BrokerName = 'dhan'): BrokerAdapter | null {
    // Find active connection for user
    for (const [key, adapter] of this.adapters.entries()) {
      if (key.startsWith(`${userId}_${broker}`)) {
        return adapter;
      }
    }
    // Fallback: search any active dhan adapter if userId not supplied
    for (const [, adapter] of this.adapters.entries()) {
      if (adapter.name === broker && adapter.getStatus()) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Get active adapter by connection id
   */
  public getAdapterById(connectionId: string): BrokerAdapter | null {
    return this.adapters.get(connectionId) || null;
  }

  /**
   * Get primary active broker adapter
   */
  public getPrimaryAdapter(): BrokerAdapter | null {
    for (const [, adapter] of this.adapters.entries()) {
      if (adapter.getStatus()) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * List all stored broker connections (sanitized, zero plaintext tokens)
   */
  public listConnections(userId?: string): Omit<StoredBrokerConnection, 'encryptedAccessToken'>[] {
    const connections = this.readStorage();
    const filtered = userId ? connections.filter(c => c.userId === userId) : connections;

    return filtered.map(c => {
      const adapter = this.adapters.get(c.id);
      const isLive = adapter ? adapter.getStatus() : false;

      return {
        id: c.id,
        userId: c.userId,
        broker: c.broker,
        clientId: c.clientId,
        maskedClientId: c.maskedClientId || maskIdentifier(c.clientId),
        accountName: c.accountName,
        status: isLive ? 'Connected' : 'Disconnected',
        terminalActivated: isLive ? c.terminalActivated : false,
        connectedAt: c.connectedAt,
        lastHeartbeat: c.lastHeartbeat
      };
    });
  }

  private makeKey(userId: string, broker: string, clientId: string): string {
    return `${userId || 'default'}_${broker}_${clientId}`;
  }

  private persistConnection(conn: StoredBrokerConnection): void {
    const list = this.readStorage();
    const index = list.findIndex(c => c.id === conn.id);
    if (index >= 0) {
      list[index] = conn;
    } else {
      list.push(conn);
    }
    this.writeStorage(list);
  }

  private removePersistedConnection(connectionId: string): void {
    const list = this.readStorage();
    const filtered = list.filter(c => c.id !== connectionId);
    this.writeStorage(filtered);
  }

  private readStorage(): StoredBrokerConnection[] {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      logger.error('Failed to read broker connections storage', e);
    }
    return [];
  }

  private writeStorage(list: StoredBrokerConnection[]): void {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      logger.error('Failed to write broker connections storage', e);
    }
  }

  /**
   * Rehydrate connections on server restart
   */
  private async loadPersistedConnections(): Promise<void> {
    const connections = this.readStorage();
    for (const conn of connections) {
      if (conn.broker === 'dhan' && conn.encryptedAccessToken) {
        try {
          const rawToken = decryptToken(conn.encryptedAccessToken);
          if (rawToken) {
            const adapter = new DhanAdapter();
            await adapter.connect({
              clientId: conn.clientId,
              accessToken: rawToken
            });
            this.adapters.set(conn.id, adapter);
            logger.info(`🔄 [BrokerRegistry] Rehydrated connection for Dhan: ${conn.maskedClientId}`);
          }
        } catch (err: any) {
          logger.warn(`⚠️ [BrokerRegistry] Rehydration failed for ${conn.maskedClientId}:`, err.message);
          conn.status = 'Disconnected';
          this.persistConnection(conn);
        }
      }
    }
  }
}

export const brokerRegistry = BrokerRegistry.getInstance();
