import { useEffect, useRef, useState } from "react";
import type { ChartSymbol, MarketChart } from "../../shared/model";
import { isMarketOpen } from "../lib/marketWindow";

export function useMarketChart(
  symbol: ChartSymbol,
  enabled: boolean,
  identity: string,
) {
  const cache = useRef(new Map<string, MarketChart>());
  const key = `${identity}:${symbol}`;
  const [state, setState] = useState<{
    key: string;
    data: MarketChart | null;
    error: string;
    loading: boolean;
  }>({ key, data: null, error: "", loading: enabled });
  useEffect(() => {
    let alive = true,
      inFlight = false;
    const controller = new AbortController();
    const saved = cache.current.get(key) ?? null;
    setState({ key, data: saved, error: "", loading: enabled && !saved });
    if (!enabled) return;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/market/chart?symbol=${symbol}`, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30_000),
          ]),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Market data is unavailable.");
        if (alive) {
          if (cache.current.size > 8) cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(key, body);
          setState({ key, data: body, error: "", loading: false });
        }
      } catch (e) {
        if (alive)
          setState((previous) => ({
            ...previous,
            loading: false,
            error:
              e instanceof Error ? e.message : "Could not refresh market data.",
          }));
      } finally {
        inFlight = false;
      }
    }
    void refresh();
    const intervalMs = isMarketOpen() ? 3000 : 30_000;
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, intervalMs);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [symbol, enabled, identity, key]);
  return state.key === key && enabled ? state : { data: null, error: "", loading: enabled };
}
