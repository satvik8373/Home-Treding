import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface UserRecord {
  id: string;
  uid: string;
  email: string;
  name: string;
  phone?: string;
  passwordHash?: string;
  subscriptionPlan: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export class UserStore {
  private static instance: UserStore;
  private storageFile: string;
  private users: Map<string, UserRecord> = new Map(); // uid -> UserRecord

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.storageFile = path.join(dataDir, 'users.json');
    this.loadUsers();
  }

  public static getInstance(): UserStore {
    if (!UserStore.instance) {
      UserStore.instance = new UserStore();
    }
    return UserStore.instance;
  }

  private loadUsers(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf8');
        const list: UserRecord[] = JSON.parse(raw);
        for (const user of list) {
          this.users.set(user.uid, user);
        }
        logger.info(`Loaded ${this.users.size} registered users from storage`);
      }
    } catch (err: any) {
      logger.error('Failed to load users from storage:', err.message);
    }
  }

  private saveUsers(): void {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(this.storageFile, JSON.stringify(list, null, 2), 'utf8');
    } catch (err: any) {
      logger.error('Failed to persist users to storage:', err.message);
    }
  }

  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 32).toString('hex');
    return `${salt}:${hash}`;
  }

  public verifyPassword(password: string, storedHash?: string): boolean {
    if (!storedHash) return false;
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const calculatedHash = crypto.scryptSync(password, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(calculatedHash, 'hex'));
  }

  public findByUid(uid: string): UserRecord | null {
    return this.users.get(uid) || null;
  }

  public findByEmail(email: string): UserRecord | null {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase().trim() === normalized) {
        return user;
      }
    }
    return null;
  }

  public createUser(params: {
    uid?: string;
    email: string;
    name?: string;
    password?: string;
    phone?: string;
  }): UserRecord {
    const email = params.email.toLowerCase().trim();
    const uid = params.uid || 'user_' + crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();

    const user: UserRecord = {
      id: uid,
      uid,
      email,
      name: params.name || email.split('@')[0],
      phone: params.phone || '',
      passwordHash: params.password ? this.hashPassword(params.password) : undefined,
      subscriptionPlan: 'free',
      isActive: true,
      isVerified: true,
      createdAt: now,
      updatedAt: now
    };

    this.users.set(uid, user);
    this.saveUsers();
    logger.info(`Registered user: ${email} (${uid})`);
    return user;
  }

  public updateUser(uid: string, updates: Partial<UserRecord>): UserRecord | null {
    const user = this.users.get(uid);
    if (!user) return null;

    const updated: UserRecord = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.users.set(uid, updated);
    this.saveUsers();
    return updated;
  }

  public sanitize(user: UserRecord): Omit<UserRecord, 'passwordHash'> {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

export const userStore = UserStore.getInstance();
