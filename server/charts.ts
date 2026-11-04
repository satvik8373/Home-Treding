import type {
  Candle,
  Contract,
  ChartSymbol,
  MarketChart,
  MarketQuote,
  TradingSession,
} from "../shared/model.ts";
import type { MStock } from "./broker.ts";
import { INDEX_TOKEN } from "./broker.ts";
import { istDate, istTime } from "./time.ts";

type Context = {
  connected: boolean;
  account: string | null;
  session: TradingSession | null;
};
type ChartBroker = Pick<MStock, "history" | "request"> & Partial<Pick<MStock, 'contracts'>>;
type Cache = {
  candles: Candle[];
  quote: MarketQuote | null;
  historyAt: number;
  quoteAt: number;
  historyUpdatedAt: number | null;
  historyTask?: Promise<void>;
  quoteTask?: Promise<void>;
  historyError?: string;
  quoteError?: string;
};
const positive = (value: unknown) =>
  (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) > 0
    ? Number(value)
    : null;

/** Read-only chart data, separate from signals and order state. */
export class MarketCharts {
  private cache = new Map<string, Cache>();
  private previews = new Map<string, Promise<[Contract, Contract]>>();
  constructor(
    private broker: ChartBroker,
    private context: () => Context,
    private now = Date.now,
    private responseBudgetMs = 1200,
  ) {}

  async read(symbol: ChartSymbol): Promise<MarketChart> {
    const context = this.context(),
      date = istDate(this.now());
    if (!context.connected || !context.account)
      throw new Error("Connect mStock to view market data.");
    const leg =
      symbol === "NIFTY"
        ? null
        : context.session?.date === date &&
            context.session.account === context.account
          ? context.session.legs[symbol]
          : null;
    let contract = leg?.contract;
    if (symbol !== 'NIFTY' && !contract && this.broker.contracts) {
      if (this.now() < istTime(date, '09:20')) throw new Error('ATM option preview is available after the 09:15–09:20 NIFTY candle completes.');
      const previewKey = `${context.account}:${date}`;
      if (!this.previews.has(previewKey)) {
        if (this.previews.size >= 8) this.previews.delete(this.previews.keys().next().value!);
        const download = this.broker.history(INDEX_TOKEN, 'NSE', date, this.now()).then(async bars => {
          const reference = bars.find(bar => bar.start === istTime(date, '09:15'));
          if (!reference) throw new Error('The official NIFTY opening candle is unavailable. ATM contracts cannot be guessed.');
          return this.broker.contracts!(date, reference.close);
        }).catch(error => { this.previews.delete(previewKey); throw error });
        this.previews.set(previewKey, download);
      }
      contract = (await this.previews.get(previewKey)!).find(item => item.side === symbol);
    }
    if (symbol !== "NIFTY" && !contract)
      throw new Error(
        "Start the strategy to lock its ATM call and put contracts.",
      );
    const token = contract?.token ?? INDEX_TOKEN,
      title = contract?.symbol ?? "NIFTY 50";
    const exchange = symbol === "NIFTY" ? "NSE" : "NFO";
    const key = `${context.account}:${date}:${exchange}:${token}`;
    if (!this.cache.has(key)) {
      if (this.cache.size >= 12)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, {
        candles: [],
        quote: null,
        historyAt: 0,
        quoteAt: 0,
        historyUpdatedAt: null,
      });
    }
    const cache = this.cache.get(key)!,
      now = this.now();
    if (!cache.historyTask && now - cache.historyAt >= 15_000) {
      // Charts may display the broker's current forming bar. Signal history
      // keeps its existing completed-only default.
      cache.historyTask = this.broker
        .history(token, exchange, date, now, true)
        .then((candles) => {
          cache.candles = candles.filter((c) => c.start <= this.now());
          cache.historyError = undefined;
          cache.historyUpdatedAt = this.now();
        })
        .catch(() => {
          cache.historyError = "Candle history is delayed.";
        })
        .finally(() => {
          cache.historyAt = this.now();
          cache.historyTask = undefined;
        });
    }
    if (!cache.quoteTask && now - cache.quoteAt >= 2000) {
      const query = new URLSearchParams({ i: `${exchange}:${title}` });
      cache.quoteTask = this.broker
        .request(`/instruments/quote/ohlc?${query}`)
        .then((raw) => {
          const data = raw as Record<
            string,
            {
              last_price?: number;
              ohlc?: {
                open?: number;
                high?: number;
                low?: number;
                close?: number;
              };
            }
          >;
          const row = data?.[`${exchange}:${title}`],
            price = positive(row?.last_price);
          if (price === null) throw new Error("Quote unavailable");
          cache.quote = {
            token,
            price,
            receivedAt: this.now(),
            source: "rest",
            previousClose: positive(row?.ohlc?.close),
            open: positive(row?.ohlc?.open),
            high: positive(row?.ohlc?.high),
            low: positive(row?.ohlc?.low),
          };
          cache.quoteError = undefined;
        })
        .catch(() => {
          cache.quoteError =
            "Live quote is unavailable; last received data is shown.";
        })
        .finally(() => {
          cache.quoteAt = this.now();
          cache.quoteTask = undefined;
        });
    }
    // A slow history request must not hold fresh quote snapshots hostage.
    // The same in-flight downloads populate this cache for the next refresh.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all([cache.historyTask, cache.quoteTask]),
      new Promise<void>(resolve => { deadline = setTimeout(resolve, this.responseBudgetMs) }),
    ]).finally(() => { if (deadline) clearTimeout(deadline) });
    const latest = this.context();
    if (
      !latest.connected ||
      latest.account !== context.account ||
      istDate(this.now()) !== date
    )
      throw new Error("Market session changed. Refresh the chart.");
    return {
      symbol,
      token,
      title,
      contract,
      preview: symbol !== 'NIFTY' && !leg,
      date,
      interval: "5m",
      historyLoading: !!cache.historyTask,
      quoteLoading: !!cache.quoteTask,
      quoteAttemptAt: cache.quoteAt || undefined,
      candles: cache.candles,
      quote: cache.quote,
      historyUpdatedAt: cache.candles.length ? cache.historyUpdatedAt : null,
      serverTime: this.now(),
      warning:
        [cache.historyError, cache.quoteError].filter(Boolean).join(" ") ||
        null,
    };
  }
}
