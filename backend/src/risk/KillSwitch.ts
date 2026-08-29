import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface KillSwitchStatus {
  isHalted: boolean;
  haltedAt?: Date;
  haltReason?: string;
  autoSquareOff: boolean;
}

export class KillSwitchController extends EventEmitter {
  private static instance: KillSwitchController;
  private isHalted: boolean = false;
  private haltedAt?: Date;
  private haltReason?: string;

  private constructor() {
    super();
  }

  public static getInstance(): KillSwitchController {
    if (!KillSwitchController.instance) {
      KillSwitchController.instance = new KillSwitchController();
    }
    return KillSwitchController.instance;
  }

  /**
   * Trigger Global Emergency Stop
   */
  public activate(reason: string = 'User Emergency Stop Triggered', autoSquareOff: boolean = false): KillSwitchStatus {
    this.isHalted = true;
    this.haltedAt = new Date();
    this.haltReason = reason;

    logger.warn(`🛑 [KILL SWITCH ACTIVATED] Reason: ${reason}, AutoSquareOff: ${autoSquareOff}`);
    this.emit('halted', {
      isHalted: true,
      haltedAt: this.haltedAt,
      haltReason: this.haltReason,
      autoSquareOff
    });

    return this.getStatus();
  }

  /**
   * Reset Kill Switch and resume normal operation
   */
  public reset(): KillSwitchStatus {
    this.isHalted = false;
    this.haltedAt = undefined;
    this.haltReason = undefined;

    logger.info('🟢 [KILL SWITCH RESET] Trading automation resumed');
    this.emit('resumed');

    return this.getStatus();
  }

  public getStatus(): KillSwitchStatus {
    return {
      isHalted: this.isHalted,
      haltedAt: this.haltedAt,
      haltReason: this.haltReason,
      autoSquareOff: false
    };
  }

  public isTradingBlocked(): boolean {
    return this.isHalted;
  }
}

export const killSwitch = KillSwitchController.getInstance();
