import { directionOf, referenceStop } from '../../shared/strategy';
import { targetPrice } from '../../shared/targets';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';
import type {
  CandlestickData,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { CandlestickChart, TrendingUp, Maximize2, RefreshCw } from 'lucide-react';
import type { ChartSymbol, Leg, Mark, Trade } from '../../shared/model';
import { useMarketChart } from '../hooks/useMarketChart';
import { chartCandles, tradeMarkers } from '../lib/chartData';
import { price } from '../lib/format';
import { freshMark } from '../../shared/market';
import { isMarketOpen } from '../lib/marketWindow';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StrategySettings } from '../../shared/settings';

type Props = {
  settings?: StrategySettings;
  connected: boolean;
  identity: string;
  now: number;
  marks: Record<string, Mark>;
  legs: Partial<Record<'CE' | 'PE', Leg>>;
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
  const [symbol, setSymbol] = useState<ChartSymbol>('NIFTY');
  const [chartType, setChartType] = useState<'candles' | 'line'>('candles');

  const { data, error, loading } = useMarketChart(
    symbol,
    connected,
    `${identity}:${symbol === 'NIFTY' ? 'index' : (legs[symbol]?.contract.token ?? 'unlocked')}`,
  );
  const payload = data?.symbol === symbol ? data : null;

  const [selection, setSelection] = useState<{
    key: string;
    bar: { open: number; high: number; low: number; close: number };
  } | null>(null);

  const hoverIdentity = `${identity}:${symbol}`;
  const selectionKey = useRef(hoverIdentity);
  const hover = selection?.key === hoverIdentity ? selection.bar : null;

  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const liveLine = useRef<IPriceLine | null>(null);
  const levels = useRef<IPriceLine[]>([]);
  const drawn = useRef<CandlestickData<UTCTimestamp>[]>([]);

  const leg = symbol === 'NIFTY' ? undefined : legs[symbol];
  const token = payload?.token ?? leg?.contract.token ?? (symbol === 'NIFTY' ? '26000' : '');
  const mark = marks[token];
  const marketOpen = isMarketOpen(now);

  const live =
    marketOpen && freshMark(mark, now) && mark.receivedAt > (payload?.quote?.receivedAt ?? 0)
      ? mark
      : payload?.quote;

  const fresh =
    marketOpen &&
    !!live &&
    Number.isFinite(live.price) &&
    live.price > 0 &&
    now - live.receivedAt <= 5000 &&
    live.receivedAt <= now + 1000;

  const change =
    live && payload?.quote?.previousClose ? live.price - payload.quote.previousClose : null;
  const percent = change != null && payload?.quote?.previousClose ? (change / payload.quote.previousClose) * 100 : null;

  const points = useMemo(() => chartCandles(payload?.candles ?? []), [payload?.candles]);

  const dayHigh = useMemo(() => {
    if (payload?.candles && payload.candles.length > 0) {
      return Math.max(...payload.candles.map((c) => c.high));
    }
    return payload?.quote?.high ?? null;
  }, [payload]);

  const dayLow = useMemo(() => {
    if (payload?.candles && payload.candles.length > 0) {
      return Math.min(...payload.candles.map((c) => c.low));
    }
    return payload?.quote?.low ?? null;
  }, [payload]);

  const referenceClose = leg?.reference.close;
  const upper = leg?.upper;
  const lower = leg?.lower;
  const average = leg?.position?.average;
  const target1Remaining = leg?.position?.target1Remaining;
  const short = directionOf(settings) === 'sell';
  const stopLevel =
    referenceClose != null && (settings.stopLossPoints ?? 0) > 0
      ? referenceStop(referenceClose, settings)
      : null;
  const target1Level = average != null ? targetPrice(settings, 1, average) : null;
  const target2Level = average != null ? targetPrice(settings, 2, average) : null;
  const markerSpec = JSON.stringify(
    payload ? tradeMarkers(trades, payload.candles, payload.title) : [],
  );

  // Initialize chart and series
  useEffect(() => {
    if (!host.current) return;

    const api = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Segoe UI, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#94a3b8', labelBackgroundColor: '#1d1d1f' },
        horzLine: { color: '#94a3b8', labelBackgroundColor: '#1d1d1f' },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.14, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 12,
      },
      localization: {
        locale: 'en-IN',
        timeFormatter: (value: Time) =>
          typeof value === 'number'
            ? new Date(value * 1000).toISOString().slice(11, 16) + ' IST'
            : '',
      },
    });

    let activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
    if (chartType === 'line') {
      activeSeries = api.addSeries(AreaSeries, {
        lineColor: '#007AFF',
        topColor: 'rgba(0, 122, 255, 0.22)',
        bottomColor: 'rgba(0, 122, 255, 0.01)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    } else {
      activeSeries = api.addSeries(CandlestickSeries, {
        upColor: '#16a34a',
        downColor: '#dc2626',
        borderVisible: false,
        wickUpColor: '#16a34a',
        wickDownColor: '#dc2626',
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }

    chart.current = api;
    series.current = activeSeries;
    markers.current = createSeriesMarkers(activeSeries, []);

    api.subscribeCrosshairMove((event) => {
      const item = event.seriesData.get(activeSeries);
      if (item && 'open' in item) {
        setSelection({
          key: selectionKey.current,
          bar: {
            open: (item as CandlestickData).open,
            high: (item as CandlestickData).high,
            low: (item as CandlestickData).low,
            close: (item as CandlestickData).close,
          },
        });
      } else if (item && 'value' in item) {
        setSelection({
          key: selectionKey.current,
          bar: {
            open: item.value,
            high: item.value,
            low: item.value,
            close: item.value,
          },
        });
      } else {
        setSelection(null);
      }
    });

    // ResizeObserver ensures chart never collapses or has zero width
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length || !chart.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.current.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(host.current);

    return () => {
      resizeObserver.disconnect();
      api.remove();
      chart.current = null;
      series.current = null;
      markers.current = null;
      liveLine.current = null;
      levels.current = [];
      drawn.current = [];
    };
  }, [chartType]);

  // Reset series data when symbol or identity changes
  useEffect(() => {
    selectionKey.current = hoverIdentity;
    series.current?.setData([]);
    markers.current?.setMarkers([]);
    drawn.current = [];
    if (liveLine.current && series.current) {
      series.current.removePriceLine(liveLine.current);
    }
    liveLine.current = null;
    for (const line of levels.current) {
      series.current?.removePriceLine(line);
    }
    levels.current = [];
  }, [identity, symbol, hoverIdentity]);

  // Sync candle data with series
  useEffect(() => {
    const s = series.current;
    const api = chart.current;
    if (!s || !api || !points.length) return;

    const previous = drawn.current;
    if (JSON.stringify(previous) === JSON.stringify(points)) return;

    if (chartType === 'line') {
      const lineData = points.map((p) => ({ time: p.time, value: p.close }));
      (s as ISeriesApi<'Area'>).setData(lineData);
    } else {
      (s as ISeriesApi<'Candlestick'>).setData(points);
    }

    if (!previous.length) {
      api.timeScale().fitContent();
    } else {
      api.timeScale().scrollToRealTime();
    }
    drawn.current = points;
  }, [points, chartType]);

  // Sync LTP live price line
  useEffect(() => {
    if (!series.current || !live) return;
    const options = {
      price: live.price,
      color: fresh ? '#007AFF' : '#94a3b8',
      lineWidth: 1 as const,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: !marketOpen ? 'Last close' : fresh ? 'LTP' : 'Last quote',
    };
    if (liveLine.current) {
      liveLine.current.applyOptions(options);
    } else {
      liveLine.current = series.current.createPriceLine(options);
    }
  }, [live, fresh, symbol, identity, marketOpen]);

  // Sync strategy levels (Reference, Breakout, Exit, Targets, Stop)
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    for (const line of levels.current) s.removePriceLine(line);
    levels.current = [];
    if (referenceClose == null || upper == null || lower == null) return;

    const lines = [
      { value: referenceClose, label: 'Reference', color: '#64748b' },
      { value: upper, label: short ? 'Upper exit' : 'Breakout', color: '#0284c7' },
      { value: lower, label: short ? 'Breakout' : 'Lower exit', color: '#e11d48' },
    ];
    if (average != null) {
      lines.push(
        { value: average, label: 'Avg fill', color: '#7c3aed' },
        ...(settings.target1Lots && target1Level != null
          ? [
              {
                value: target1Level,
                label: target1Remaining ? 'T1' : 'T1 filled',
                color: '#16a34a',
              },
            ]
          : []),
        ...(target2Level != null ? [{ value: target2Level, label: 'T2', color: '#059669' }] : []),
        ...(stopLevel != null && stopLevel > 0
          ? [{ value: stopLevel, label: 'Reference stop', color: '#dc2626' }]
          : []),
      );
    }

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
    referenceClose,
    upper,
    lower,
    average,
    target1Remaining,
    settings.target1Lots,
    target1Level,
    target2Level,
    stopLevel,
    short,
    symbol,
    identity,
  ]);

  // Sync fill markers
  useEffect(() => {
    markers.current?.setMarkers(JSON.parse(markerSpec));
  }, [markerSpec, identity, symbol]);

  return (
    <section className="fintech-chart-card" aria-label="Official market chart">
      {/* 1. Header Row: Instrument Selector & View Toggle (Matches Reference Screen 2) */}
      <div className="fintech-chart-header">
        <div className="instrument-pill-group" role="tablist" aria-label="Select instrument">
          {(['NIFTY', 'CE', 'PE'] as ChartSymbol[]).map((val) => {
            const label =
              val === 'NIFTY'
                ? 'NIFTY 50'
                : val === 'CE'
                  ? `CALL ${legs.CE ? `${legs.CE.contract.strike}` : 'ATM'}`
                  : `PUT ${legs.PE ? `${legs.PE.contract.strike}` : 'ATM'}`;
            return (
              <button
                key={val}
                role="tab"
                aria-selected={symbol === val}
                className={`instrument-pill ${symbol === val ? 'active' : ''}`}
                onClick={() => setSymbol(val)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="chart-view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
            title="Line view" aria-label="Line view" aria-pressed={chartType === 'line'}
          >
            <TrendingUp size={13} />
            <span className="view-label">Line</span>
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${chartType === 'candles' ? 'active' : ''}`}
            onClick={() => setChartType('candles')}
            title="Candlestick view" aria-label="Candlestick view" aria-pressed={chartType === 'candles'}
          >
            <CandlestickChart size={13} />
            <span className="view-label">Candles</span>
          </button>
        </div>
      </div>

      {/* 2. Streamlined Quote & Stats Row (Clean 1-line Fintech Row) */}
      <div className="fintech-chart-quote-bar">
        <div className="quote-main-col">
          <div className="quote-price-line">
            <span className="quote-large-price">
              {live?.price != null ? `₹${price(live.price)}` : '—'}
            </span>
            {change != null && (
              <span className={`quote-change-badge ${change >= 0 ? 'positive' : 'negative'}`}>
                {change >= 0 ? '+' : ''}{price(change)} ({percent != null && percent >= 0 ? '+' : ''}{percent?.toFixed(2)}%)
              </span>
            )}
            <span className={`quote-feed-pill ${!marketOpen ? 'closed' : fresh ? 'live' : 'delayed'}`}>
              <i className={`status-dot ${!marketOpen ? 'closed' : fresh ? 'green' : ''}`} />
              {!marketOpen ? 'Market Closed' : fresh ? 'Live' : connected ? 'Polling' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="quote-hl-col">
          <div className="quote-hl-box">
            <span className="hl-label">HIGH</span>
            <strong className="hl-val">{dayHigh != null ? `₹${price(dayHigh)}` : '—'}</strong>
          </div>
          <div className="quote-hl-box">
            <span className="hl-label">LOW</span>
            <strong className="hl-val">{dayLow != null ? `₹${price(dayLow)}` : '—'}</strong>
          </div>
        </div>
      </div>

      {/* 3. Subtle OHLC readout only when inspecting a candle */}
      {hover && (
        <div className="fintech-chart-ohlc">
          <div className="ohlc-metrics">
            <span>O <b>{price(hover.open)}</b></span>
            <span>H <b>{price(hover.high)}</b></span>
            <span>L <b>{price(hover.low)}</b></span>
            <span>C <b>{price(hover.close)}</b></span>
          </div>
          <span className="ohlc-tag">Selected Candle</span>
        </div>
      )}

      {/* 4. Chart Canvas Container */}
      <div className="fintech-chart-canvas-wrap">
        <div ref={host} className="chart-canvas-element" />
        {!points.length && (
          <div className="chart-empty-overlay">
            <CandlestickChart size={28} strokeWidth={1.4} />
            <h3>
              {!connected
                ? 'Connect your broker to see the live chart'
                : loading
                  ? 'Loading market candles…'
                  : symbol !== 'NIFTY' && !leg
                    ? 'ATM contracts are not locked yet'
                    : 'No candle history available'}
            </h3>
            <p>
              {!connected
                ? 'NIFTY and option charts stream live from official broker feeds.'
                : error || payload?.warning || 'Official candles appear when trading session data is active.'}
            </p>
          </div>
        )}
      </div>

      {/* 5. Timeframe Selector Pills (Matches Reference Screen 2 Timeframe Bar) */}
      <div className="fintech-chart-timeframe-bar">
        <div className="tf-pills-group">
          <span className="chart-cadence">5-minute candles</span>
        </div>

        <button
          className="timeframe-fit-btn"
          onClick={() => chart.current?.timeScale().fitContent()}
          title="Fit chart content"
          aria-label="Fit chart content"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* 6. Clean Subtle Footer */}
      <div className="fintech-chart-footer">
        <div className="footer-status-info">
          <RefreshCw size={11} className={loading || payload?.historyLoading ? 'spin-icon' : ''} />
          <span>
            {loading || payload?.historyLoading
              ? 'Loading candles…'
              : error || payload?.warning || 'mStock OHLC · 5-minute candles'}
          </span>
          {payload?.contract && (
            <span className="contract-tag">
              Lot {payload.contract.lotSize} · Expiry {payload.contract.expiry}
            </span>
          )}
        </div>
        <div className="chart-attribution">
          <span>Lightweight Charts™</span>
        </div>
      </div>
    </section>
  );
}
