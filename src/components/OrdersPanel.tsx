import type { TradingSession } from '../../shared/model'
import { dateTime, price } from '../lib/format'
import { Download } from 'lucide-react'

type Props = { session?: TradingSession; hideHeader?: boolean }
export function OrdersPanel({ session, hideHeader = false }: Props) {
  const orders = [...(session?.orderAudit ?? [])].reverse()
  const pending = session?.pending && !orders.some(order => order.id === session.pending?.id) ? session.pending : null
  return <section className="fintech-orders-container session-table-panel" aria-label="Session orders">
    {!hideHeader && <div className="orders-header-row"><div className="orders-title-group"><h2>Session orders</h2><span className="orders-count-badge">{orders.length + (pending ? 1 : 0)}</span></div>{session && (orders.length > 0 || pending) && <a className="export-link-btn" href="/api/orders.csv"><Download size={13} />Orders CSV</a>}</div>}
    {orders.length || pending ? <div className="session-table-scroll" tabIndex={0} role="region" aria-label="Order records; scroll horizontally for all columns"><table className="session-data-table">
      <caption className="visually-hidden">Current day-session order submissions, newest first. All timestamps are IST.</caption>
      <thead><tr>{['Submitted / updated IST', 'Contract', 'Action', 'Mode', 'Requested qty', 'Filled qty', 'Average fill', 'Status', 'Reason', 'Broker order ID / tag', 'Details'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>
        {pending && <tr><td>{dateTime(pending.submittedAt)}<small>Awaiting confirmation</small></td><td>{pending.symbol}</td><td>{pending.transaction}</td><td>{session?.mode === 'paper' ? 'Paper' : 'Live'}</td><td className="numeric">{pending.quantity}</td><td>Unknown</td><td>Fill price unavailable</td><td><span className="table-status">Awaiting Confirmation</span></td><td>{pending.reason.replaceAll('_', ' ')}</td><td>{pending.orderId ?? 'No broker ID'}<small>Tag {pending.tag}</small></td><td className="table-detail">Submission outcome is not yet confirmed. Reconciliation is in progress.</td></tr>}
        {orders.map(order => <tr key={order.id}>
          <td>{dateTime(order.submittedAt)}<small>Updated {dateTime(order.updatedAt)}</small></td><td>{order.symbol}</td><td><span className={`table-status ${order.transaction === 'BUY' ? 'positive-text' : ''}`}>{order.transaction}</span></td><td>{order.mode === 'paper' ? 'Paper' : 'Live'}</td>
          <td className="numeric">{order.quantity}</td><td className="numeric">{order.filled ?? 'Unknown'}</td><td className="numeric">{order.average == null ? 'Fill price unavailable' : `₹${price(order.average)}`}</td>
          <td><span className={`table-status ${order.status === 'rejected' ? 'negative-text' : ''}`}>{order.status.replaceAll('-', ' ')}</span></td><td>{order.reason.replaceAll('_', ' ')}</td><td>{order.orderId ?? (order.mode === 'paper' ? 'Simulated' : 'No broker ID')}<small>Tag {order.tag}</small></td><td className="table-detail">{order.detail}</td>
        </tr>)}
      </tbody>
    </table></div> : <p className="trade-empty">No order submissions recorded for this session.</p>}
  </section>
}
