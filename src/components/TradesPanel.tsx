import { Download } from 'lucide-react'
import type { Trade } from '../../shared/model'
import { dateTime, money, price } from '../lib/format'

type Props = { trades: Trade[]; exportAvailable?: boolean; title?: string }
export function TradesPanel({ trades, exportAvailable = false, title = 'Executed trades' }: Props) {
  return <section className="fintech-trades-container session-table-panel" aria-label="Session trades">
    <div className="trades-header-row"><div className="trades-title-group"><h2>{title}</h2><span className="trades-count-badge">{trades.length}</span></div>{exportAvailable && trades.length > 0 && <a className="export-link-btn" href="/api/trades.csv"><Download size={13} />Trades CSV</a>}</div>
    {trades.length ? <div className="session-table-scroll" tabIndex={0} role="region" aria-label="Trade records; scroll horizontally for all columns"><table className="session-data-table">
      <caption className="visually-hidden">Confirmed session fills, newest first. Paper fills are simulated. All timestamps are IST.</caption>
      <thead><tr>{['Date / time IST', 'Contract', 'Action', 'Qty', 'Fill price', 'Premium amount', 'Gross P&L', 'Reason', 'Mode', 'Broker order ID'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{[...trades].reverse().map(trade => <tr key={trade.id}>
        <td>{dateTime(trade.at)}</td><td>{trade.symbol}</td><td><span className={`table-status ${trade.transaction === 'BUY' ? 'positive-text' : ''}`}>{trade.transaction}</span></td><td className="numeric">{trade.quantity}</td><td className="numeric">₹{price(trade.price)}</td><td className="numeric">{money(trade.quantity * trade.price)}</td>
        <td className={`numeric ${trade.pnl != null && trade.pnl < 0 ? 'negative-text' : trade.pnl != null && trade.pnl > 0 ? 'positive-text' : ''}`}>{trade.pnl == null ? trade.reason === 'BREAKOUT' ? 'Entry' : 'P&L unverified' : money(trade.pnl)}</td>
        <td>{trade.reason.replaceAll('_', ' ')}</td><td>{trade.mode === 'paper' ? 'Paper' : 'Live'}</td><td>{trade.mode === 'paper' ? 'Simulated' : trade.orderId || 'Not recorded'}</td>
      </tr>)}</tbody>
    </table></div> : <p className="trade-empty">No executed trades yet. Confirmed fills will appear here.</p>}
  </section>
}
