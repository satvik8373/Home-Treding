import type { TradingSession } from '../../shared/model';
import { dateTime, price } from '../lib/format';
import { Download } from 'lucide-react';

type Props = {
  session?: TradingSession;
  hideHeader?: boolean;
};

export function OrdersPanel({ session, hideHeader = false }: Props) {
  const orders = [...(session?.orderAudit ?? [])].reverse();
  const pending = session?.pending && !orders.some(order => order.id === session.pending?.id) ? session.pending : null;

  return (
    <section className="fintech-orders-container" aria-label="Session orders">
      {!hideHeader && (
        <div className="orders-header-row">
          <div className="orders-title-group">
            <h2>Session Orders</h2>
            <span className="orders-count-badge">{orders.length + (pending ? 1 : 0)}</span>
          </div>
          {session && orders.length > 0 && (
            <a className="export-link-btn" href="/api/orders.csv">
              <Download size={13} />
              <span>Orders CSV</span>
            </a>
          )}
        </div>
      )}

      {orders.length || pending ? (
        <div className="orders-feed">
          {pending && (
            <div className="order-feed-item pending-item">
              <div className="item-col-left">
                <span className={`trade-badge ${pending.transaction === 'BUY' ? 'buy' : 'sell'}`}>
                  {pending.transaction}
                </span>
                <div className="item-identity">
                  <strong className="item-symbol">{pending.symbol}</strong>
                  <span className="item-time">{dateTime(pending.submittedAt)} IST · Confirmation pending</span>
                </div>
              </div>
              <div className="item-col-center">
                <span className="item-qty">{pending.quantity} units</span>
                <span className="item-reason">{pending.reason.replaceAll('_', ' ')}</span>
              </div>
              <div className="item-col-right">
                <span className="item-status-pill pending">Awaiting Confirmation</span>
              </div>
            </div>
          )}

          {orders.map((order) => {
            const isBuy = order.transaction === 'BUY';
            const isFilled = order.status.toLowerCase().includes('fill') || order.status.toLowerCase().includes('complete');
            const isRejected = order.status.toLowerCase().includes('reject') || order.status.toLowerCase().includes('fail');

            return (
              <div key={order.id} className="order-feed-item">
                <div className="item-col-left">
                  <span className={`trade-badge ${isBuy ? 'buy' : 'sell'}`}>
                    {order.transaction}
                  </span>
                  <div className="item-identity">
                    <strong className="item-symbol">{order.symbol}</strong>
                    <span className="item-time">
                      {dateTime(order.submittedAt)} · {order.mode === 'paper' ? 'Paper' : 'Live'}
                    </span>
                  </div>
                </div>

                <div className="item-col-center">
                  <span className="item-qty">{order.quantity} units</span>
                  <span className="item-reason">{order.reason.replaceAll('_', ' ')}</span><span className="order-fill-detail">Filled {order.filled ?? 'Unknown'} / {order.quantity}</span>
                </div>

                <div className="item-col-right">
                  <strong className="item-price">
                    {order.average != null ? `₹${price(order.average)}` : 'Fill price unavailable'}
                  </strong>
                  <span
                    className={`item-status-pill ${
                      isFilled ? 'filled' : isRejected ? 'rejected' : 'normal'
                    }`}
                  >
                    {order.mode === 'paper' ? 'Paper · ' : ''}{order.status.replaceAll('-', ' ')}
                  </span>
                </div>
                <div className="order-submission-detail">{order.orderId && <span>Order ID {order.orderId}</span>}<span>{order.detail}</span></div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="orders-empty-state">
          <p>No order submissions recorded for this session.</p>
        </div>
      )}
    </section>
  );
}
