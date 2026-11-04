import { useEffect, useRef } from "react";
import {
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
} from "lightweight-charts";
import type { EquityPoint } from "../../shared/backtest";
import { chartTime } from "../lib/chartData";

export function BacktestEquity({ points }: { points: EquityPoint[] }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current || !points.length) return;
    const chart = createChart(host.current, {
      autoSize: true,
      height: 235,
      layout: {
        background: { type: ColorType.Solid, color: "#fff" },
        textColor: "#75859a",
        fontSize: 10,
        attributionLogo: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#eff3f7" } },
      rightPriceScale: { borderColor: "#e5eaf0" },
      timeScale: { borderColor: "#e5eaf0", timeVisible: true },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#52779a",
      lineWidth: 2,
      priceLineVisible: false,
    });
    series.setData(
      points.map((point) => ({
        time: chartTime(point.at),
        value: point.netPnl,
      })),
    );
    series.createPriceLine({
      price: 0,
      color: "#a3aebd",
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: false,
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points]);
  return (
    <section className="panel bt-equity">
      <div className="panel-title">
        <h2>Cumulative P&L</h2>
        <span className="subtle">
          5m marked value · assumed costs included · IST
        </span>
      </div>
      <div ref={host} className="bt-equity-canvas" />
    </section>
  );
}
