import fs from 'fs';
import path from 'path';
import { BrokerAdapter } from './BrokerAdapter';
import { DhanAdapter } from './dhan/DhanAdapter';
import { BrokerName, BrokerCredentials, BrokerAccountProfile, BrokerStatus } from './types';
import { encryptToken, decryptToken, maskIdentifier } from '../security/encryption';
import { logger } from '../utils/logger';
import { brokerStorageFile } from './brokerStorage';
import { DhanAuthService } from './dhan/auth';

export interface StoredBrokerConnection {
  id: string;
  userId: string;
  broker: BrokerName;
  clientId: string;
  maskedClientId: string;
  accountName: string;
  status: BrokerStatus;
  terminalActivated: boolean;
  staticIp?: string;
  secondaryIp?: string;
  encryptedAccessToken: string;
  connectedAt: string;
  lastHeartbeat: string;
  dataPlan?: string;
  tokenValidity?: string;
}

export class BrokerRegistry {
  private static instance: BrokerRegistry;
  private adapters: Map<string, BrokerAdapter> = new Map();
  private storageFile: string;
  private readonly ready: Promise<void>;

  private constructor() {
    this.storageFile = brokerStorageFile();
    fs.mkdirSync(path.dirname(this.storageFile), { recursive: true });
    this.ready = this.loadPersistedConnections();
  }

  public whenReady(): Promise<void> { return this.ready; }

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

    const connectionKey = this.makeKey(userId, broker, clientId);
    // Save encrypted connection to disk
    try { this.persistConnection({
      id: connectionKey,
      userId,
      broker,
      clientId,
      maskedClientId: maskIdentifier(clientId),
      accountName: profile.accountName,
      status: 'Connected',
      terminalActivated: profile.terminalActivated,
      dataPlan: profile.dataPlan,
      tokenValidity: profile.tokenValidity,
      encryptedAccessToken: encryptToken(accessToken),
      connectedAt: profile.connectedAt.toISOString(),
      lastHeartbeat: new Date().toISOString()
    }); } catch (error) {
      await adapter.disconnect().catch(() => {});
      throw error;
    }
    this.adapters.set(connectionKey, adapter);

    return profile;
  }

  /**
   * Update metadata (e.g. staticIp, secondaryIp) for a stored connection
   */
  public updateConnectionMeta(userId: string, brokerId: string | undefined, meta: Partial<StoredBrokerConnection>): boolean {
    const list = this.readStorage();
    let updated = false;
    for (const c of list) {
      if (c.userId === userId && (!brokerId || c.id === brokerId || c.clientId === brokerId)) {
        Object.assign(c, meta);
        updated = true;
      }
    }
    if (updated) {
      this.writeStorage(list);
    }
    return updated;
  }

  /**
   * Disconnect and remove a broker connection with ownership validation
   */
  public async disconnectBroker(userId: string, brokerId: string): Promise<boolean> {
    const list = this.readStorage();
    
    const toRemove = list.filter(c => c.userId === userId && (c.id === brokerId || c.clientId === brokerId));

    for (const conn of toRemove) {
      const adapter = this.adapters.get(conn.id);
      if (adapter) {
        await adapter.disconnect().catch(() => {});
        this.adapters.delete(conn.id);
      }
    }

    const ids = new Set(toRemove.map(c => c.id));
    const remaining = list.filter(c => !ids.has(c.id));
    this.writeStorage(remaining);

    logger.info(`[BrokerRegistry] Broker ${brokerId} disconnected and purged completely from registry`);
    return true;
  }

  /**
   * Get active adapter instance strictly scoped to a specific user
   */
  public getAdapter(userId: string, broker: BrokerName = 'dhan'): BrokerAdapter | null {
    if (!userId) return null;

    // 1. Check in-memory adapters
    for (const [key, adapter] of this.adapters.entries()) {
      if (key.startsWith(`${userId}_${broker}_`) && adapter.getStatus()) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Get active adapter by connection id with strict ownership check
   */
  public getAdapterById(connectionId: string, userId?: string): BrokerAdapter | null {
    const owned = connectionId && userId
      ? this.readStorage().find(c => c.userId === userId && (c.id === connectionId || c.clientId === connectionId))
      : undefined;
    if (owned) {
      const adapter = this.adapters.get(owned.id);
      if (adapter?.getStatus()) return adapter;
    }
    return null;
  }

  /**
   * Get primary active broker adapter for a specific user
   */
  public getPrimaryAdapter(userId?: string): BrokerAdapter | null {
    return this.getAdapter(userId || 'user_admin', 'dhan');
  }

  /**
   * List broker connections strictly scoped to a specific user
   * (Sanitized, zero plaintext tokens, no cross-user leakage)
   */
  public listConnections(userId?: string): Omit<StoredBrokerConnection, 'encryptedAccessToken'>[] {
    const connections = this.readStorage();
    return connections.filter(c => c.userId === (userId || 'user_admin')).map(c => ({
        id: c.id,
        userId: c.userId,
        broker: c.broker,
        clientId: c.clientId,
        maskedClientId: c.maskedClientId || maskIdentifier(c.clientId),
        accountName: c.accountName,
        status: c.status,
        staticIp: c.staticIp,
        secondaryIp: c.secondaryIp,
        terminalActivated: c.status === 'Connected' && c.terminalActivated,
        dataPlan: c.dataPlan,
        tokenValidity: c.tokenValidity,
        connectedAt: c.connectedAt,
        lastHeartbeat: c.lastHeartbeat
    }));
  }

  public async listVerifiedConnections(userId: string): Promise<Omit<StoredBrokerConnection, 'encryptedAccessToken'>[]> {
    await this.whenReady();
    const rows = this.readStorage();
    for (const connection of rows.filter(c => c.userId === userId && c.broker === 'dhan')) {
      try {
        const accessToken = decryptToken(connection.encryptedAccessToken);
        const verified = await DhanAuthService.validateCredentials({
          clientId: connection.clientId, accessToken
        });
        connection.status = verified.success ? 'Connected' :
          verified.error?.includes('unreachable') ? 'Error' : 'Expired';
        connection.terminalActivated = verified.success;
        connection.dataPlan = verified.success ? verified.dataPlan : undefined;
        connection.tokenValidity = verified.success ? verified.tokenValidity : undefined;
        if (!verified.success && connection.status === 'Expired') {
          const adapter = this.adapters.get(connection.id);
          if (adapter) await adapter.disconnect().catch(() => {});
          this.adapters.delete(connection.id);
        }
      } catch {
        connection.status = 'Expired';
        connection.terminalActivated = false;
      }
    }
    this.writeStorage(rows);
    return this.listConnections(userId);
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
      throw new Error('Broker connection could not be saved. Check persistent server storage.');
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
            const profile = await adapter.connect({
              clientId: conn.clientId,
              accessToken: rawToken
            });
            this.adapters.set(conn.id, adapter);
            conn.status = 'Connected';
            conn.dataPlan = profile.dataPlan;
            conn.tokenValidity = profile.tokenValidity;
            this.persistConnection(conn);
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
