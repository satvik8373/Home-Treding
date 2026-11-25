import { SessionTable } from './SessionTable'
import { Download, Layers } from 'lucide-react'
import type { Trade } from '../../shared/model'
import { calendarDate, clock, money, price } from '../lib/format'

export function TradesPanel({
  trades,
  exportAvailable = true,
  titleSuffix,
}: {
  trades: Trade[]
  exportAvailable?: boolean
  titleSuffix?: string
}) {
  const sortedTrades = [...trades].sort((a, b) => b.at - a.at)

  return (
    <section className="panel trades-panel neo-trades-panel">
      <div className="panel-title trades-panel-title">
        <div className="trades-title-group">
          <h2>
            Trades{titleSuffix ? ` (${titleSuffix})` : ''} <span className="count">{trades.length}</span>
          </h2>
        </div>
        {exportAvailable && (
          <div className="trades-actions-group">
            <a className="text-button neo-export-btn" href="/api/trades.csv">
              <Download size={13} />
              <span>Trades CSV</span>
            </a>
            <a className="text-button neo-export-btn" href="/api/orders.csv">
              <Download size={13} />
              <span>Orders CSV</span>
            </a>
          </div>
        )}
      </div>
      {sortedTrades.length ? (
        <SessionTable label="Trade records">
          <table className="session-data-table original-record-table neo-record-table">
            <thead>
              <tr>
                {[
                  'Date / time IST',
                  'Contract',
                  'Action',
                  'Qty',
                  'Fill',
                  'Premium amount',
                  'Reason',
                  'Gross P&L',
                  'Order',
                ].map(title => (
                  <th scope="col" key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map(t => {
                const isBuy = t.transaction === 'BUY'
                const isPos = t.pnl != null && t.pnl > 0
                const isNeg = t.pnl != null && t.pnl < 0
                return (
                  <tr key={t.id} className="trade-row">
                    <td className="record-datetime">{calendarDate(t.at)} | {clock(t.at, true)}</td>
                    <td className="contract-cell"><span className="contract-name">{t.symbol}</span></td>
                    <td>
                      <span className={`tag order-action-pill ${isBuy ? 'buy positive' : 'sell'}`}>
                        {t.transaction}
                      </span>
                    </td>
                    <td className="tabular-cell">{t.quantity}</td>
                    <td className="tabular-cell">₹{price(t.price)}</td>
                    <td className="tabular-cell">{money(t.quantity * t.price)}</td>
                    <td className="reason-cell">{t.reason.replaceAll('_', ' ')}</td>
                    <td className={`tabular-cell ${isPos ? 'positive-value' : isNeg ? 'negative-value' : ''}`}>
                      {money(t.pnl)}
                    </td>
                    <td className="subtle subtle-mono-cell">
                      {t.mode === 'paper' ? 'Paper' : t.orderId}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </SessionTable>
      ) : (
        <div className="trade-empty neo-empty-box">
          <Layers size={24} className="empty-icon" />
          <p className="empty-title">No trades recorded for this selection.</p>
          <small className="empty-sub">Executed fills from strategy breakouts and profit targets will appear here.</small>
        </div>
      )}
    </section>
  )
}
