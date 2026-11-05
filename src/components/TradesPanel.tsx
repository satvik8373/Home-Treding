import { Download } from "lucide-react";
import type { Trade } from "../../shared/model";
import { clock, money, price } from "../lib/format";

export function TradesPanel({ trades }: { trades: Trade[] }) {
  return (
    <section className="panel trades-panel">
      <div className="panel-title">
        <h2>
          Trades <span className="count">{trades.length}</span>
        </h2>
        <a className="text-button" href="/api/trades.csv">
          <Download size={14} />
          Export
        </a>
      </div>
      {trades.length ? (
        <div className="trade-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Time IST",
                  "Contract",
                  "Action",
                  "Qty",
                  "Fill",
                  "Premium amount",
                  "Reason",
                  "Gross P&L",
                  "Order",
                ].map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...trades].reverse().map((t) => (
                <tr key={t.id}>
                  <td>{clock(t.at, true)}</td>
                  <td className="contract-cell">{t.symbol}</td>
                  <td>
                    <span
                      className={`tag ${t.transaction === "BUY" ? "positive" : ""}`}
                    >
                      {t.transaction}
                    </span>
                  </td>
                  <td>{t.quantity}</td>
                  <td>₹{price(t.price)}</td>
                  <td>{money(t.quantity * t.price)}</td>
                  <td>{t.reason.replaceAll("_", " ")}</td>
                  <td>{money(t.pnl)}</td>
                  <td className="subtle">
                    {t.mode === "paper" ? "Paper" : t.orderId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="trade-empty">
          No trades yet. Confirmed fills will appear here.
        </div>
      )}
    </section>
  );
}
