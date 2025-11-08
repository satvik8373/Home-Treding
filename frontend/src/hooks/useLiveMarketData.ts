import { useState, useEffect, useCallback, useRef } from 'react';
import { liveMarketService, MarketData } from '../services/liveMarketService';

interface UseLiveMarketDataOptions {
  /** Polling interval in milliseconds (default: 250ms for ultra-fast updates) */
  interval?: number;
  /** Auto-start polling on mount (default: true) */
  autoStart?: boolean;
  /** Specific symbols to watch (optional) */
  symbols?: string[];
}

interface UseLiveMarketDataReturn {
  /** Current market data */
  data: MarketData[];
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
 * React hook for live market data with automatic polling
 * 
 * @example
 * ```tsx
 * const { data, loading, isPolling } = useLiveMarketData({ interval: 500 });
 * ```
 */
export function useLiveMarketData(
  options: UseLiveMarketDataOptions = {}
): UseLiveMarketDataReturn {
  const {
    interval = 250, // Ultra-fast: 250ms = 4 updates per second
    autoStart = true,
    symbols
  } = options;

  const [data, setData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  
  const subscriberIdRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Callback for market data updates
  const handleDataUpdate = useCallback((newData: MarketData[]) => {
    if (!isMountedRef.current) return;
    
    setData(newData);
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
      
      const newData = symbols && symbols.length > 0
        ? await liveMarketService.fetchLiveData(symbols)
        : await liveMarketService.fetchMarketData();
      
      if (isMountedRef.current) {
        setData(newData);
        setLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
        setLoading(false);
      }
    }
  }, [symbols]);

  // Auto-start on mount
  useEffect(() => {
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
    loading,
    error,
    start,
    stop,
    refresh,
    isPolling
  };
}

/**
 * Hook for watching specific symbols only (Ultra-fast updates)
 */
export function useWatchlist(symbols: string[], interval: number = 250) {
  return useLiveMarketData({ symbols, interval });
}

/**
 * Hook for single symbol (Ultra-fast updates)
 */
export function useSymbol(symbol: string, interval: number = 250) {
  const { data, ...rest } = useLiveMarketData({ 
    symbols: [symbol], 
    interval 
  });
  
  return {
    data: data[0] || null,
    ...rest
  };
}
