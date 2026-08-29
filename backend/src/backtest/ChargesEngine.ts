import { Side } from './ExecutionSimulator';

/**
 * ChargesConfig — all charges are configurable, not permanently hardcoded.
 *
 * Regulatory and broker charges change over time. Configure from the
 * currently applicable schedule rather than encoding fixed percentages.
 *
 * Reference for reconciliation against real trades:
 * https://dhanhq.co/docs/v2/statements/
 */
export interface ChargeConfig {
  brokeragePerExecutedOrder: number;  // e.g. 20 (flat per order)
  sttSellRate: number;                // STT on sell side (index options: currently 0.0625% on premium)
  exchangeTurnoverRate: number;       // NSE exchange transaction charge
  sebiPerCrore: number;               // SEBI turnover fee (Rs per crore)
  gstRate: number;                    // GST on (brokerage + exchange + SEBI)
  stampDutyBuyRate: number;           // Stamp duty on buy side only
}

/**
 * Default charge config — based on current Dhan applicable schedule for
 * NSE F&O options. Verify against Dhan's current schedule before use.
 *
 * NOTE: These are reference values only. Update to match the exact
 * rates applicable to your account and the current regulatory schedule.
 */
export const DEFAULT_CHARGES: ChargeConfig = {
  brokeragePerExecutedOrder: 20,      // Dhan flat ₹20 per executed order
  sttSellRate: 0.000625,              // 0.0625% on premium for index option sell (NSE)
  exchangeTurnoverRate: 0.0000345,    // NSE exchange charge rate for F&O (check current schedule)
  sebiPerCrore: 10,                   // ₹10 per crore turnover
  gstRate: 0.18,                      // 18% GST on brokerage + exchange + SEBI
  stampDutyBuyRate: 0.00003           // 0.003% stamp duty on buy side premium
};

export interface ChargeBreakdown {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  stamp: number;
  gst: number;
  total: number;
}

/**
 * Calculate all applicable charges for a completed trade.
 *
 * For options:
 *   - STT applies on sell side (premium value)
 *   - Stamp duty applies on buy side (premium value)
 *   - Exchange/SEBI computed on total turnover (entry + exit premium)
 *   - GST applies on brokerage + exchange + SEBI fees
 *   - Brokerage: flat per order (entry + exit = 2 orders)
 */
export function calculateCharges(
  side: Side,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  config: ChargeConfig = DEFAULT_CHARGES
): ChargeBreakdown {
  const entryTurnover = entryPrice * quantity;
  const exitTurnover = exitPrice * quantity;
  const totalTurnover = entryTurnover + exitTurnover;

  // For SELL strategy: entry is the sell side, exit is the buy-back side
  const sellTurnover = side === 'SELL' ? entryTurnover : exitTurnover;
  const buyTurnover = side === 'SELL' ? exitTurnover : entryTurnover;

  const brokerage = config.brokeragePerExecutedOrder * 2; // entry + exit
  const stt = Number((sellTurnover * config.sttSellRate).toFixed(2));
  const exchange = Number((totalTurnover * config.exchangeTurnoverRate).toFixed(2));
  const sebi = Number((totalTurnover * (config.sebiPerCrore / 10_000_000)).toFixed(2));
  const stamp = Number((buyTurnover * config.stampDutyBuyRate).toFixed(2));
  const gst = Number(((brokerage + exchange + sebi) * config.gstRate).toFixed(2));

  const total = Number((brokerage + stt + exchange + sebi + stamp + gst).toFixed(2));

  return { brokerage, stt, exchange, sebi, stamp, gst, total };
}