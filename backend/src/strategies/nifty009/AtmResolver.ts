import { BrokerRegistry } from '../../brokers/BrokerRegistry';
import { DhanAdapter } from '../../brokers/dhan/DhanAdapter';
import { getStrategyConfig } from '../../config/strategyConfig';

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
    return AtmResolver.instance ?? (AtmResolver.instance = new AtmResolver());
  }

  public getNearestStrike(spotPrice: number): number {
    if (!Number.isFinite(spotPrice) || spotPrice <= 0) throw new Error('LIVE_SPOT_REQUIRED');
    return Math.round(spotPrice / 50) * 50;
  }

  public async resolveAndLockAtm(spotPrice: number, lotSize?: number, userId?: string): Promise<LockedAtm> {
    if (this.lockedAtm) return this.lockedAtm;
    const adapter = BrokerRegistry.getInstance().getPrimaryAdapter(userId) as DhanAdapter | null;
    if (!adapter?.getStatus()) throw new Error('DHAN_AUTH_REQUIRED: Connect Dhan before starting the live strategy.');

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const expiries = await adapter.getExpiryList('13', 'IDX_I');
    const expiry = expiries.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today).sort()[0];
    if (!expiry) throw new Error('DHAN_EXPIRY_UNAVAILABLE: Dhan returned no active NIFTY expiry.');

    const atmStrike = this.getNearestStrike(spotPrice);
    const chain = await adapter.getOptionChain('13', expiry);
    const strike = chain?.strikes.find(row => row.strikePrice === atmStrike);
    const ce = strike?.ce;
    const pe = strike?.pe;
    if (!ce?.securityId || !pe?.securityId || ce.ltp <= 0 || pe.ltp <= 0 ||
        !/^\d+$/.test(ce.securityId) || !/^\d+$/.test(pe.securityId)) {
      throw new Error('DHAN_ATM_CONTRACT_UNAVAILABLE: Dhan did not verify both ATM option contracts and prices.');
    }

    this.lockedAtm = {
      atmStrike, expiry,
      ceSecurityId: ce.securityId,
      ceSymbol: ce.symbol || `NIFTY ${expiry} ${atmStrike} CE`,
      ceLtp: ce.ltp,
      peSecurityId: pe.securityId,
      peSymbol: pe.symbol || `NIFTY ${expiry} ${atmStrike} PE`,
      peLtp: pe.ltp,
      lotSize: lotSize ?? getStrategyConfig().niftyLotSize,
      spotPriceAtResolution: spotPrice,
      resolvedAt: new Date().toISOString()
    };
    return this.lockedAtm;
  }

  public getLockedAtm(): LockedAtm | null { return this.lockedAtm; }

  public updateOptionLtp(type: 'CE' | 'PE', ltp: number): void {
    if (!this.lockedAtm || !Number.isFinite(ltp) || ltp <= 0) return;
    if (type === 'CE') this.lockedAtm.ceLtp = ltp;
    else this.lockedAtm.peLtp = ltp;
  }

  public reset(): void { this.lockedAtm = null; }
}

export const atmResolver = AtmResolver.getInstance();
