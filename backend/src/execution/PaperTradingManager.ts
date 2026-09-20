import { PaperExecutor } from './PaperExecutor';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class PaperTradingManager {
  private static instance: PaperTradingManager;
  private executors: Map<string, PaperExecutor> = new Map();
  private io: any = null;

  private constructor() {
    const dataDir = path.join(__dirname, '../../data/paper-trading');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  public static getInstance(): PaperTradingManager {
    if (!PaperTradingManager.instance) {
      PaperTradingManager.instance = new PaperTradingManager();
    }
    return PaperTradingManager.instance;
  }

  public setSocketIO(io: any): void {
    this.io = io;
    // Attach socket listeners to all existing executors
    for (const [userId, executor] of this.executors.entries()) {
      this.wireExecutorEvents(userId, executor);
    }
  }

  private wireExecutorEvents(userId: string, executor: PaperExecutor): void {
    if (!this.io) return;

    executor.removeAllListeners('orderFilled');
    executor.removeAllListeners('positionUpdated');
    executor.removeAllListeners('portfolioUpdated');

    executor.on('orderFilled', (order) => {
      // Emit strictly to the user's private socket room
      this.io.to(`user_${userId}`).emit('paper_order_filled', order);
      // Also broadcast if user is default for legacy compatibility
      if (userId === 'default') {
        this.io.emit('paper_order_filled', order);
      }
    });

    executor.on('positionUpdated', (position) => {
      this.io.to(`user_${userId}`).emit('paper_position_updated', position);
      if (userId === 'default') {
        this.io.emit('paper_position_updated', position);
      }
    });

    executor.on('portfolioUpdated', (portfolio) => {
      this.io.to(`user_${userId}`).emit('paper_portfolio_updated', portfolio);
      if (userId === 'default') {
        this.io.emit('paper_portfolio_updated', portfolio);
      }
    });
  }

  /**
   * Get or create a dedicated PaperExecutor for a specific user
   */
  public getExecutor(userId: string = 'default'): PaperExecutor {
    const effectiveUserId = userId || 'default';
    let executor = this.executors.get(effectiveUserId);

    if (!executor) {
      executor = new PaperExecutor(100000, effectiveUserId);
      this.executors.set(effectiveUserId, executor);
      this.wireExecutorEvents(effectiveUserId, executor);
      logger.info(`Initialized isolated PaperExecutor for user: ${effectiveUserId}`);
    }

    return executor;
  }
}

export const paperTradingManager = PaperTradingManager.getInstance();
