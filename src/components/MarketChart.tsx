import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import type {
  CandlestickData,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { CandlestickChart, Maximize2, RefreshCw } from "lucide-react";
import type { ChartSymbol, Leg, Mark, Trade } from "../../shared/model";
import { useMarketChart } from "../hooks/useMarketChart";
import { chartCandles, tradeMarkers } from "../lib/chartData";
import { clock, price } from "../lib/format";
import { freshMark } from '../../shared/market';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';

type Props = {
  settings?: StrategySettings;
  connected: boolean;
  identity: string;
  now: number;
  marks: Record<string, Mark>;
  legs: Partial<Record<"CE" | "PE", Leg>>;
  trades: Trade[];
};
export function MarketChart({
  settings = DEFAULT_SETTINGS,
  connected,
  identity,
  now,
  marks,
  legs,
  trades,
}: Props) {
  const [symbol, setSymbol] = useState<ChartSymbol>("NIFTY");
  const { data, error, loading } = useMarketChart(
    symbol,
    connected,
    `${identity}:${symbol === "NIFTY" ? "index" : (legs[symbol]?.contract.token ?? "unlocked")}`,
  );
  const payload = data?.symbol === symbol ? data : null;
  const [selection, setSelection] = useState<{ key: string; bar: {
    open: number;
    high: number;
    low: number;
    close: number;
  } } | null>(null);
  const hoverIdentity = `${identity}:${symbol}`;
  const selectionKey = useRef(hoverIdentity);
  const hover = selection?.key === hoverIdentity ? selection.bar : null;
  const host = useRef<HTMLDivElement>(null),
    chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null),
    liveLine = useRef<IPriceLine | null>(null);
  const levels = useRef<IPriceLine[]>([]),
    drawn = useRef<CandlestickData<UTCTimestamp>[]>([]);
  const leg = symbol === "NIFTY" ? undefined : legs[symbol];
  const token =
    payload?.token ??
    leg?.contract.token ??
    (symbol === "NIFTY" ? "26000" : "");
  const mark = marks[token];
  const live =
    freshMark(mark, now) && mark.receivedAt > (payload?.quote?.receivedAt ?? 0)
      ? mark
      : payload?.quote;
  const fresh = !!live && Number.isFinite(live.price) && live.price > 0 && now - live.receivedAt <= 5000 && live.receivedAt <= now + 1000;
  const change =
    live && payload?.quote?.previousClose
      ? live.price - payload.quote.previousClose
      : null;
  const percent =
    change != null ? (change / payload!.quote!.previousClose!) * 100 : null;
  const latestBar = hover ?? payload?.candles.at(-1);
  const points = useMemo(
    () => chartCandles(payload?.candles ?? []),
    [payload?.candles],
  );
  const referenceClose = leg?.reference.close, upper = leg?.upper, lower = leg?.lower;
  const average = leg?.position?.average, target1Remaining = leg?.position?.target1Remaining;
  const markerSpec = JSON.stringify(payload ? tradeMarkers(trades, payload.candles, payload.title) : []);

  useEffect(() => {
    if (!host.current) return;
    const api = createChart(host.current, {
      autoSize: true,
      height: 390,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#64748b",
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#f1f4f8" },
        horzLines: { color: "#f1f4f8" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#94a3b8", labelBackgroundColor: "#475569" },
        horzLine: { color: "#94a3b8", labelBackgroundColor: "#475569" },
      },
      rightPriceScale: {
        borderColor: "#e5eaf0",
        scaleMargins: { top: 0.16, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "#e5eaf0",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 12,
      },
      localization: {
        locale: "en-IN",
        timeFormatter: (value: Time) =>
          typeof value === "number"
            ? new Date(value * 1000).toISOString().slice(11, 16) + " IST"
            : "",
      },
    });
    const candles = api.addSeries(CandlestickSeries, {
      upColor: "#3d8062",
      downColor: "#bc625b",
      borderVisible: false,
      wickUpColor: "#3d8062",
      wickDownColor: "#bc625b",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.current = api;
    series.current = candles;
    markers.current = createSeriesMarkers(candles, []);
    api.subscribeCrosshairMove((event) => {
      const item = event.seriesData.get(candles);
      setSelection(
        item && "open" in item
          ? {
              key: selectionKey.current,
              bar: {
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              },
            }
          : null,
      );
    });
    return () => {
      api.remove();
      chart.current = null;
      series.current = null;
      markers.current = null;
      liveLine.current = null;
      levels.current = [];
      drawn.current = [];
    };
  }, []);

  useEffect(() => {
    selectionKey.current = hoverIdentity;
    series.current?.setData([]);
    markers.current?.setMarkers([]);
    drawn.current = [];
    if (liveLine.current && series.current)
      series.current.removePriceLine(liveLine.current);
    liveLine.current = null;
    for (const line of levels.current) series.current?.removePriceLine(line);
    levels.current = [];
  }, [identity, symbol, hoverIdentity]);

  useEffect(() => {
    const s = series.current,
      api = chart.current;
    if (!s || !api || !points.length) return;
    const previous = drawn.current;
    if (JSON.stringify(previous) === JSON.stringify(points)) return;
    const corrected =
      points.length < previous.length ||
      previous
        .slice(0, -1)
        .some((old, i) => JSON.stringify(old) !== JSON.stringify(points[i]));
    const following = api.timeScale().scrollPosition() <= 6;
    if (!previous.length || corrected) s.setData(points);
    else
      for (let i = Math.max(0, previous.length - 1); i < points.length; i++)
        if (JSON.stringify(points[i]) !== JSON.stringify(previous[i]))
          s.update(points[i]);
    if (!previous.length) api.timeScale().fitContent();
    else if (following) api.timeScale().scrollToRealTime();
    drawn.current = points;
  }, [points]);

  useEffect(() => {
    if (!series.current || !live) return;
    const options = {
      price: live.price,
      color: fresh ? "#3d638e" : "#94a3b8",
      lineWidth: 1 as const,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: fresh ? "LTP" : "Last quote",
    };
    if (liveLine.current) liveLine.current.applyOptions(options);
    else liveLine.current = series.current.createPriceLine(options);
  }, [live, fresh, symbol, identity]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    for (const line of levels.current) s.removePriceLine(line);
    levels.current = [];
    if (referenceClose == null || upper == null || lower == null) return;
    const lines = [
      { value: referenceClose, label: "Reference", color: "#8c98a8" },
      { value: upper, label: "Breakout", color: "#4d7298" },
      { value: lower, label: "Lower exit", color: "#ad6b63" },
    ];
    if (average != null)
      lines.push(
        { value: average, label: "Avg fill", color: "#6c7489" },
        ...(settings.target1Lots ? [{ value: average + settings.target1Points, label: target1Remaining ? "T1" : "T1 filled", color: "#598269" }] : []),
        { value: average + settings.target2Points, label: "T2", color: "#598269" },
        ...((settings.stopLossPoints ?? 0) > 0 && referenceClose > settings.stopLossPoints! ? [{ value: referenceClose - settings.stopLossPoints!, label: 'Reference stop', color: '#ad6b63' }] : []),
      );
    levels.current = lines.map((line) =>
      s.createPriceLine({
        price: line.value,
        title: line.label,
        color: line.color,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
      }),
    );
  }, [
    referenceClose, upper, lower, average, target1Remaining, settings.target1Lots, settings.target1Points, settings.target2Points, settings.stopLossPoints,
    symbol,
    identity,
  ]);

  useEffect(() => {
    markers.current?.setMarkers(JSON.parse(markerSpec));
  }, [markerSpec, identity, symbol]);

  return (
    <section className="market-panel panel" aria-label="Live market chart">
      <div className="market-toolbar">
        <div
          className="chart-tabs"
          role="tablist"
          aria-label="Chart instrument"
        >
          {(["NIFTY", "CE", "PE"] as ChartSymbol[]).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={symbol === value}
              className={symbol === value ? "active" : ""}
              onClick={() => setSymbol(value)}
            >
              {value === "NIFTY" ? "NIFTY 50" : value === "CE" ? "CALL" : "PUT"}
            </button>
          ))}
        </div>
        <div className="chart-tools">
          <span className="interval-tag">5m</span>
          <span>IST</span>
          <button
            title="Fit all candles"
            aria-label="Fit all candles"
            onClick={() => chart.current?.timeScale().fitContent()}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div className="market-quote">
        <div>
          <span className="market-symbol">
            {payload?.title ??
              (symbol === "NIFTY"
                ? "NIFTY 50"
                : `${symbol === "CE" ? "Call" : "Put"} option`)}
          </span>
          <div className="price-line">
            <strong>{price(live?.price)}</strong>
            {change != null && (
              <span className={change >= 0 ? "positive-text" : "negative-text"}>
                {change >= 0 ? "+" : ""}
                {price(change)} ({percent! >= 0 ? "+" : ""}
                {percent!.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
        <span className={`feed-label ${fresh ? "fresh" : ""}`}>
          <i className={`status-dot ${fresh ? "green" : ""}`} />
          {fresh
            ? live!.source === "websocket"
              ? "Live stream"
              : "REST polling"
            : live
              ? "Quote delayed"
              : connected
                ? "Loading market data"
                : "Broker disconnected"}
          {live && <small>Received {clock(live.receivedAt, true)} · {Math.max(0, Math.floor((now - live.receivedAt) / 1000))}s ago</small>}
        </span>
      </div>
      <div className="market-data-status" aria-label="Market data status">
        <span>{payload?.historyLoading ? 'Fetching candles…' : payload?.historyUpdatedAt ? `History fetched ${clock(payload.historyUpdatedAt, true)} IST` : 'History not received'}</span>
        <span>{payload?.candles.length ?? 0} bars{payload?.candles.at(-1) ? ` · through ${clock(payload.candles.at(-1)!.end)} IST` : ''}</span>
        {payload?.preview && <span>ATM preview · strategy not started</span>}
        {payload?.contract && <span>Lot {payload.contract.lotSize} · expiry {payload.contract.expiry}</span>}
      </div>
      <div className="ohlc-row">
        {(["open", "high", "low", "close"] as const).map((key) => (
          <span key={key}>
            {key[0].toUpperCase()} <b>{price(latestBar?.[key])}</b>
          </span>
        ))}
        <span className="candle-status">
          {hover
            ? "Selected candle"
            : payload?.candles.at(-1) && payload.candles.at(-1)!.end > now
              ? "Current candle · forming"
              : "Last completed candle"}
        </span>
      </div>
      <div className="chart-wrap">
        <div ref={host} className="chart-canvas" />
        {!points.length && (
          <div className="chart-empty">
            <CandlestickChart size={28} strokeWidth={1.4} />
            <h3>
              {!connected
                ? "Connect your broker to see the market"
                : loading
                  ? "Loading official market candles…"
                  : symbol !== "NIFTY" && !leg
                    ? "ATM contracts are not locked yet"
                    : "No candles available"}
            </h3>
            <p>
              {!connected
                ? "NIFTY and option charts use mStock market data."
                : error ||
                  payload?.warning ||
                  "Candles appear when the broker provides this session’s history."}
            </p>
          </div>
        )}
      </div>
      <div className="chart-footer">
        <span>
          <RefreshCw size={12} />
          {loading || payload?.historyLoading
            ? "Loading history"
            : error ||
              payload?.warning ||
              "Official mStock OHLC · current candle may still change"}
        </span>
        {symbol !== "NIFTY" && trades.length > 0 && (
          <span>
            {trades[0].mode === "paper" ? "Paper" : "Confirmed"} fill markers
          </span>
        )}
      </div>
      <div className="chart-attribution">
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView Lightweight Charts™
        </a>
        <span>Copyright © 2025 TradingView, Inc.</span>
      </div>
    </section>
  );
}
