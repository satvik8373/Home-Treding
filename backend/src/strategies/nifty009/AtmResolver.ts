import { BrokerRegistry } from '../../brokers/BrokerRegistry';
import { logger } from '../../utils/logger';

export interface LockedAtm {
  atmStrike: number;
  expiry: string;
  ceSecurityId: string;
  ceSymbol: string;
  ceLtp: number;
  peSecurityId: string;
  peSymbol: string;
  peLtp: number;
  lotSize: number;
  spotPriceAtResolution: number;
  resolvedAt: string;
}

export class AtmResolver {
  private static instance: AtmResolver;
  private lockedAtm: LockedAtm | null = null;

  public static getInstance(): AtmResolver {
    if (!AtmResolver.instance) {
      AtmResolver.instance = new AtmResolver();
    }
    return AtmResolver.instance;
  }

  /**
   * Round NIFTY spot to nearest 50 strike
   */
  public getNearestStrike(spotPrice: number): number {
    return Math.round(spotPrice / 50) * 50;
  }

  /**
   * Get formatted nearest weekly expiry (e.g. DD-MMM-YYYY)
   */
  public getNearestWeeklyExpiry(fromDate = new Date()): string {
    const d = new Date(fromDate);
    const day = d.getDay();
    // NSE NIFTY options expire on Thursdays (day 4)
    let diff = 4 - day;
    if (diff < 0) diff += 7;
    // If today is Thursday after 15:30, move to next Thursday
    if (diff === 0 && d.getHours() >= 15 && d.getMinutes() >= 30) {
      diff = 7;
    }
    d.setDate(d.getDate() + diff);

    const dayStr = String(d.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthStr = months[d.getMonth()];
    const yearStr = d.getFullYear();
    return `${dayStr}-${monthStr}-${yearStr}`;
  }

  /**
   * Resolve and lock ATM strike at 09:20 IST.
   */
  public async resolveAndLockAtm(spotPrice: number): Promise<LockedAtm> {
    if (this.lockedAtm) {
      logger.info(`[AtmResolver] ATM already locked at ${this.lockedAtm.atmStrike}. Re-using locked strike.`);
      return this.lockedAtm;
    }

    const atmStrike = this.getNearestStrike(spotPrice);
    const expiry = this.getNearestWeeklyExpiry();
    const lotSize = 25; // NIFTY standard lot size

    const ceSymbol = `NIFTY ${expiry} ${atmStrike} CE`;
    const peSymbol = `NIFTY ${expiry} ${atmStrike} PE`;

    let ceSecurityId = `NIFTY_${atmStrike}_CE`;
    let peSecurityId = `NIFTY_${atmStrike}_PE`;
    let ceLtp = Math.max(20, Math.round((spotPrice * 0.007) * 10) / 10);
    let peLtp = Math.max(20, Math.round((spotPrice * 0.007) * 10) / 10);

    try {
      const brokerRegistry = BrokerRegistry.getInstance();
      const primaryAdapter = brokerRegistry.getPrimaryAdapter() as any;

      if (primaryAdapter && typeof primaryAdapter.getOptionChain === 'function') {
        // Attempt to fetch live option chain from Dhan
        const chain = await primaryAdapter.getOptionChain('NIFTY', expiry);
        if (chain && chain.strikes) {
          const matched = chain.strikes.find((s: any) => s.strikePrice === atmStrike);
          if (matched) {
            if (matched.ce) {
              ceSecurityId = String(matched.ce.securityId || ceSecurityId);
              ceLtp = matched.ce.ltp || ceLtp;
            }
            if (matched.pe) {
              peSecurityId = String(matched.pe.securityId || peSecurityId);
              peLtp = matched.pe.ltp || peLtp;
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn('[AtmResolver] Dhan option chain lookup error, using computed contract specs:', err.message);
    }

    this.lockedAtm = {
      atmStrike,
      expiry,
      ceSecurityId,
      ceSymbol,
      ceLtp,
      peSecurityId,
      peSymbol,
      peLtp,
      lotSize,
      spotPriceAtResolution: spotPrice,
      resolvedAt: new Date().toISOString()
    };

    logger.info(`[AtmResolver] 🔒 LOCKED ATM for day: Strike=${atmStrike} | CE=${ceSymbol} (₹${ceLtp}) | PE=${peSymbol} (₹${peLtp})`);
    return this.lockedAtm;
  }

  public getLockedAtm(): LockedAtm | null {
    return this.lockedAtm;
  }

  public updateOptionLtp(type: 'CE' | 'PE', ltp: number): void {
    if (!this.lockedAtm || ltp <= 0) return;
    if (type === 'CE') {
      this.lockedAtm.ceLtp = ltp;
    } else {
      this.lockedAtm.peLtp = ltp;
    }
  }

  public reset(): void {
    this.lockedAtm = null;
  }
}

export const atmResolver = AtmResolver.getInstance();
