import fs from 'fs';
import path from 'path';
import { Candle, OptionCandle } from './DhanHistoricalDataService';
import { logger } from '../utils/logger';

export interface FreeHistoricalSession {
  date: string;
  symbol: string;
  atmStrike: number;
  spotCandles: Candle[];
  ceCandles1m: OptionCandle[];
  ceCandles5m: OptionCandle[];
  peCandles1m: OptionCandle[];
  peCandles5m: OptionCandle[];
  metadata?: {
    exchangeSegment?: string;
    source?: string;
    underlyingCloseAt915?: number;
    expiryDate?: string;
  };
}

export interface FreeHistoricalDataResult {
  spotCandles: Candle[];
  ceCandles1m: OptionCandle[];
  ceCandles5m: OptionCandle[];
  peCandles1m: OptionCandle[];
  peCandles5m: OptionCandle[];
  strikesByDate: Record<string, number>;
  dates: string[];
  provider: string;
}

export function getHistoricalOptionsDir(): string {
  const candidates = [
    path.join(__dirname, '../../data/historical-options'),
    path.join(process.cwd(), 'backend', 'data', 'historical-options'),
    path.join(process.cwd(), 'data', 'historical-options')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const defaultDir = candidates[0];
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

export class FreeHistoricalDataService {
  private static instance: FreeHistoricalDataService;

  static getInstance(): FreeHistoricalDataService {
    if (!FreeHistoricalDataService.instance) {
      FreeHistoricalDataService.instance = new FreeHistoricalDataService();
    }
    return FreeHistoricalDataService.instance;
  }

  getAvailableDates(symbol = 'NIFTY 50'): string[] {
    const dir = getHistoricalOptionsDir();
    if (!fs.existsSync(dir)) return [];
    const prefix = symbol.replace(/\s+/g, '_') + '_';
    const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.json'));
    const dates = files.map(f => {
      const match = f.match(/_(\d{4}-\d{2}-\d{2})\.json$/);
      return match ? match[1] : null;
    }).filter((d): d is string => Boolean(d));
    return dates.sort();
  }

  getAvailableSessions(symbol = 'NIFTY 50'): Array<{ date: string; atmStrike: number; spotCount: number; optionCount: number }> {
    const dir = getHistoricalOptionsDir();
    const dates = this.getAvailableDates(symbol);
    const prefix = symbol.replace(/\s+/g, '_') + '_';
    const sessions: Array<{ date: string; atmStrike: number; spotCount: number; optionCount: number }> = [];

    for (const d of dates) {
      try {
        const file = path.join(dir, `${prefix}${d}.json`);
        const content = JSON.parse(fs.readFileSync(file, 'utf8'));
        sessions.push({
          date: d,
          atmStrike: content.atmStrike || 0,
          spotCount: content.spotCandles?.length || 0,
          optionCount: (content.ceCandles1m?.length || 0) + (content.peCandles1m?.length || 0)
        });
      } catch (err) {
        logger.warn(`Could not read historical session ${d}: ${err}`);
      }
    }
    return sessions;
  }

  hasData(symbol = 'NIFTY 50'): boolean {
    return this.getAvailableDates(symbol).length > 0;
  }

  loadDataForRange(
    symbol = 'NIFTY 50',
    fromDate?: string,
    toDate?: string
  ): FreeHistoricalDataResult {
    const dir = getHistoricalOptionsDir();
    const allDates = this.getAvailableDates(symbol);
    if (allDates.length === 0) {
      throw new Error('NO_FREE_HISTORICAL_DATA: No local authentic historical data sessions found in free archive.');
    }

    // Filter dates within requested range
    let matchingDates = allDates;
    if (fromDate && toDate) {
      matchingDates = allDates.filter(d => d >= fromDate && d <= toDate);
    } else if (fromDate) {
      matchingDates = allDates.filter(d => d >= fromDate);
    } else if (toDate) {
      matchingDates = allDates.filter(d => d <= toDate);
    }

    // If requested range is outside available dates, fall back to all available dates in the free archive
    if (matchingDates.length === 0) {
      logger.info(`[FreeHistoricalData] Requested range ${fromDate}..${toDate} has no local files; using all available sessions: ${allDates.join(', ')}`);
      matchingDates = allDates;
    }

    const prefix = symbol.replace(/\s+/g, '_') + '_';
    const allSpot: Candle[] = [];
    const allCe1m: OptionCandle[] = [];
    const allCe5m: OptionCandle[] = [];
    const allPe1m: OptionCandle[] = [];
    const allPe5m: OptionCandle[] = [];
    const strikesByDate: Record<string, number> = {};

    for (const d of matchingDates) {
      const file = path.join(dir, `${prefix}${d}.json`);
      if (!fs.existsSync(file)) continue;

      try {
        const content: FreeHistoricalSession = JSON.parse(fs.readFileSync(file, 'utf8'));
        const dayFirst1m = Date.parse(`${d}T09:15:00+05:30`) / 1000;

        if (content.spotCandles && Array.isArray(content.spotCandles)) {
          allSpot.push(...content.spotCandles);
        }
        if (content.ceCandles1m && Array.isArray(content.ceCandles1m)) {
          content.ceCandles1m.forEach((c, idx) => {
            c.timestamp = dayFirst1m + idx * 60;
          });
          allCe1m.push(...content.ceCandles1m);
        }
        if (content.ceCandles5m && Array.isArray(content.ceCandles5m)) {
          content.ceCandles5m.forEach((c, idx) => {
            c.timestamp = dayFirst1m + idx * 300;
          });
          allCe5m.push(...content.ceCandles5m);
        }
        if (content.peCandles1m && Array.isArray(content.peCandles1m)) {
          content.peCandles1m.forEach((c, idx) => {
            c.timestamp = dayFirst1m + idx * 60;
          });
          allPe1m.push(...content.peCandles1m);
        }
        if (content.peCandles5m && Array.isArray(content.peCandles5m)) {
          content.peCandles5m.forEach((c, idx) => {
            c.timestamp = dayFirst1m + idx * 300;
          });
          allPe5m.push(...content.peCandles5m);
        }
        if (content.atmStrike) {
          strikesByDate[d] = content.atmStrike;
        }
      } catch (err) {
        logger.error(`Failed to load historical session for ${d}:`, err);
      }
    }

    if (allSpot.length === 0) {
      throw new Error('NO_FREE_HISTORICAL_DATA: Historical spot candles could not be loaded from free archive.');
    }

    return {
      spotCandles: allSpot.sort((a, b) => a.timestamp - b.timestamp),
      ceCandles1m: allCe1m.sort((a, b) => a.timestamp - b.timestamp),
      ceCandles5m: allCe5m.sort((a, b) => a.timestamp - b.timestamp),
      peCandles1m: allPe1m.sort((a, b) => a.timestamp - b.timestamp),
      peCandles5m: allPe5m.sort((a, b) => a.timestamp - b.timestamp),
      strikesByDate,
      dates: matchingDates,
      provider: 'NSE Authentic Exchange Traded Archive (Zero-Cost Free Tier)'
    };
  }

  saveSession(session: FreeHistoricalSession): void {
    const dir = getHistoricalOptionsDir();
    const prefix = session.symbol.replace(/\s+/g, '_') + '_';
    const filePath = path.join(dir, `${prefix}${session.date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
    logger.info(`[FreeHistoricalData] Saved session for ${session.symbol} on ${session.date} to free archive.`);
  }
}

export const freeHistoricalDataService = FreeHistoricalDataService.getInstance();
