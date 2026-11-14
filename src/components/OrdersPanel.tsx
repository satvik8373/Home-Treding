import { SessionTable } from './SessionTable'
import type { TradingSession } from '../../shared/model'
import { calendarDate, clock, price } from '../lib/format'

export function OrdersPanel({ session }: { session?: TradingSession }) {
  const orders = [...(session?.orderAudit ?? [])].reverse()
  const pending = session?.pending && !orders.some(order => order.id === session.pending?.id) ? session.pending : null
  return <section className="panel orders-panel" aria-labelledby="orders-title">
    <div className="panel-title"><h2 id="orders-title">Orders <span className="count">{orders.length + (pending ? 1 : 0)}</span></h2>{session && <a className="text-button" href="/api/orders.csv">Orders CSV</a>}</div>
    {orders.length || pending ? <SessionTable label="Order records"><table className="session-data-table original-record-table">
      <thead><tr>{['Submitted IST', 'Contract', 'Action', 'Qty', 'Status', 'Filled / average', 'Order ID', 'Details'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>
        {pending && <tr><td className="record-datetime">{calendarDate(pending.submittedAt)} | {clock(pending.submittedAt, true)}</td><td className="contract-cell">{pending.symbol}</td><td>{pending.transaction}</td><td>{pending.quantity}</td><td>Awaiting confirmation</td><td>Unknown</td><td>{pending.orderId ?? 'Awaiting broker ID'}</td><td>Reconciliation in progress</td></tr>}
        {orders.map(order => <tr key={order.id}><td className="record-datetime">{calendarDate(order.submittedAt)} | {clock(order.submittedAt, true)}</td><td className="contract-cell">{order.symbol}</td><td>{order.transaction}</td><td>{order.quantity}</td><td>{order.mode === 'paper' ? 'Paper · ' : ''}{order.status.replaceAll('-', ' ')}</td><td>{order.filled ?? 'Unknown'} / {order.average == null ? '—' : `₹${price(order.average)}`}</td><td>{order.orderId ?? 'No broker ID'}</td><td className="audit-detail-cell">{order.detail}</td></tr>)}
      </tbody>
    </table></SessionTable> : <p className="trade-empty">No order submissions recorded for this session.</p>}
  </section>
}
