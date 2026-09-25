/**
 * ============================================================
 * MAVRIX TRADING — CENTRALIZED STRATEGY CONFIGURATION
 * ============================================================
 *
 * SINGLE SOURCE OF TRUTH for all strategy parameters.
 *
 * Architecture (professional / production-grade):
 *  - Defaults defined here in TypeScript (typed, documented)
 *  - Overrides loaded from /backend/data/strategy-config.json (git-ignored, editable)
 *  - Config exposed via REST API: GET/PUT /api/config/strategy
 *  - All strategy files import ONLY from this module — zero hardcoded magic numbers elsewhere
 *
 * NSE Lot Size Reference (2024-2026 circulars):
 *  - NIFTY 50      : 65  (revised from 75 → 65 as per NSE 2025 circular)
 *  - BANKNIFTY     : 35  (revised from 30 → 35)
 *  - FINNIFTY      : 60
 *  - MIDCPNIFTY    : 120
 *  - SENSEX        : 10
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// ─── Typed parameter schema ───────────────────────────────────────────────────

export interface StrategyParameters {
  // ── Lot Sizes ──────────────────────────────────────────────────────────────
  /** NIFTY 50 options lot size. NSE revised 2025: 65 */
  niftyLotSize: number;
  /** BANKNIFTY options lot size. NSE revised 2025: 35 */
  bankNiftyLotSize: number;
  /** FINNIFTY options lot size */
  finNiftyLotSize: number;
  /** MIDCPNIFTY options lot size */
  midcpNiftyLotSize: number;
  /** SENSEX (BSE) options lot size */
  sensexLotSize: number;

  // ── Entry Sizing ───────────────────────────────────────────────────────────
  /** Number of lots per trade entry (qty = lotSize × entryLots) */
  entryLots: number;

  // ── ATM CE/PE Breakout Strategy ────────────────────────────────────────────
  /** Breakout threshold percentage (0.009 = 0.9%, multiplier 1.009 / 0.991) */
  breakoutPct: number;
  /** Target 1 in points from actual entry fill (default: +20 pts -> sell 1 lot / 65 qty) */
  target1Pts: number;
  /** Target 2 in points from actual entry fill (default: +40 pts -> sell remaining 2 lots / 130 qty) */
  target2Pts: number;
  /** Trading session start — IST HH:MM */
  tradingStartTime: string;
  /** Force square-off time — IST HH:MM */
  forceSquareOffTime: string;
  /** Reference candle open time — IST HH:MM */
  referenceCandleStart: string;
  /** Reference candle close time — IST HH:MM */
  referenceCandleEnd: string;

  // ── Risk Management ────────────────────────────────────────────────────────
  /** Maximum daily loss before strategy halts (₹) */
  maxDailyLoss: number;
  /** Maximum profit target for the day (₹, 0 = unlimited) */
  maxDailyProfit: number;
  /** Maximum number of trade entries per leg per day (0 = unlimited) */
  maxTradesPerDay: number;
  /** Allow re-entry after exit within the same session */
  enableReEntry: boolean;

  // ── Order Settings ─────────────────────────────────────────────────────────
  /** Order type for live trading */
  orderType: 'MIS' | 'CNC' | 'NRML';
  /** Product type for position */
  productType: 'INTRADAY' | 'DELIVERY';

  // ── Metadata ───────────────────────────────────────────────────────────────
  /** Config schema version — bump when breaking changes are made */
  schemaVersion: number;
  /** ISO timestamp of last edit */
  lastUpdatedAt: string;
  /** Who last updated (user ID or 'system') */
  lastUpdatedBy: string;
}

// ─── Default configuration (canonical source) ────────────────────────────────

export const DEFAULT_STRATEGY_PARAMS: Readonly<StrategyParameters> = Object.freeze({
  // Lot sizes — NSE 2025 revised
  niftyLotSize:      65,
  bankNiftyLotSize:  35,
  finNiftyLotSize:   60,
  midcpNiftyLotSize: 120,
  sensexLotSize:     10,

  // Entry sizing: 3 lots = 195 qty
  entryLots: 3,

  // ATM breakout strategy timing & thresholds: +0.9% (1.009 / 0.991)
  breakoutPct:          0.009,   // 0.9%
  target1Pts:           20.0,    // +₹20.0 (Sell 1 lot)
  target2Pts:           40.0,    // +₹40.0 (Sell remaining 2 lots)
  tradingStartTime:     '09:20',
  forceSquareOffTime:   '15:10',
  referenceCandleStart: '09:15',
  referenceCandleEnd:   '09:20',

  // Risk
  maxDailyLoss:    10000,
  maxDailyProfit:  0,
  maxTradesPerDay: 0,
  enableReEntry:   true,

  // Orders
  orderType:   'MIS',
  productType: 'INTRADAY',

  // Meta
  schemaVersion:  1,
  lastUpdatedAt:  new Date().toISOString(),
  lastUpdatedBy:  'system',
});

// ─── Persistence path ─────────────────────────────────────────────────────────

const CONFIG_FILE_PATH = path.resolve(__dirname, '../../data/strategy-config.json');

// ─── In-memory singleton ──────────────────────────────────────────────────────

let _params: StrategyParameters = { ...DEFAULT_STRATEGY_PARAMS };

// ─── Persistence helper ───────────────────────────────────────────────────────

function saveStrategyConfig(cfg: StrategyParameters): void {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    logger.error(`[StrategyConfig] Failed to persist config: ${err}`);
  }
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load config from the JSON file on disk (if it exists), merging with defaults.
 * Any key not present in the file falls back to the default.
 * Called once at startup; also callable to hot-reload.
 */
export function loadStrategyConfig(): StrategyParameters {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const persisted = JSON.parse(raw) as Partial<StrategyParameters>;
      _params = { ...DEFAULT_STRATEGY_PARAMS, ...persisted };
      logger.info(
        `[StrategyConfig] Loaded from disk | NIFTY lot: ${_params.niftyLotSize} | breakout: ${(_params.breakoutPct * 100).toFixed(4)}%`
      );
    } else {
      _params = { ...DEFAULT_STRATEGY_PARAMS };
      saveStrategyConfig(_params); // persist defaults to disk on first run
      logger.info(`[StrategyConfig] No config file — created defaults at ${CONFIG_FILE_PATH}`);
    }
  } catch (err) {
    logger.error(`[StrategyConfig] Failed to load config — using defaults: ${err}`);
    _params = { ...DEFAULT_STRATEGY_PARAMS };
  }
  return _params;
}

// ─── Getter ───────────────────────────────────────────────────────────────────

/**
 * Returns the current in-memory configuration.
 * All strategy files should call this — never read hardcoded values directly.
 */
export function getStrategyConfig(): Readonly<StrategyParameters> {
  return _params;
}

// ─── Setter / Updater ─────────────────────────────────────────────────────────

/**
 * Merge a partial update into the config, persist to disk, and return new state.
 * Validates that critical numeric fields are positive.
 */
export function updateStrategyConfig(
  updates: Partial<StrategyParameters>,
  updatedBy: string = 'api'
): { success: boolean; config: StrategyParameters; errors?: string[] } {
  const errors: string[] = [];

  // Validate positive numeric fields
  const numericPositiveFields: (keyof StrategyParameters)[] = [
    'niftyLotSize', 'bankNiftyLotSize', 'finNiftyLotSize',
    'midcpNiftyLotSize', 'sensexLotSize', 'entryLots', 'maxDailyLoss'
  ];
  for (const field of numericPositiveFields) {
    const val = updates[field as keyof StrategyParameters];
    if (val !== undefined && (typeof val !== 'number' || (val as number) < 1)) {
      errors.push(`${field} must be a positive number (got: ${val})`);
    }
  }

  const pct = updates.breakoutPct;
  if (pct !== undefined && (typeof pct !== 'number' || pct <= 0 || pct >= 1)) {
    errors.push(`breakoutPct must be between 0 and 1 (e.g. 0.009 for 0.9%; got: ${pct})`);
  }

  if (errors.length > 0) {
    return { success: false, config: _params, errors };
  }

  _params = {
    ..._params,
    ...updates,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy,
  };

  saveStrategyConfig(_params);
  logger.info(`[StrategyConfig] Updated by ${updatedBy}: ${JSON.stringify(updates)}`);

  return { success: true, config: _params };
}

/**
 * Reset all parameters to defaults and persist.
 */
export function resetStrategyConfig(resetBy: string = 'api'): StrategyParameters {
  _params = {
    ...DEFAULT_STRATEGY_PARAMS,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: resetBy
  };
  saveStrategyConfig(_params);
  logger.info(`[StrategyConfig] Reset to defaults by ${resetBy}`);
  return _params;
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/**
 * Resolve NSE/BSE lot size for a given symbol string.
 * Used by all strategies and the backtest engine.
 */
export function resolveLotSize(symbol: string): number {
  const cfg = getStrategyConfig();
  const sym = symbol.toUpperCase().replace(/\s+/g, '_');
  if (sym.includes('BANK') || sym.includes('BNF'))            return cfg.bankNiftyLotSize;
  if (sym.includes('FIN'))                                    return cfg.finNiftyLotSize;
  if (sym.includes('MIDCAP') || sym.includes('MIDCP'))       return cfg.midcpNiftyLotSize;
  if (sym.includes('SENSEX'))                                 return cfg.sensexLotSize;
  if (sym.includes('NIFTY'))                                  return cfg.niftyLotSize;
  return 1; // Equity / unknown
}

/**
 * Calculate order quantity: lotSize × entryLots (from centralized config)
 */
export function resolveOrderQty(symbol: string): number {
  const cfg = getStrategyConfig();
  return resolveLotSize(symbol) * cfg.entryLots;
}

// ─── Auto-load on module import ───────────────────────────────────────────────
// Runs once when any module imports this file — config is always ready.
loadStrategyConfig();
