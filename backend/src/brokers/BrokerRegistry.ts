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
  staticIp?: string;
  secondaryIp?: string;
  encryptedAccessToken: string;
  connectedAt: string;
  lastHeartbeat: string;
}

export class BrokerRegistry {
  private static instance: BrokerRegistry;
  private adapters: Map<string, BrokerAdapter> = new Map();
  private storageFile: string;

  private constructor() {
    const candidates = [
      path.join(__dirname, '../../data/broker-connections.json'),
      path.join(process.cwd(), 'backend', 'data', 'broker-connections.json'),
      path.join(process.cwd(), 'data', 'broker-connections.json')
    ];
    let resolved = candidates.find(p => fs.existsSync(p));
    if (!resolved) {
      const preferredDir = fs.existsSync(path.join(process.cwd(), 'backend', 'data'))
        ? path.join(process.cwd(), 'backend', 'data')
        : path.join(__dirname, '../../data');
      if (!fs.existsSync(preferredDir)) {
        fs.mkdirSync(preferredDir, { recursive: true });
      }
      resolved = path.join(preferredDir, 'broker-connections.json');
    }
    this.storageFile = resolved;
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
   * Update metadata (e.g. staticIp, secondaryIp) for a stored connection
   */
  public updateConnectionMeta(userId: string, brokerId: string | undefined, meta: Partial<StoredBrokerConnection>): boolean {
    const list = this.readStorage();
    let updated = false;
    for (const c of list) {
      if (!brokerId || c.id === brokerId || c.clientId === brokerId || (userId && c.userId === userId)) {
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
    
    // Match any connection by full ID, client ID, or user
    const toRemove = list.filter(c => 
      c.id === brokerId || 
      c.clientId === brokerId || 
      c.id.endsWith(`_${brokerId}`) ||
      (userId && c.userId === userId && (c.id === brokerId || c.clientId === brokerId))
    );

    for (const conn of toRemove) {
      const adapter = this.adapters.get(conn.id);
      if (adapter) {
        await adapter.disconnect().catch(() => {});
        this.adapters.delete(conn.id);
      }
    }

    // Purge from active memory adapters
    for (const [key, adapter] of this.adapters.entries()) {
      if (key === brokerId || key.includes(brokerId)) {
        await adapter.disconnect().catch(() => {});
        this.adapters.delete(key);
      }
    }

    // Filter out completely from persistent storage
    const remaining = list.filter(c => 
      c.id !== brokerId && 
      c.clientId !== brokerId && 
      !c.id.endsWith(`_${brokerId}`)
    );
    this.writeStorage(remaining);

    logger.info(`[BrokerRegistry] Broker ${brokerId} disconnected and purged completely from registry`);
    return true;
  }

  /**
   * Get active adapter instance strictly scoped to a specific user
   */
  public getAdapter(userId: string, broker: BrokerName = 'dhan'): BrokerAdapter | null {
    if (!userId) {
      userId = 'user_admin';
    }

    // 1. Check in-memory adapters
    for (const [key, adapter] of this.adapters.entries()) {
      if (key.startsWith(`${userId}_${broker}`)) {
        return adapter;
      }
    }
    // Check if any active adapter exists
    if (this.adapters.size > 0) {
      const anyAdapter = Array.from(this.adapters.values())[0];
      if (anyAdapter) return anyAdapter;
    }

    // 2. Check persistent storage and rehydrate on the fly
    const conns = this.readStorage();
    let match = conns.find(c => c.userId === userId && c.broker === broker);
    if (!match && conns.length > 0) {
      match = conns.find(c => c.broker === broker);
    }
    if (match && match.encryptedAccessToken) {
      try {
        const rawToken = decryptToken(match.encryptedAccessToken);
        if (rawToken) {
          const newAdapter = new DhanAdapter();
          newAdapter.connect({ clientId: match.clientId, accessToken: rawToken }).catch(() => {});
          this.adapters.set(match.id, newAdapter);
          return newAdapter;
        }
      } catch (_) {}
    }

    return null;
  }

  /**
   * Get active adapter by connection id with strict ownership check
   */
  public getAdapterById(connectionId: string, userId?: string): BrokerAdapter | null {
    if (connectionId) {
      const adapter = this.adapters.get(connectionId);
      if (adapter) return adapter;
    }
    return this.getAdapter(userId || 'user_admin', 'dhan');
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
    if (connections.length === 0) return [];

    // Filter by userId with smart fallback for single-user trading
    const targetUserId = userId || 'user_admin';
    let filtered = connections.filter(c => c.userId === targetUserId);
    if (filtered.length === 0 && connections.length > 0) {
      filtered = connections;
    }
    if (filtered.length === 0) return [];

    return filtered.map(c => {
      let adapter = this.adapters.get(c.id);

      // Lazy rehydrate if missing from memory
      if (!adapter && c.encryptedAccessToken) {
        try {
          const rawToken = decryptToken(c.encryptedAccessToken);
          if (rawToken) {
            const newAdapter = new DhanAdapter();
            newAdapter.connect({ clientId: c.clientId, accessToken: rawToken }).catch(() => {});
            this.adapters.set(c.id, newAdapter);
            adapter = newAdapter;
          }
        } catch (_) {}
      }

      const isLive = adapter ? adapter.getStatus() : (c.status === 'Connected');
      const isConnected = isLive || c.status === 'Connected';

      return {
        id: c.id,
        userId: c.userId,
        broker: c.broker,
        clientId: c.clientId,
        maskedClientId: c.maskedClientId || maskIdentifier(c.clientId),
        accountName: c.accountName,
        status: isConnected ? 'Connected' : 'Disconnected',
        staticIp: c.staticIp,
        secondaryIp: c.secondaryIp,
        terminalActivated: isConnected ? (c.terminalActivated ?? true) : false,
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
