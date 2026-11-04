import type { Candle, Trade } from "../../shared/model";
import type {
  CandlestickData,
  SeriesMarker,
  UTCTimestamp,
} from "lightweight-charts";

/** Shift only chart presentation to IST; trading timestamps remain UTC milliseconds. */
export const chartTime = (milliseconds: number) =>
  (Math.floor(milliseconds / 1000) + 19800) as UTCTimestamp;
export function chartCandles(
  candles: Candle[],
): CandlestickData<UTCTimestamp>[] {
  const unique = new Map<number, Candle>();
  for (const c of candles)
    if (
      Number.isFinite(c.start) &&
      [c.open, c.high, c.low, c.close].every(
        (value) => Number.isFinite(value) && value > 0,
      ) &&
      c.high >= Math.max(c.open, c.low, c.close) &&
      c.low <= Math.min(c.open, c.close)
    )
      unique.set(c.start, c);
  return [...unique.values()]
    .sort((a, b) => a.start - b.start)
    .map((c) => ({
      time: chartTime(c.start),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
}
export function tradeMarkers(
  trades: Trade[],
  candles: Candle[],
  symbol: string,
): SeriesMarker<UTCTimestamp>[] {
  const starts = new Set(candles.map((c) => c.start)),
    groups = new Map<
      string,
      { at: number; side: Trade["transaction"]; quantity: number }
    >();
  for (const trade of trades) {
    if (trade.symbol !== symbol) continue;
    const at = Math.floor(trade.at / 300_000) * 300_000;
    if (!starts.has(at)) continue;
    const key = `${at}:${trade.transaction}`,
      previous = groups.get(key);
    groups.set(key, {
      at,
      side: trade.transaction,
      quantity: (previous?.quantity ?? 0) + trade.quantity,
    });
  }
  return [...groups.values()]
    .sort((a, b) => a.at - b.at)
    .map((t) => ({
      time: chartTime(t.at),
      position: t.side === "BUY" ? "belowBar" : "aboveBar",
      color: t.side === "BUY" ? "#47785e" : "#ab625b",
      shape: t.side === "BUY" ? "arrowUp" : "arrowDown",
      text: `${t.side} ${t.quantity}`,
    }));
}
