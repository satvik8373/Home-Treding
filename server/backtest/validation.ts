import type {
  BacktestDataset,
  BacktestOptions,
} from "../../shared/backtest.ts";
import type { Candle, Contract, Side } from "../../shared/model.ts";
import { FIVE_MINUTES, isTradingDay, istDate, istTime } from "../time.ts";
import { MAX_HISTORY_DAYS } from '../../shared/history.ts';
import { validateSettings } from '../../shared/settings.ts';

export const SIDES: Side[] = ["CE", "PE"];
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("A JSON object is required.");
  return value as Record<string, unknown>;
};
export function tradingDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) ||
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error("Choose a valid YYYY-MM-DD date.");
  return value;
}
export function dateRange(start: unknown, end: unknown, now: number): string[] {
  const from = tradingDate(start),
    to = tradingDate(end);
  if (from > to || to > istDate(now))
    throw new Error("Choose a date range ending today or earlier.");
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days >= MAX_HISTORY_DAYS) throw new Error(`Run at most ${MAX_HISTORY_DAYS} calendar days at a time.`);
  return Array.from({ length: days + 1 }, (_, index) =>
    new Date(Date.parse(from) + index * 86_400_000).toISOString().slice(0, 10),
  );
}
export function options(input: unknown): BacktestOptions {
  const body = object(input);
  const number = (key: string, fallback: number, max: number) => {
    const value = body[key] ?? fallback;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > max
    )
      throw new Error(`${key} must be between 0 and ${max}.`);
    return value;
  };
  return {
    slippagePoints: number("slippagePoints", 0.05, 10),
    feePerOrder: number("feePerOrder", 0, 1000),
    ...(body.strategySettings != null ? { strategySettings: validateSettings(body.strategySettings) } : {}),
  };
}
export function historicalContracts(input: unknown, date: string): Record<Side, Contract> {
  const raw = object(input), contracts = {} as Record<Side, Contract>;
  for (const side of SIDES) {
    const c = object(raw[side]), expiry = tradingDate(c.expiry);
    if (c.side !== side || typeof c.token !== 'string' || !/^\d{1,12}$/.test(c.token)
      || typeof c.symbol !== 'string' || !/^NIFTY[A-Z0-9_-]{1,80}$/i.test(c.symbol)
      || typeof c.strike !== 'number' || !Number.isFinite(c.strike) || c.strike <= 0
      || typeof c.lotSize !== 'number' || !Number.isInteger(c.lotSize) || c.lotSize < 1 || c.lotSize > 10000 || expiry < date) {
      throw new Error(`${side} requires valid historical NIFTY contract metadata and lot size.`);
    }
    contracts[side] = { side, token: c.token, symbol: c.symbol, strike: c.strike, lotSize: c.lotSize, expiry };
  }
  if (contracts.CE.strike !== contracts.PE.strike || contracts.CE.expiry !== contracts.PE.expiry || contracts.CE.lotSize !== contracts.PE.lotSize || contracts.CE.token === contracts.PE.token || contracts.CE.symbol === contracts.PE.symbol) {
    throw new Error('CALL and PUT must use the same historical ATM strike, expiry and lot size, with distinct tokens and symbols.');
  }
  return contracts;
}
export function dataset(
  input: unknown,
  now: number,
  source: "broker" | "import",
): BacktestDataset {
  const body = object(input),
    date = tradingDate(body.date);
  if (date > istDate(now) || !isTradingDay(istTime(date, "12:00")))
    throw new Error("The dataset must be a trading weekday, today or earlier.");
  if (
    body.version !== 1 ||
    typeof body.spotReferenceClose !== "number" ||
    !Number.isFinite(body.spotReferenceClose) ||
    body.spotReferenceClose <= 0
  )
    throw new Error(
      "Version 1 and the actual NIFTY opening reference close are required.",
    );
  const rawContracts = object(body.contracts),
    rawCandles = object(body.candles);
  const contracts = {} as Record<Side, Contract>,
    candles = {} as Record<Side, Candle[]>;
  for (const side of SIDES) {
    const c = object(rawContracts[side]),
      expiry = tradingDate(c.expiry);
    if (
      c.side !== side ||
      typeof c.token !== "string" ||
      !/^\d{1,12}$/.test(c.token) ||
      typeof c.symbol !== "string" ||
      !/^NIFTY[A-Z0-9_-]{1,80}$/i.test(c.symbol) ||
      typeof c.strike !== "number" ||
      !Number.isFinite(c.strike) ||
      c.strike <= 0 ||
      typeof c.lotSize !== "number" ||
      !Number.isInteger(c.lotSize) ||
      c.lotSize < 1 ||
      c.lotSize > 10000 ||
      expiry < date
    )
      throw new Error(
        `${side} requires valid historical NIFTY contract metadata and lot size.`,
      );
    contracts[side] = {
      side,
      symbol: c.symbol,
      token: c.token,
      expiry,
      strike: c.strike,
      lotSize: c.lotSize,
    };
    const bars = rawCandles[side];
    if (!Array.isArray(bars) || bars.length < 1 || bars.length > 75)
      throw new Error(`${side} must include 1–75 five-minute candles.`);
    const normalized: Candle[] = bars
      .map((raw) => {
        const value = object(raw);
        const bar = {
          start: value.start,
          end: value.end,
          open: value.open,
          high: value.high,
          low: value.low,
          close: value.close,
        } as Candle;
        if (
          ![bar.start, bar.end, bar.open, bar.high, bar.low, bar.close].every(
            (v) => typeof v === "number" && Number.isFinite(v),
          ) ||
          !([bar.open, bar.high, bar.low, bar.close].every(price => price > 0) && bar.high >= Math.max(bar.open, bar.close, bar.low) && bar.low <= Math.min(bar.open, bar.close) && bar.end - bar.start === FIVE_MINUTES) ||
          bar.start < istTime(date, "09:15") ||
          bar.end > istTime(date, "15:30") ||
          (bar.start - istTime(date, "09:15")) % FIVE_MINUTES !== 0 ||
          bar.end > now
        )
          throw new Error(
            `${side} contains an invalid, wrong-date, or incomplete candle.`,
          );
        return bar;
      })
      .sort((a, b) => a.start - b.start);
    if (normalized[0].start !== istTime(date, "09:15"))
      throw new Error(`${side} is missing the 09:15–09:20 reference candle.`);
    for (let i = 1; i < normalized.length; i++)
      if (normalized[i].start !== normalized[i - 1].end)
        throw new Error(
          `${side} has a duplicate or missing five-minute candle. An uninterrupted session is required.`,
        );
    candles[side] = normalized;
  }
  if (
    contracts.CE.strike !== contracts.PE.strike ||
    contracts.CE.expiry !== contracts.PE.expiry ||
    contracts.CE.lotSize !== contracts.PE.lotSize ||
    contracts.CE.token === contracts.PE.token ||
    contracts.CE.symbol === contracts.PE.symbol
  )
    throw new Error(
      "CALL and PUT must be the independent pair for the same historical ATM strike, expiry and lot size.",
    );
  return {
    version: 1,
    date,
    spotReferenceClose: body.spotReferenceClose,
    contracts,
    candles,
    source,
    capturedAt:
      source === "import"
        ? now
        : typeof body.capturedAt === "number" &&
            Number.isFinite(body.capturedAt)
          ? body.capturedAt
          : now,
    ...(['broker', 'import', 'session', 'master-snapshot'].includes(String(body.contractSource)) ? { contractSource: body.contractSource as BacktestDataset['contractSource'] } : {}),
  };
}
