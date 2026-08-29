import { instrumentMaster, DhanInstrumentRecord } from '../services/InstrumentMasterService';
import { logger } from '../utils/logger';

export interface InstrumentMeta {
  securityId: string;
  exchangeSegment: string;
  instrument: string;
  symbol: string;
  underlyingSymbol?: string;
  expiryDate?: string;
  expiryFlag?: 'W' | 'M';
  strikePrice?: number;
  optionType?: 'CE' | 'PE';
  lotSize: number;
  tickSize: number;
}

/**
 * Maps a user-facing underlying symbol to the DhanHQ security metadata
 * for /charts/intraday requests.
 */
const UNDERLYING_METADATA: Record<string, { securityId: string; exchangeSegment: string; instrument: string }> = {
  'BANKNIFTY':         { securityId: '25', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY_BANK':        { securityId: '25', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY BANK':        { securityId: '25', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY':             { securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY 50':          { securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY_50':          { securityId: '13', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'FINNIFTY':          { securityId: '27', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'NIFTY FIN SERVICE': { securityId: '27', exchangeSegment: 'IDX_I', instrument: 'INDEX' },
  'MIDCPNIFTY':        { securityId: '28', exchangeSegment: 'IDX_I', instrument: 'INDEX' }
};

/**
 * InstrumentResolver — resolves lot sizes, security IDs, and contract metadata
 * from the official Dhan Instrument Master.
 *
 * Reference: https://dhanhq.co/docs/v2/instruments/
 * NSE lot sizes: https://www.nseindia.com/static/products-services/equity-derivatives-contract-information
 */
export class InstrumentResolver {

  /**
   * Resolve the spot/underlying security metadata for /charts/intraday.
   */
  resolveUnderlying(symbol: string): { securityId: string; exchangeSegment: string; instrument: string } {
    const key = symbol.trim().toUpperCase().replace(/\s+/g, '_');
    const direct = UNDERLYING_METADATA[key] ?? UNDERLYING_METADATA[symbol.trim().toUpperCase()];
    if (direct) return direct;

    // Fuzzy match
    if (key.includes('BANK')) return UNDERLYING_METADATA['BANKNIFTY']!;
    if (key.includes('FIN'))  return UNDERLYING_METADATA['FINNIFTY']!;
    if (key.includes('MID'))  return UNDERLYING_METADATA['MIDCPNIFTY']!;
    if (key.includes('NIFTY')) return UNDERLYING_METADATA['NIFTY']!;

    throw new Error(`INSTRUMENT_NOT_FOUND: Cannot resolve underlying for symbol "${symbol}"`);
  }

  /**
   * Resolve the lot size from the Dhan Instrument Master (InstrumentMasterService).
   * Falls back to InstrumentMasterService.resolveLotSize() which uses known NSE values.
   *
   * NSE lot sizes change on revision — always verify against the current contract file.
   */
  async resolveLotSize(underlying: string, expiryDate?: string): Promise<number> {
    // 1. Try findBySymbol first (looks in the loaded instrument index)
    try {
      instrumentMaster.ensureDefaults();
      const candidates = instrumentMaster.findBySymbol(underlying);
      if (candidates && candidates.length > 0) {
        const filtered = expiryDate
          ? candidates.filter((x) => x.expiry === expiryDate)
          : candidates;
        const lotSizes = [...new Set(
          (filtered.length > 0 ? filtered : candidates)
            .map((x) => Number(x.lotSize))
            .filter((n) => n > 0)
        )];

        if (lotSizes.length === 1) {
          logger.info(`[InstrumentResolver] Lot size ${lotSizes[0]} for ${underlying} from instrument master`);
          return lotSizes[0];
        }
        if (lotSizes.length > 1) {
          const min = Math.min(...lotSizes);
          logger.warn(`[InstrumentResolver] Multiple lot sizes for ${underlying}: [${lotSizes}]. Using min: ${min}`);
          return min;
        }
      }
    } catch (err: any) {
      logger.warn(`[InstrumentResolver] findBySymbol lookup failed: ${err.message}`);
    }

    // 2. Delegate to InstrumentMasterService.resolveLotSize (NSE-known fallback)
    const lotSize = instrumentMaster.resolveLotSize(underlying);
    logger.info(`[InstrumentResolver] Using InstrumentMasterService lot size ${lotSize} for ${underlying}`);
    return lotSize;
  }

  /**
   * Resolve a specific option contract from the instrument master.
   */
  resolveOption(
    underlying: string,
    strike: number,
    optionType: 'CE' | 'PE',
    expiryDate?: string
  ): DhanInstrumentRecord | undefined {
    instrumentMaster.ensureDefaults();
    return instrumentMaster.resolveOptionContract(underlying, strike, optionType, expiryDate);
  }
}

export const instrumentResolver = new InstrumentResolver();