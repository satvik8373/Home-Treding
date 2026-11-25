import { SessionTable } from './SessionTable'
import { Download, Inbox } from 'lucide-react'
import type { TradingSession, OrderAudit as OrderAuditRecord } from '../../shared/model'
import { calendarDate, clock, price } from '../lib/format'

export function OrdersPanel({
  session,
  customOrders,
  titleSuffix,
}: {
  session?: TradingSession
  customOrders?: OrderAuditRecord[]
  titleSuffix?: string
}) {
  const orders = customOrders
    ? [...customOrders].sort((a, b) => b.submittedAt - a.submittedAt)
    : [...(session?.orderAudit ?? [])].reverse()
  const pending = !customOrders && session?.pending && !orders.some(order => order.id === session.pending?.id) ? session.pending : null
  const totalCount = orders.length + (pending ? 1 : 0)

  return (
    <section className="panel orders-panel neo-orders-panel" aria-labelledby="orders-title">
      <div className="panel-title orders-panel-title">
        <div className="orders-title-group">
          <h2 id="orders-title">
            Orders{titleSuffix ? ` (${titleSuffix})` : ''} <span className="count">{totalCount}</span>
          </h2>
        </div>
        {(session || (customOrders && customOrders.length > 0)) && (
          <a className="text-button neo-export-btn" href="/api/orders.csv">
            <Download size={13} />
            <span>Orders CSV</span>
          </a>
        )}
      </div>

      {totalCount > 0 ? (
        <SessionTable label="Order records">
          <table className="session-data-table original-record-table neo-record-table">
            <thead>
              <tr>
                {['Submitted IST', 'Contract', 'Action', 'Qty', 'Status', 'Filled / average', 'Order ID', 'Details'].map(label => (
                  <th scope="col" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending && (
                <tr className="order-row-pending">
                  <td className="record-datetime">{calendarDate(pending.submittedAt)} | {clock(pending.submittedAt, true)}</td>
                  <td className="contract-cell"><span className="contract-name">{pending.symbol}</span></td>
                  <td>
                    <span className={`tag order-action-pill ${pending.transaction.toLowerCase()}`}>
                      {pending.transaction}
                    </span>
                  </td>
                  <td className="tabular-cell">{pending.quantity}</td>
                  <td>
                    <span className="order-status-pill pending">
                      Awaiting confirmation
                    </span>
                  </td>
                  <td className="tabular-cell">Unknown</td>
                  <td className="subtle-mono-cell">{pending.orderId ?? 'Awaiting broker ID'}</td>
                  <td className="audit-detail-cell">Reconciliation in progress</td>
                </tr>
              )}
              {orders.map(order => {
                const isRejected = order.status === 'rejected'
                const isConfirmed = order.status === 'acknowledged' || order.status === 'simulated'
                const isBuy = order.transaction === 'BUY'
                return (
                  <tr key={order.id} className={`order-row ${order.status}`}>
                    <td className="record-datetime">{calendarDate(order.submittedAt)} | {clock(order.submittedAt, true)}</td>
                    <td className="contract-cell"><span className="contract-name">{order.symbol}</span></td>
                    <td>
                      <span className={`tag order-action-pill ${isBuy ? 'buy' : 'sell'}`}>
                        {order.transaction}
                      </span>
                    </td>
                    <td className="tabular-cell">{order.quantity}</td>
                    <td>
                      <span className={`order-status-pill ${isRejected ? 'rejected' : isConfirmed ? 'filled' : 'neutral'}`}>
                        {order.mode === 'paper' ? 'Paper · ' : ''}{order.status.replaceAll('-', ' ')}
                      </span>
                    </td>
                    <td className="tabular-cell">
                      {order.filled ?? 'Unknown'} / {order.average == null ? '—' : `₹${price(order.average)}`}
                    </td>
                    <td className="subtle-mono-cell">{order.orderId ?? 'No broker ID'}</td>
                    <td className="audit-detail-cell">{order.detail}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </SessionTable>
      ) : (
        <div className="trade-empty neo-empty-box">
          <Inbox size={24} className="empty-icon" />
          <p className="empty-title">No order submissions recorded for this selection.</p>
          <small className="empty-sub">Active strategy executions and broker submissions will appear here in real time.</small>
        </div>
      )}
    </section>
  )
}
