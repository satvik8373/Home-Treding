import { Candle, OptionCandle } from './DhanHistoricalDataService';

export interface OptionPricingParams {
  spotPrice: number;
  strike: number;
  timeToExpiryYears: number; // e.g. 7/365
  riskFreeRate?: number;     // e.g. 0.065 (6.5% RBI repo rate)
  volatility?: number;       // e.g. 0.14 (14% India VIX)
}

/**
 * Standard Normal Cumulative Distribution Function (CDF) approximation (Abramowitz & Stegun)
 */
function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));

  return 0.5 * (1.0 + sign * y);
}

/**
 * Black-Scholes Option Pricing Engine for Indian Index Options (NIFTY / BANKNIFTY)
 */
export class BlackScholesOptionEngine {
  private defaultRiskFreeRate = 0.065; // 6.5%
  private defaultVolatility = 0.145;    // 14.5% IV (typical Indian market VIX)

  /**
   * Compute theoretical European option price (Call & Put) using Black-Scholes formula.
   */
  calculatePremium(
    spot: number,
    strike: number,
    timeToExpiryYears: number,
    optionType: 'CE' | 'PE',
    volatility = this.defaultVolatility,
    rate = this.defaultRiskFreeRate
  ): { price: number; delta: number; theta: number } {
    const t = Math.max(timeToExpiryYears, 0.0001); // Avoid division by zero on expiry day
    const s = Math.max(spot, 1);
    const k = Math.max(strike, 1);
    const sigma = Math.max(volatility, 0.01);
    const r = rate;

    const d1 = (Math.log(s / k) + (r + (sigma * sigma) / 2) * t) / (sigma * Math.sqrt(t));
    const d2 = d1 - sigma * Math.sqrt(t);

    const nd1 = normalCdf(d1);
    const nd2 = normalCdf(d2);
    const nMinusD1 = normalCdf(-d1);
    const nMinusD2 = normalCdf(-d2);

    let price = 0;
    let delta = 0;

    if (optionType === 'CE') {
      price = s * nd1 - k * Math.exp(-r * t) * nd2;
      delta = nd1;
    } else {
      price = k * Math.exp(-r * t) * nMinusD2 - s * nMinusD1;
      delta = nd1 - 1;
    }

    // Minimum intrinsic value
    const intrinsic = optionType === 'CE' ? Math.max(0, s - k) : Math.max(0, k - s);
    const finalPrice = Math.max(price, intrinsic, 0.05);

    // Theta approximation (annualized / 365)
    const theta = -(s * sigma * Math.exp(-0.5 * d1 * d1)) / (2 * Math.sqrt(2 * Math.PI * t)) / 365;

    return {
      price: Number(finalPrice.toFixed(2)),
      delta: Number(delta.toFixed(3)),
      theta: Number(theta.toFixed(2))
    };
  }

  /**
   * Derive option 5-minute OHLC candle series directly from spot 5-minute OHLC candles.
   */
  deriveOptionCandles(
    spotCandles: Candle[],
    strike: number,
    optionType: 'CE' | 'PE',
    volatility = this.defaultVolatility
  ): OptionCandle[] {
    const result: OptionCandle[] = [];

    // Group candles by date to calculate intraday time progression
    const dateMap = new Map<string, Candle[]>();
    for (const c of spotCandles) {
      if (!dateMap.has(c.date)) dateMap.set(c.date, []);
      dateMap.get(c.date)!.push(c);
    }

    for (const [, dayCandles] of dateMap) {
      const totalDayBars = dayCandles.length || 75;

      for (let barIdx = 0; barIdx < dayCandles.length; barIdx++) {
        const spotC = dayCandles[barIdx];

        // Intraday time decay factor: as day progresses from 09:15 to 15:30, time value decays
        const dayProgress = barIdx / totalDayBars; // 0.0 (morning) -> 1.0 (close)
        const daysToExpiry = Math.max(5 - (dayProgress * 0.35), 0.2);
        const tYears = daysToExpiry / 365;

        // Calculate option prices for open, high, low, close
        const openPrem = this.calculatePremium(spotC.open, strike, tYears, optionType, volatility);
        const closePrem = this.calculatePremium(spotC.close, strike, tYears, optionType, volatility);

        // For Call: higher spot = higher option price; for Put: higher spot = lower option price
        const highSpotPrem = this.calculatePremium(
          optionType === 'CE' ? spotC.high : spotC.low,
          strike,
          tYears,
          optionType,
          volatility
        );
        const lowSpotPrem = this.calculatePremium(
          optionType === 'CE' ? spotC.low : spotC.high,
          strike,
          tYears,
          optionType,
          volatility
        );

        const optOpen = openPrem.price;
        const optClose = closePrem.price;
        const optHigh = Number(Math.max(optOpen, optClose, highSpotPrem.price).toFixed(2));
        const optLow = Number(Math.max(0.05, Math.min(optOpen, optClose, lowSpotPrem.price)).toFixed(2));

        result.push({
          timestamp: spotC.timestamp,
          isoTime: spotC.isoTime,
          date: spotC.date,
          time: spotC.time,
          open: optOpen,
          high: optHigh,
          low: optLow,
          close: optClose,
          volume: spotC.volume,
          strike,
          optionType,
          spot: spotC.close,
          iv: Number((volatility * 100).toFixed(1))
        });
      }
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }
}

export const blackScholesEngine = new BlackScholesOptionEngine();