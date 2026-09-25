/**
 * Official Black-Scholes-Merton (1973) European Option Pricing Model
 * Institutional standard used by NSE, Bloomberg, and quant trading desks.
 */

function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);
  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * erf);
}

export interface OptionPricingResult {
  callPrice: number;
  putPrice: number;
  callDelta: number;
  putDelta: number;
  gamma: number;
  thetaCall: number;
  thetaPut: number;
  vega: number;
}

/**
 * Calculates official institutional option pricing and Greeks.
 *
 * @param spotPrice Current underlying price (e.g. NIFTY 50 = 26180)
 * @param strikePrice Option strike (e.g. 26200)
 * @param daysToExpiry Days until expiry date (default: 6 for weekly)
 * @param volatility Annualized volatility (default: 0.135 = 13.5% India VIX)
 * @param riskFreeRate Annualized risk-free rate (default: 0.065 = 6.5% RBI MIBOR)
 */
export function calculateOptionPricing(
  spotPrice: number,
  strikePrice: number,
  daysToExpiry: number = 5,
  volatility: number = 0.12561,
  riskFreeRate: number = 0.065
): OptionPricingResult {
  const T = Math.max(0.0005, daysToExpiry / 365);
  const sqrtT = Math.sqrt(T);
  const sigmaSqrtT = volatility * sqrtT;

  const d1 = (Math.log(spotPrice / strikePrice) + (riskFreeRate + 0.5 * volatility * volatility) * T) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;

  const nd1 = normalCdf(d1);
  const nd2 = normalCdf(d2);
  const nMinusD1 = normalCdf(-d1);
  const nMinusD2 = normalCdf(-d2);
  const discount = Math.exp(-riskFreeRate * T);

  // Black-Scholes call and put formulas
  const rawCall = spotPrice * nd1 - strikePrice * discount * nd2;
  const rawPut = strikePrice * discount * nMinusD2 - spotPrice * nMinusD1;

  const callPrice = Number(Math.max(0.05, rawCall).toFixed(2));
  const putPrice = Number(Math.max(0.05, rawPut).toFixed(2));

  // Greeks
  const phiD1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
  const gamma = Number((phiD1 / (spotPrice * sigmaSqrtT)).toFixed(5));
  const vega = Number(((spotPrice * sqrtT * phiD1) / 100).toFixed(2));

  const term1 = -(spotPrice * phiD1 * volatility) / (2 * sqrtT);
  const thetaCall = Number(((term1 - riskFreeRate * strikePrice * discount * nd2) / 365).toFixed(2));
  const thetaPut = Number(((term1 + riskFreeRate * strikePrice * discount * nMinusD2) / 365).toFixed(2));

  return {
    callPrice,
    putPrice,
    callDelta: Number(nd1.toFixed(3)),
    putDelta: Number((nd1 - 1).toFixed(3)),
    gamma,
    thetaCall,
    thetaPut,
    vega
  };
}
