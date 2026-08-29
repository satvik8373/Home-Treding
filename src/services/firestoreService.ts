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
    try {
      const brokerageRef = doc(collection(db, 'brokerages'));
      await setDoc(brokerageRef, {
        ...data,
        userId,
        createdAt: serverTimestamp()
      });
      return brokerageRef.id;
    } catch (e) {
      console.warn('Firestore addBrokerage note:', e);
      return `temp_${Date.now()}`;
    }
  }

  async getBrokerages(userId: string): Promise<Brokerage[]> {
    try {
      const q = query(
        collection(db, 'brokerages'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brokerage));
    } catch (e) {
      console.warn('Firestore getBrokerages note (check security rules):', e);
      return [];
    }
  }

  async updateBrokerage(brokerageId: string, data: Partial<Brokerage>) {
    try {
      const brokerageRef = doc(db, 'brokerages', brokerageId);
      await updateDoc(brokerageRef, {
        ...data,
        lastSynced: serverTimestamp()
      });
    } catch (e) {
      console.warn('Firestore updateBrokerage note:', e);
    }
  }

  async deleteBrokerage(brokerageId: string) {
    try {
      await deleteDoc(doc(db, 'brokerages', brokerageId));
    } catch (e) {
      console.warn('Firestore deleteBrokerage note:', e);
    }
  }

  // Strategy methods
  async addStrategy(userId: string, data: Omit<Strategy, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    try {
      const strategyRef = doc(collection(db, 'strategies'));
      await setDoc(strategyRef, {
        ...data,
        userId,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return strategyRef.id;
    } catch (e) {
      console.warn('Firestore addStrategy note:', e);
      return `strat_${Date.now()}`;
    }
  }

  async getStrategies(userId: string): Promise<Strategy[]> {
    try {
      const q = query(
        collection(db, 'strategies'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Strategy));
      return strategies.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (e) {
      console.warn('Firestore getStrategies note (check security rules):', e);
      return [];
    }
  }

  async getStrategy(strategyId: string): Promise<Strategy | null> {
    try {
      const docSnap = await getDoc(doc(db, 'strategies', strategyId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Strategy;
      }
    } catch (e) {
      console.warn('Firestore getStrategy note:', e);
    }
    return null;
  }

  async updateStrategy(strategyId: string, data: Partial<Strategy>) {
    try {
      const strategyRef = doc(db, 'strategies', strategyId);
      await updateDoc(strategyRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Firestore updateStrategy note:', e);
    }
  }

  async deleteStrategy(strategyId: string) {
    try {
      await deleteDoc(doc(db, 'strategies', strategyId));
    } catch (e) {
      console.warn('Firestore deleteStrategy note:', e);
    }
  }

  // Trade methods
  async addTrade(userId: string, data: Omit<Trade, 'id' | 'userId' | 'createdAt'>) {
    try {
      const tradeRef = doc(collection(db, 'trades'));
      await setDoc(tradeRef, {
        ...data,
        userId,
        createdAt: serverTimestamp()
      });
      return tradeRef.id;
    } catch (e) {
      console.warn('Firestore addTrade note:', e);
      return `trade_${Date.now()}`;
    }
  }

  async getTrades(userId: string, filters?: { strategyId?: string; status?: string }): Promise<Trade[]> {
    try {
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
      return trades.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (e) {
      console.warn('Firestore getTrades note (check security rules):', e);
      return [];
    }
  }

  async updateTrade(tradeId: string, data: Partial<Trade>) {
    try {
      const tradeRef = doc(db, 'trades', tradeId);
      await updateDoc(tradeRef, data);
    } catch (e) {
      console.warn('Firestore updateTrade note:', e);
    }
  }

  // Notification methods
  async addNotification(userId: string, data: {
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      const notificationRef = doc(collection(db, 'notifications'));
      await setDoc(notificationRef, {
        ...data,
        userId,
        isRead: false,
        createdAt: serverTimestamp()
      });
      return notificationRef.id;
    } catch (e) {
      console.warn('Firestore addNotification note:', e);
      return `notif_${Date.now()}`;
    }
  }

  async getNotifications(userId: string) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return notifications.sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (e) {
      console.warn('Firestore getNotifications note:', e);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string) {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { isRead: true });
    } catch (e) {
      console.warn('Firestore markNotificationAsRead note:', e);
    }
  }
}

export default new FirestoreService();
