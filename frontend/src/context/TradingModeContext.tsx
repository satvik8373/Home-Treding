import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { brokerApi, BrokerSummary } from '../services/brokerApi';

export type TradingMode = 'paper' | 'live';

interface TradingModeContextType {
  mode: TradingMode;
  isLive: boolean;
  isPaper: boolean;
  isBrokerConnected: boolean;
  broker: BrokerSummary | null;
  isLoading: boolean;
  setMode: (targetMode: TradingMode) => Promise<{ success: boolean; message?: string; requiresBroker?: boolean }>;
  toggleMode: () => Promise<{ success: boolean; message?: string; requiresBroker?: boolean }>;
  refreshStatus: () => Promise<void>;
}

const TradingModeContext = createContext<TradingModeContextType | undefined>(undefined);

export const TradingModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<TradingMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mavrix_trading_mode');
      if (saved === 'live' || saved === 'paper') return saved;
    }
    return 'paper';
  });

  const [isBrokerConnected, setIsBrokerConnected] = useState<boolean>(() => brokerApi.hasActiveBroker());
  const [broker, setBroker] = useState<BrokerSummary | null>(() => brokerApi.getActiveBroker());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshStatus = useCallback(async () => {
    try {
      // 1. Check active brokers
      const brokersList = await brokerApi.getBrokers();
      const connected = brokersList.find(b => b.status === 'Connected') || brokersList[0] || null;
      setBroker(connected);
      const hasConnected = !!(connected && (connected.status === 'Connected' || connected.terminalEnabled));
      setIsBrokerConnected(hasConnected);

      // 2. Sync trading mode with backend
      const modeData = await brokerApi.getTradingMode();
      if (modeData && (modeData.mode === 'live' || modeData.mode === 'paper')) {
        setModeState(modeData.mode);
        if (typeof window !== 'undefined') {
          localStorage.setItem('mavrix_trading_mode', modeData.mode);
        }
      }
    } catch (e) {
      console.warn('[TradingModeContext] refreshStatus notice:', e);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const setMode = async (targetMode: TradingMode): Promise<{ success: boolean; message?: string; requiresBroker?: boolean }> => {
    if (targetMode === 'live') {
      // Check if broker is connected
      const hasBroker = isBrokerConnected || brokerApi.hasActiveBroker();
      if (!hasBroker) {
        return {
          success: false,
          requiresBroker: true,
          message: 'Dhan broker account must be connected before switching to Live Real-Money Trading.'
        };
      }
    }

    setIsLoading(true);
    try {
      const res = await brokerApi.setTradingMode(targetMode);
      if (res.success || !res.requiresBroker) {
        setModeState(targetMode);
        if (typeof window !== 'undefined') {
          localStorage.setItem('mavrix_trading_mode', targetMode);
        }
        return { success: true, message: res.message || `Switched to ${targetMode.toUpperCase()} mode` };
      } else {
        return { success: false, requiresBroker: res.requiresBroker, message: res.message };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to switch trading mode' };
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = async (): Promise<{ success: boolean; message?: string; requiresBroker?: boolean }> => {
    const nextMode: TradingMode = mode === 'paper' ? 'live' : 'paper';
    return await setMode(nextMode);
  };

  return (
    <TradingModeContext.Provider
      value={{
        mode,
        isLive: mode === 'live',
        isPaper: mode === 'paper',
        isBrokerConnected,
        broker,
        isLoading,
        setMode,
        toggleMode,
        refreshStatus
      }}
    >
      {children}
    </TradingModeContext.Provider>
  );
};

export const useTradingMode = (): TradingModeContextType => {
  const context = useContext(TradingModeContext);
  if (!context) {
    throw new Error('useTradingMode must be used within a TradingModeProvider');
  }
  return context;
};
