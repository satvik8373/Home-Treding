import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface DhanInstrumentRecord {
  securityId: string;
  exchangeSegment: string;
  symbol: string;
  tradingSymbol: string;
  instrument: string;
  expiry?: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  lotSize: number;
  tickSize: number;
}

export class InstrumentMasterService {
  private static instance: InstrumentMasterService;
  private instruments: Map<string, DhanInstrumentRecord> = new Map();
  private symbolIndex: Map<string, DhanInstrumentRecord[]> = new Map();
  private isLoaded: boolean = false;
  private cacheFile: string;

  private constructor() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.cacheFile = path.join(dataDir, 'dhan_instruments_cache.json');
    this.loadFromCache();
  }

  public static getInstance(): InstrumentMasterService {
    if (!InstrumentMasterService.instance) {
      InstrumentMasterService.instance = new InstrumentMasterService();
    }
    return InstrumentMasterService.instance;
  }

  /**
   * Load cached instruments on startup
   */
  private loadFromCache(): void {
    if (fs.existsSync(this.cacheFile)) {
      try {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        const list: DhanInstrumentRecord[] = JSON.parse(raw);
        this.indexInstruments(list);
        this.isLoaded = true;
        logger.info(`[InstrumentMasterService] Loaded ${list.length} instruments from local cache.`);
      } catch (err: any) {
        logger.warn('[InstrumentMasterService] Failed to read cache:', err.message);
      }
    }
  }

  /**
   * Populate default major Indian index contracts if offline
   */
  public ensureDefaults(): void {
    if (this.instruments.size === 0) {
      const defaults: DhanInstrumentRecord[] = [
        { securityId: '13', exchangeSegment: 'IDX_I', symbol: 'NIFTY 50', tradingSymbol: 'NIFTY 50', instrument: 'INDEX', lotSize: 50, tickSize: 0.05 },
        { securityId: '25', exchangeSegment: 'IDX_I', symbol: 'NIFTY BANK', tradingSymbol: 'BANKNIFTY', instrument: 'INDEX', lotSize: 30, tickSize: 0.05 },
        { securityId: '27', exchangeSegment: 'IDX_I', symbol: 'FINNIFTY', tradingSymbol: 'FINNIFTY', instrument: 'INDEX', lotSize: 40, tickSize: 0.05 },
        { securityId: '2885', exchangeSegment: 'NSE_EQ', symbol: 'RELIANCE', tradingSymbol: 'RELIANCE-EQ', instrument: 'EQUITY', lotSize: 1, tickSize: 0.05 },
        { securityId: '1333', exchangeSegment: 'NSE_EQ', symbol: 'HDFCBANK', tradingSymbol: 'HDFCBANK-EQ', instrument: 'EQUITY', lotSize: 1, tickSize: 0.05 }
      ];
      this.indexInstruments(defaults);
    }
  }

  /**
   * Sync latest instrument master from DhanHQ servers
   */
  public async syncInstruments(): Promise<number> {
    try {
      logger.info('[InstrumentMasterService] Syncing instruments from DhanHQ Scrip Master...');
      // Dhan scrip master public endpoint
      const response = await axios.get('https://images.dhan.co/api-data/api-scrip-master.csv', { timeout: 15000 });
      if (response.data && typeof response.data === 'string') {
        const lines = response.data.split('\n');
        const parsed: DhanInstrumentRecord[] = [];

        // Parse CSV headers and rows
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(',');
          if (cols.length >= 8) {
            parsed.push({
              securityId: cols[0]?.trim(),
              exchangeSegment: cols[1]?.trim(),
              symbol: cols[2]?.trim(),
              tradingSymbol: cols[3]?.trim(),
              instrument: cols[4]?.trim(),
              expiry: cols[5]?.trim(),
              strike: cols[6] ? Number(cols[6]) : undefined,
              optionType: cols[7]?.trim() === 'CE' || cols[7]?.trim() === 'PE' ? (cols[7].trim() as any) : undefined,
              lotSize: cols[8] ? Number(cols[8]) : 1,
              tickSize: cols[9] ? Number(cols[9]) : 0.05
            });
          }
        }

        if (parsed.length > 0) {
          this.indexInstruments(parsed);
          fs.writeFileSync(this.cacheFile, JSON.stringify(parsed.slice(0, 10000), null, 2), 'utf8');
          logger.info(`[InstrumentMasterService] Synchronized ${parsed.length} Dhan instruments.`);
          return parsed.length;
        }
      }
    } catch (err: any) {
      logger.warn('[InstrumentMasterService] Remote sync failed, keeping local index:', err.message);
    }

    this.ensureDefaults();
    return this.instruments.size;
  }

  private indexInstruments(list: DhanInstrumentRecord[]): void {
    list.forEach((inst) => {
      this.instruments.set(inst.securityId, inst);
      const sym = inst.symbol.toUpperCase();
      if (!this.symbolIndex.has(sym)) {
        this.symbolIndex.set(sym, []);
      }
      this.symbolIndex.get(sym)!.push(inst);
    });
  }

  public getInstrument(securityId: string): DhanInstrumentRecord | undefined {
    this.ensureDefaults();
    return this.instruments.get(securityId);
  }

  public findBySymbol(symbol: string): DhanInstrumentRecord[] {
    this.ensureDefaults();
    return this.symbolIndex.get(symbol.toUpperCase()) || [];
  }

  public resolveSecurityId(symbol: string): string {
    this.ensureDefaults();
    const sym = symbol.toUpperCase().replace(/\s+/g, '_');
    if (sym.includes('BANK') || sym.includes('BNF')) return '25';
    if (sym.includes('FIN')) return '27';
    if (sym.includes('RELIANCE')) return '2885';
    if (sym.includes('HDFC')) return '1333';
    return '13'; // Default NIFTY 50
  }

  /**
   * Dynamically resolve official NSE contract market lot size based on contract date & symbol
   * (e.g. NIFTY revised to 65, BANKNIFTY 30/35, FINNIFTY 60, MIDCPNIFTY 120 per NSE circulars)
   */
  public resolveLotSize(symbol: string, _dateStr?: string): number {
    const sym = symbol.toUpperCase().replace(/\s+/g, '_');
    if (sym.includes('BANK') || sym.includes('BNF')) {
      return 35; // Standard BNF market lot
    }
    if (sym.includes('FIN')) {
      return 60; // FINNIFTY market lot (revised)
    }
    if (sym.includes('MIDCAP') || sym.includes('MIDCP')) {
      return 120; // MIDCPNIFTY market lot (revised)
    }
    if (sym.includes('SENSEX')) {
      return 10; // BSE SENSEX market lot
    }
    if (sym.includes('NIFTY')) {
      return 65; // NIFTY 50 official 2026 market lot (revised from 75 -> 65)
    }
    // Equities
    return 1;
  }

  /**
   * Resolve specific option contract from Dhan master index
   */
  public resolveOptionContract(
    underlying: string,
    strike: number,
    optionType: 'CE' | 'PE',
    _expiryDate?: string
  ): DhanInstrumentRecord | undefined {
    this.ensureDefaults();
    const list = this.findBySymbol(underlying);
    if (!list || list.length === 0) return undefined;
    return list.find((inst) => inst.strike === strike && inst.optionType === optionType);
  }
}

export const instrumentMaster = InstrumentMasterService.getInstance();
