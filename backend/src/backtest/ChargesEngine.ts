export interface ChargeConfig {
  brokeragePerExecutedOrder: number;
  sttSellRate: number;
  exchangeTurnoverRate: number;
  sebiPerCrore: number;
  gstRate: number;
  stampDutyBuyRate: number;
  ipftPerCrore: number;
}

export interface ChargeBreakdown {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  stamp: number;
  gst: number;
  ipft: number;
  total: number;
}

export const DEFAULT_CHARGES: ChargeConfig = {
  brokeragePerExecutedOrder: 20,
  sttSellRate: 0.0015,
  exchangeTurnoverRate: 0.00003552,
  sebiPerCrore: 10,
  gstRate: 0.18,
  stampDutyBuyRate: 0.00003,
  ipftPerCrore: 0.01
};

const RATE_CHANGE_DATE = '2026-04-01';
const EXCHANGE_RATE_CHANGE_DATE = '2026-03-01';

function rateForDate(date: string | undefined, config: ChargeConfig): ChargeConfig {
  if (!date) return config;

  const beforeSttChange = date < RATE_CHANGE_DATE;
  const beforeExchangeChange = date < EXCHANGE_RATE_CHANGE_DATE;

  return {
    ...config,
    sttSellRate: beforeSttChange ? 0.001 : config.sttSellRate,
    exchangeTurnoverRate: beforeExchangeChange ? 0.00003503 : config.exchangeTurnoverRate
  };
}

export function calculateCharges(
  side: 'BUY' | 'SELL',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  config: ChargeConfig = DEFAULT_CHARGES,
  tradeDate?: string,
  exitExecutions = 1
): ChargeBreakdown {
  const rates = rateForDate(tradeDate, config);
  const entryTurnover = entryPrice * quantity;
  const exitTurnover = exitPrice * quantity;
  const totalTurnover = entryTurnover + exitTurnover;

  const sellTurnover = side === 'SELL' ? entryTurnover : exitTurnover;
  const buyTurnover = side === 'SELL' ? exitTurnover : entryTurnover;

  const brokerage = rates.brokeragePerExecutedOrder * (1 + Math.max(0, exitExecutions));
  const stt = Math.round(sellTurnover * rates.sttSellRate * 100) / 100;
  const exchange = Math.round(totalTurnover * rates.exchangeTurnoverRate * 100) / 100;
  const sebi = Math.round(totalTurnover * (rates.sebiPerCrore / 10000000) * 100) / 100;
  const stamp = Math.round(buyTurnover * rates.stampDutyBuyRate * 100) / 100;
  const ipft = Math.round(totalTurnover * (rates.ipftPerCrore / 100000000) * 100) / 100;
  const gst = Math.round((brokerage + exchange + sebi + ipft) * rates.gstRate * 100) / 100;
  const total = Math.round((brokerage + stt + exchange + sebi + stamp + ipft + gst) * 100) / 100;

  return { brokerage, stt, exchange, sebi, stamp, gst, ipft, total };
}
