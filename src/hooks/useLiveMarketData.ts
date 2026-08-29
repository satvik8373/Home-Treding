import { useState, useEffect, useCallback, useRef } from 'react';
import { liveMarketService, MarketData, MarketStatusInfo } from '../services/liveMarketService';

interface UseLiveMarketDataOptions {
  /** Polling interval in milliseconds (default: 3000ms) */
  interval?: number;
  /** Auto-start polling on mount (default: true) */
  autoStart?: boolean;
  /** Specific symbols to watch (optional) */
  symbols?: string[];
}

interface UseLiveMarketDataReturn {
  /** Current market data */
  data: MarketData[];
  /** Market open / closed status */
  marketStatus: MarketStatusInfo | null;
  isMarketOpen: boolean;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
  /** Refresh data once */
  refresh: () => Promise<void>;
  /** Is currently polling */
  isPolling: boolean;
}

/**
 * React hook for live market data with automatic polling and market hours awareness
 */
export function useLiveMarketData(
  options: UseLiveMarketDataOptions = {}
): UseLiveMarketDataReturn {
  const {
    interval = 3000,
    autoStart = true,
    symbols
  } = options;

  const [data, setData] = useState<MarketData[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatusInfo | null>(liveMarketService.getMarketStatus());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  
  const subscriberIdRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Callback for market data updates
  const handleDataUpdate = useCallback((newData: MarketData[], newStatus?: MarketStatusInfo) => {
    if (!isMountedRef.current) return;
    
    setData(newData);
    if (newStatus) {
      setMarketStatus(newStatus);
    }
    setLoading(false);
    setError(null);
  }, []);

  // Start polling
  const start = useCallback(() => {
    if (subscriberIdRef.current) return; // Already polling

    setIsPolling(true);
    setLoading(true);
    
    subscriberIdRef.current = liveMarketService.startPolling(
      handleDataUpdate,
      interval
    );
  }, [handleDataUpdate, interval]);

  // Stop polling
  const stop = useCallback(() => {
    if (subscriberIdRef.current) {
      liveMarketService.stopPolling(subscriberIdRef.current);
      subscriberIdRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Refresh data once
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await liveMarketService.fetchMarketData();
      
      if (isMountedRef.current) {
        if (symbols && symbols.length > 0) {
          const filtered = res.data.filter(d => symbols.includes(d.symbol));
          setData(filtered);
        } else {
          setData(res.data);
        }
        setMarketStatus(res.status);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [symbols]);

  // Auto-start on mount
  useEffect(() => {
    isMountedRef.current = true;
    if (autoStart) {
      start();
    }

    return () => {
      isMountedRef.current = false;
      stop();
    };
  }, [autoStart, start, stop]);

  // Update interval if changed
  useEffect(() => {
    if (isPolling) {
      liveMarketService.setPollingInterval(interval);
    }
  }, [interval, isPolling]);

  return {
    data,
    marketStatus,
    isMarketOpen: marketStatus ? marketStatus.isOpen : true,
    loading,
    error,
    start,
    stop,
    refresh,
    isPolling
  };
}

/**
 * Hook for watching specific symbols only
 */
export function useWatchlist(symbols: string[], interval: number = 3000) {
  return useLiveMarketData({ symbols, interval });
}

/**
 * Hook for single symbol
 */
export function useSymbol(symbol: string, interval: number = 3000) {
  const { data, ...rest } = useLiveMarketData({ 
    symbols: [symbol], 
    interval 
  });
  
  return {
    data: data[0] || null,
    ...rest
  };
}
