import React from 'react';
import { useLiveMarketData } from '../hooks/useLiveMarketData';
import './LiveMarketTicker.css';

interface LiveMarketTickerProps {
  /** Update interval in milliseconds (default: 250ms for ultra-fast updates) */
  interval?: number;
  /** Show only specific symbols */
  symbols?: string[];
}

export const LiveMarketTicker: React.FC<LiveMarketTickerProps> = ({ 
  interval = 250, // Ultra-fast: 4 updates per second
  symbols 
}) => {
  const { data, loading, isPolling } = useLiveMarketData({ 
    interval,
    symbols,
    autoStart: true 
  });

  if (loading && data.length === 0) {
    return (
      <div className="live-ticker loading">
        <div className="ticker-item skeleton">Loading live data...</div>
      </div>
    );
  }

  return (
    <div className="live-ticker">
      <div className="ticker-status">
        <span className={`status-indicator ${isPolling ? 'live' : 'paused'}`}>
          {isPolling ? '🔴 LIVE' : '⏸️ PAUSED'}
        </span>
        <span className="update-rate">{interval}ms updates</span>
      </div>
      
      <div className="ticker-scroll">
        {data.map((item) => {
          const isPositive = parseFloat(item.change) >= 0;
          
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
