import { Download } from "lucide-react";
import type { Trade } from "../../shared/model";
import { dateTime, money, price } from "../lib/format";

export function TradesPanel({ trades, exportAvailable = true }: { trades: Trade[]; exportAvailable?: boolean }) {
  return (
    <section className="panel trades-panel">
      <div className="panel-title">
        <h2>
          Trades <span className="count">{trades.length}</span>
        </h2>
        {exportAvailable && <><a className="text-button" href="/api/trades.csv">
          <Download size={14} />
          Trades CSV
        </a>
        <a className="text-button" href="/api/orders.csv"><Download size={14} />Orders CSV</a></>}
      </div>
      {trades.length ? (
        <div className="trade-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Date / time IST",
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
                  <td>{dateTime(t.at)}</td>
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
