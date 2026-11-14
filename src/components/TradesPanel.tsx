import { SessionTable } from './SessionTable'
import { RecordDetails } from './RecordDetails'
import { Download } from 'lucide-react'
import type { Trade, TradingSession } from '../../shared/model'
import { calendarDate, clock, date, money, price } from '../lib/format'

type Props = { session?: TradingSession; trades: Trade[]; exportAvailable?: boolean; title?: string }
export function TradesPanel({ trades, session, exportAvailable = false, title = 'Executed trades' }: Props) {
  return <section className="fintech-trades-container session-table-panel" aria-label="Session trades">
    <div className="trades-header-row"><div className="trades-title-group"><h2>{title}</h2><span className="trades-count-badge">{trades.length}</span></div>{exportAvailable && trades.length > 0 && <a className="export-link-btn" href="/api/trades.csv"><Download size={13} />Trades CSV</a>}</div>
    {trades.length ? <SessionTable label="Trade records"><table className="session-data-table">
      <caption className="visually-hidden">Confirmed session fills, newest first. Paper fills are simulated. All timestamps are IST.</caption>
      <thead><tr>{['Date | Time (IST)', 'Contract', 'Action', 'Qty', 'Fill', 'Gross P&L'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{[...trades].reverse().map(trade => <tr key={trade.id}>
        <td className="record-datetime">{calendarDate(trade.at)} <span aria-hidden="true">|</span> {clock(trade.at, true)}</td><td><strong className="record-contract">{trade.symbol}</strong><small className="record-meta">{trade.side === 'CE' ? 'CALL (CE)' : 'PUT (PE)'} · {trade.mode === 'paper' ? 'Paper' : 'Live'}</small>{session?.legs[trade.side]?.contract.symbol === trade.symbol && <small>Strike {session.legs[trade.side]!.contract.strike.toLocaleString('en-IN')} · Expiry {date(session.legs[trade.side]!.contract.expiry)}</small>}</td><td><span className={`table-status ${trade.transaction === 'BUY' ? 'positive-text' : ''}`}>{trade.transaction}</span><small>{trade.reason === 'BREAKOUT' ? 'Entry' : 'Exit'}</small></td><td className="numeric">{trade.quantity}{session?.legs[trade.side]?.contract.symbol === trade.symbol && session.legs[trade.side]!.contract.lotSize > 0 && <small>{trade.quantity / session.legs[trade.side]!.contract.lotSize} lots</small>}</td><td className="numeric">₹{price(trade.price)}</td>
        <td className={`numeric ${trade.pnl != null && trade.pnl < 0 ? 'negative-text' : trade.pnl != null && trade.pnl > 0 ? 'positive-text' : ''}`}>{trade.pnl == null ? trade.reason === 'BREAKOUT' ? 'Entry' : 'P&L unverified' : money(trade.pnl)}<RecordDetails title="Trade details"><p><strong>{trade.symbol}</strong> · {trade.side === 'CE' ? 'CALL (CE)' : 'PUT (PE)'}</p><p>{calendarDate(trade.at)} | {clock(trade.at, true)} IST</p><p>{trade.reason.replaceAll('_', ' ')}</p><p>Premium amount {money(trade.quantity * trade.price)}</p><p>{trade.mode === 'paper' ? 'Simulated' : `Order ID ${trade.orderId || 'not recorded'}`}</p></RecordDetails></td>
        
      </tr>)}</tbody>
    </table></SessionTable> : <p className="trade-empty">No executed trades yet. Confirmed fills will appear here.</p>}
  </section>
}
