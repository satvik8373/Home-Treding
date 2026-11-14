import { Download } from 'lucide-react';
import type { Trade } from '../../shared/model';
import { dateTime, money, price } from '../lib/format';

type Props = {
  trades: Trade[];
  exportAvailable?: boolean;
  title?: string;
};

export function TradesPanel({ trades, exportAvailable = false, title }: Props) {
  const reversedTrades = [...trades].reverse();

  return (
    <section className="fintech-trades-container" aria-label="Session trades">
      {title && (
        <div className="trades-header-row">
          <div className="trades-title-group">
            <h2>{title}</h2>
            <span className="trades-count-badge">{trades.length}</span>
          </div>
          {exportAvailable && trades.length > 0 && (
            <a className="export-link-btn" href="/api/trades.csv">
              <Download size={13} />
              <span>Trades CSV</span>
            </a>
          )}
        </div>
      )}

      {reversedTrades.length ? (
        <div className="trades-feed">
          {reversedTrades.map((t) => {
            const isBuy = t.transaction === 'BUY';
            const hasPnl = t.pnl != null;
            const isProfit = hasPnl && t.pnl! > 0;
            const isLoss = hasPnl && t.pnl! < 0;

            return (
              <div key={t.id} className="trade-feed-item">
                <div className="item-col-left">
                  <span className={`trade-badge ${isBuy ? 'buy' : 'sell'}`}>
                    {t.transaction}
                  </span>
                  <div className="item-identity">
                    <strong className="item-symbol">{t.symbol}</strong>
                    <span className="item-time">
                      {dateTime(t.at)} · {t.mode === 'paper' ? 'Paper' : 'Live'}
                    </span>
                  </div>
                </div>

                <div className="item-col-center">
                  <span className="item-qty">{t.quantity} units</span>
                  <span className="item-reason">{t.reason.replaceAll('_', ' ')}</span>
                </div>

                <div className="item-col-right">
                  <strong className="item-price">₹{price(t.price)}</strong>
                  <span
                    className={`item-pnl-pill ${
                      isProfit ? 'positive' : isLoss ? 'negative' : 'neutral'
                    }`}
                  >
                    {hasPnl ? `${isProfit ? '+' : ''}${money(t.pnl)}` : t.reason === 'BREAKOUT' ? 'Entry' : 'P&L unverified'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="trades-empty-state">
          <p>No executed trades yet. Confirmed fills will appear here.</p>
        </div>
      )}
    </section>
  );
}
