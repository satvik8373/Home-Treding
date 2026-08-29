/**
 * DhanHQ v2 Postback & Webhook Event Receiver
 * Processes real-time order lifecycle events pushed by DhanHQ
 * Reference: https://dhanhq.co/docs/v2/postback/
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface DhanPostbackPayload {
  dhanClientId: string;
  orderId: string;
  correlationId?: string;
  orderStatus: 'TRANSIT' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'TRADED' | 'EXPIRED';
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: string;
  productType: string;
  orderType: string;
  validity: string;
  securityId: string;
  quantity: number;
  price: number;
  triggerPrice?: number;
  tradedQuantity?: number;
  tradedPrice?: number;
  createTime: string;
  updateTime: string;
  remarks?: string;
}

export class DhanPostbackService extends EventEmitter {
  private static instance: DhanPostbackService;

  private constructor() {
    super();
  }

  public static getInstance(): DhanPostbackService {
    if (!DhanPostbackService.instance) {
      DhanPostbackService.instance = new DhanPostbackService();
    }
    return DhanPostbackService.instance;
  }

  /**
   * Process incoming webhook payload from Dhan
   */
  public processWebhook(payload: DhanPostbackPayload): void {
    logger.info(`📥 [Dhan Postback] Order ${payload.orderId} (${payload.securityId}) ➔ ${payload.orderStatus}`);
    
    this.emit('orderUpdate', payload);

    if (payload.orderStatus === 'TRADED') {
      this.emit('orderTraded', payload);
    } else if (payload.orderStatus === 'REJECTED') {
      this.emit('orderRejected', payload);
    } else if (payload.orderStatus === 'CANCELLED') {
      this.emit('orderCancelled', payload);
    }
  }
}

export const dhanPostbackService = DhanPostbackService.getInstance();
