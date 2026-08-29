import React from 'react';
import { useLiveMarketData } from '../hooks/useLiveMarketData';
import './LiveMarketTicker.css';

interface LiveMarketTickerProps {
  /** Update interval in milliseconds */
  interval?: number;
  /** Show only specific symbols */
  symbols?: string[];
}

export const LiveMarketTicker: React.FC<LiveMarketTickerProps> = ({ 
  interval = 3000,
  symbols 
}) => {
  const { data, loading, isPolling, isMarketOpen, marketStatus } = useLiveMarketData({ 
    interval,
    symbols,
    autoStart: true 
  });

  if (loading && data.length === 0) {
    return (
      <div className="live-ticker loading">
        <div className="ticker-item skeleton">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="live-ticker">
      <div className="ticker-status">
        <span className={`status-indicator ${isMarketOpen ? (isPolling ? 'live' : 'paused') : 'closed'}`}>
          {isMarketOpen ? (isPolling ? '🔴 LIVE' : '⏸️ PAUSED') : '⏸️ MARKET CLOSED'}
        </span>
        <span className="update-rate">
          {isMarketOpen ? `${interval / 1000}s updates` : (marketStatus?.nextOpen || 'NSE/BSE Closing Prices')}
        </span>
        {marketStatus?.istTime && (
          <span className="ticker-ist-time">IST: {marketStatus.istTime}</span>
        )}
      </div>
      
      <div className="ticker-scroll">
        {data.map((item) => {
          const changeVal = parseFloat(item.change);
          const isPositive = !isNaN(changeVal) && changeVal >= 0;
          
          return (
            <div key={item.symbol} className="ticker-item">
              <span className="symbol">{item.symbol}</span>
              <span className="ltp">₹{item.ltp}</span>
              <span className={`change ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '+' : ''}{item.change} ({isPositive ? '+' : ''}{item.changePercent}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveMarketTicker;
