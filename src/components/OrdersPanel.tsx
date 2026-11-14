import type { TradingSession } from '../../shared/model'
import { calendarDate, clock, date, dateTime, price } from '../lib/format'
import { Download } from 'lucide-react'

type Props = { session?: TradingSession; hideHeader?: boolean }
export function OrdersPanel({ session, hideHeader = false }: Props) {
  const orders = [...(session?.orderAudit ?? [])].reverse()
  const pending = session?.pending && !orders.some(order => order.id === session.pending?.id) ? session.pending : null
  return <section className="fintech-orders-container session-table-panel" aria-label="Session orders">
    {!hideHeader && <div className="orders-header-row"><div className="orders-title-group"><h2>Session orders</h2><span className="orders-count-badge">{orders.length + (pending ? 1 : 0)}</span></div>{session && (orders.length > 0 || pending) && <a className="export-link-btn" href="/api/orders.csv"><Download size={13} />Orders CSV</a>}</div>}
    {orders.length || pending ? <div className="session-table-scroll" tabIndex={0} role="region" aria-label="Order records; scroll horizontally for all columns"><table className="session-data-table">
      <caption className="visually-hidden">Current day-session order submissions, newest first. All timestamps are IST.</caption>
      <thead><tr>{['Time (IST)', 'Contract', 'Action', 'Qty / filled', 'Average fill', 'Status'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>
        {pending && <tr><td><strong>{clock(pending.submittedAt, true)}</strong><small>{calendarDate(pending.submittedAt)}</small></td><td><strong>{pending.symbol}</strong><small>{pending.side === 'CE' ? 'CALL (CE)' : 'PUT (PE)'}</small></td><td>{pending.transaction}<small>{pending.reason === 'BREAKOUT' ? 'Entry' : 'Exit'}</small></td><td className="numeric">{pending.quantity}<small>Filled unknown</small></td><td>—</td><td><span className="table-status">Awaiting Confirmation</span><small>{session?.mode === 'paper' ? 'Paper' : 'Live'}</small><details className="table-order-details"><summary>Details</summary><p>{pending.orderId ?? 'No broker ID'}</p><p>{pending.reason.replaceAll('_', ' ')}</p><p>Tag {pending.tag}</p><p>Submission outcome is not yet confirmed. Reconciliation is in progress.</p></details></td></tr>}

        {orders.map(order => <tr key={order.id}>
          <td><strong>{clock(order.submittedAt, true)}</strong><small>{calendarDate(order.submittedAt)}</small></td>
          <td><strong>{order.symbol}</strong><small>{order.side === 'CE' ? 'CALL (CE)' : 'PUT (PE)'}</small>{session?.legs[order.side]?.contract.symbol === order.symbol && <small>Strike {session.legs[order.side]!.contract.strike.toLocaleString('en-IN')} · Expiry {date(session.legs[order.side]!.contract.expiry)}</small>}</td>
          <td><span className={`table-status ${order.transaction === 'BUY' ? 'positive-text' : ''}`}>{order.transaction}</span><small>{order.reason === 'BREAKOUT' ? 'Entry' : 'Exit'}</small></td>
          <td className="numeric">{order.quantity}<small>Filled {order.filled ?? 'Unknown'} / {order.quantity}</small></td><td className="numeric">{order.average == null ? <span title="Fill price unavailable">—</span> : `₹${price(order.average)}`}</td>
          <td><span className={`table-status ${order.status === 'rejected' ? 'negative-text' : ''}`}>{order.status.replaceAll('-', ' ')}</span><small>{order.mode === 'paper' ? 'Paper' : 'Live'}</small><details className="table-order-details"><summary>Details</summary><p>{order.orderId ?? (order.mode === 'paper' ? 'Simulated' : 'No broker ID')}</p><p>{order.reason.replaceAll('_', ' ')}</p><p>Updated {dateTime(order.updatedAt)} IST</p><p>Tag {order.tag}</p><p>{order.detail}</p></details>{order.status === 'rejected' && <small className="negative-text table-rejection">{order.detail}</small>}</td>
        </tr>)}
      </tbody>
    </table></div> : <p className="trade-empty">No order submissions recorded for this session.</p>}
  </section>
}
