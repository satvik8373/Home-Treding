/**
 * useStrategyConfig — React hook
 *
 * Fetches, caches, and provides live-edit access to the centralized
 * StrategyParameters from the backend API (/api/config/strategy).
 *
 * Usage:
 *   const { config, update, reset, isLoading, isSaving, error } = useStrategyConfig();
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

export interface StrategyParameters {
  niftyLotSize: number;
  bankNiftyLotSize: number;
  finNiftyLotSize: number;
  midcpNiftyLotSize: number;
  sensexLotSize: number;
  entryLots: number;
  breakoutPct: number;
  tradingStartTime: string;
  forceSquareOffTime: string;
  referenceCandleStart: string;
  referenceCandleEnd: string;
  maxDailyLoss: number;
  maxDailyProfit: number;
  maxTradesPerDay: number;
  enableReEntry: boolean;
  orderType: 'MIS' | 'CNC' | 'NRML';
  productType: 'INTRADAY' | 'DELIVERY';
  schemaVersion: number;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface UseStrategyConfigReturn {
  config: StrategyParameters | null;
  defaults: StrategyParameters | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  success: string | null;
  update: (updates: Partial<StrategyParameters>) => Promise<boolean>;
  reset: () => Promise<boolean>;
  reload: () => Promise<void>;
}

const CONFIG_ENDPOINT = `${API_CONFIG.BASE_URL}/api/config/strategy`;

export function useStrategyConfig(): UseStrategyConfigReturn {
  const [config, setConfig] = useState<StrategyParameters | null>(null);
  const [defaults, setDefaults] = useState<StrategyParameters | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = () => {
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
  };

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get(CONFIG_ENDPOINT);
      if (res.data?.success) {
        setConfig(res.data.config);
        setDefaults(res.data.defaults);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load strategy config');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = useCallback(async (updates: Partial<StrategyParameters>): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await axios.put(CONFIG_ENDPOINT, updates);
      if (res.data?.success) {
        setConfig(res.data.config);
        setSuccess(`Config updated: ${Object.keys(updates).join(', ')}`);
        clearMessages();
        return true;
      } else {
        setError(res.data?.errors?.join('; ') || res.data?.message || 'Update failed');
        clearMessages();
        return false;
      }
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.join('; ') || err?.response?.data?.message || 'Failed to save config';
      setError(msg);
      clearMessages();
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const reset = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await axios.post(`${CONFIG_ENDPOINT}/reset`);
      if (res.data?.success) {
        setConfig(res.data.config);
        setSuccess('Config reset to factory defaults');
        clearMessages();
        return true;
      }
      return false;
    } catch (err: any) {
      setError('Failed to reset config');
      clearMessages();
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { config, defaults, isLoading, isSaving, error, success, update, reset, reload };
}
