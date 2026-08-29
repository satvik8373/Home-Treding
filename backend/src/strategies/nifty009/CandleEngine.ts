import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface Candle {
  startTime: string; // ISO String
  endTime: string;   // ISO String
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

/**
 * 5-Minute Candle Engine for NIFTY 50 Index.
 * Builds standard 5-minute candles aligned to IST clock (09:15-09:20, 09:20-09:25, etc.)
 */
export class CandleEngine extends EventEmitter {
  private currentCandle: Candle | null = null;
  private completedCandles: Candle[] = [];
  private candleIntervalMinutes = 5;

  /**
   * Get the start timestamp of the 5-minute bucket for a given Date
   */
  public getBucketStartTime(date: Date): Date {
    const d = new Date(date);
    const minutes = d.getMinutes();
    const bucketMinute = Math.floor(minutes / this.candleIntervalMinutes) * this.candleIntervalMinutes;
    d.setMinutes(bucketMinute, 0, 0);
    return d;
  }

  /**
   * Get the end timestamp of the 5-minute bucket
   */
  public getBucketEndTime(bucketStart: Date): Date {
    return new Date(bucketStart.getTime() + this.candleIntervalMinutes * 60 * 1000);
  }

  /**
   * Process an incoming price tick
   */
  public processTick(price: number, volume: number = 0, timestamp: Date = new Date()): void {
    if (price <= 0) return;

    const bucketStart = this.getBucketStartTime(timestamp);
    const bucketEnd = this.getBucketEndTime(bucketStart);
    const bucketStartIso = bucketStart.toISOString();

    if (!this.currentCandle || this.currentCandle.startTime !== bucketStartIso) {
      // If we have an existing candle from a previous bucket, close it first
      if (this.currentCandle && !this.currentCandle.isClosed) {
        this.currentCandle.isClosed = true;
        this.completedCandles.push({ ...this.currentCandle });
        this.emit('candle:closed', { ...this.currentCandle });
        logger.info(`[CandleEngine] 5m Candle Closed: O=${this.currentCandle.open} H=${this.currentCandle.high} L=${this.currentCandle.low} C=${this.currentCandle.close} (${this.currentCandle.startTime})`);
      }

      // Initialize new candle bucket
      this.currentCandle = {
        startTime: bucketStartIso,
        endTime: bucketEnd.toISOString(),
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume,
        isClosed: false
      };
      this.emit('candle:opened', { ...this.currentCandle });
    } else {
      // Update running candle
      this.currentCandle.high = Math.max(this.currentCandle.high, price);
      this.currentCandle.low = Math.min(this.currentCandle.low, price);
      this.currentCandle.close = price;
      this.currentCandle.volume += volume;
      this.emit('candle:updated', { ...this.currentCandle });
    }
  }

  /**
   * Force close the current candle (e.g. at square-off time or manual trigger)
   */
  public forceCloseCurrent(): Candle | null {
    if (this.currentCandle && !this.currentCandle.isClosed) {
      this.currentCandle.isClosed = true;
      this.completedCandles.push({ ...this.currentCandle });
      this.emit('candle:closed', { ...this.currentCandle });
      const closed = { ...this.currentCandle };
      this.currentCandle = null;
      return closed;
    }
    return null;
  }

  public getCurrentCandle(): Candle | null {
    return this.currentCandle ? { ...this.currentCandle } : null;
  }

  public getCompletedCandles(): Candle[] {
    return [...this.completedCandles];
  }

  public getFirstCandle(): Candle | null {
    return this.completedCandles.length > 0 ? this.completedCandles[0] : null;
  }

  public reset(): void {
    this.currentCandle = null;
    this.completedCandles = [];
  }
}
