import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Brokerage {
  id: string;
  userId: string;
  brokerName: string;
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  isActive: boolean;
  lastSynced?: any;
  createdAt: any;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description: string;
  instrumentType: string;
  symbol: string;
  timeframe: string;
  entryRule: string;
  exitRule: string;
  stopLossPercent: number;
  targetPercent: number;
  positionSize: number;
  status: 'draft' | 'backtested' | 'live' | 'paused';
  createdAt: any;
  updatedAt: any;
}

export interface Trade {
  id: string;
  userId: string;
  strategyId?: string;
  symbol: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl?: number;
  status: 'open' | 'closed';
  createdAt: any;
}

class FirestoreService {
  // Brokerage methods
  async addBrokerage(userId: string, data: Omit<Brokerage, 'id' | 'userId' | 'createdAt'>) {
    const brokerageRef = doc(collection(db, 'brokerages'));
    await setDoc(brokerageRef, {
      ...data,
      userId,
      createdAt: serverTimestamp()
    });
    return brokerageRef.id;
  }

  async getBrokerages(userId: string): Promise<Brokerage[]> {
    const q = query(
      collection(db, 'brokerages'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brokerage));
  }

  async updateBrokerage(brokerageId: string, data: Partial<Brokerage>) {
    const brokerageRef = doc(db, 'brokerages', brokerageId);
    await updateDoc(brokerageRef, {
      ...data,
      lastSynced: serverTimestamp()
    });
  }

  async deleteBrokerage(brokerageId: string) {
    await deleteDoc(doc(db, 'brokerages', brokerageId));
  }

  // Strategy methods
  async addStrategy(userId: string, data: Omit<Strategy, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const strategyRef = doc(collection(db, 'strategies'));
    await setDoc(strategyRef, {
      ...data,
      userId,
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return strategyRef.id;
  }

  async getStrategies(userId: string): Promise<Strategy[]> {
    const q = query(
      collection(db, 'strategies'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Strategy));
    // Sort in memory instead of using Firestore orderBy (which requires index)
    return strategies.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }

  async getStrategy(strategyId: string): Promise<Strategy | null> {
    const docSnap = await getDoc(doc(db, 'strategies', strategyId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Strategy;
    }
    return null;
  }

  async updateStrategy(strategyId: string, data: Partial<Strategy>) {
    const strategyRef = doc(db, 'strategies', strategyId);
    await updateDoc(strategyRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteStrategy(strategyId: string) {
    await deleteDoc(doc(db, 'strategies', strategyId));
  }

  // Trade methods
  async addTrade(userId: string, data: Omit<Trade, 'id' | 'userId' | 'createdAt'>) {
    const tradeRef = doc(collection(db, 'trades'));
    await setDoc(tradeRef, {
      ...data,
      userId,
      createdAt: serverTimestamp()
    });
    return tradeRef.id;
  }

  async getTrades(userId: string, filters?: { strategyId?: string; status?: string }): Promise<Trade[]> {
    let q = query(
      collection(db, 'trades'),
      where('userId', '==', userId),
      limit(100)
    );

    if (filters?.strategyId) {
      q = query(q, where('strategyId', '==', filters.strategyId));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const snapshot = await getDocs(q);
    const trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
    // Sort in memory
    return trades.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }

  async updateTrade(tradeId: string, data: Partial<Trade>) {
    const tradeRef = doc(db, 'trades', tradeId);
    await updateDoc(tradeRef, data);
  }

  // Notification methods
  async addNotification(userId: string, data: {
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    const notificationRef = doc(collection(db, 'notifications'));
    await setDoc(notificationRef, {
      ...data,
      userId,
      isRead: false,
      createdAt: serverTimestamp()
    });
    return notificationRef.id;
  }

  async getNotifications(userId: string) {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      limit(50)
    );
    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort in memory
    return notifications.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }

  async markNotificationAsRead(notificationId: string) {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { isRead: true });
  }
}

export default new FirestoreService();
