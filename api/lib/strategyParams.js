/**
 * Mavrix Trading — Canonical Strategy Parameters
 * ================================================
 * SINGLE SOURCE OF TRUTH for all strategy constants across the production
 * serverless API. Every route file MUST import from here — no hardcoded
 * magic numbers anywhere else.
 *
 * Mirrors: backend/data/strategies.json  &  backend/src/config/strategyConfig.ts
 * Strategy: NIFTY ATM CE/PE Independent 0.9% Breakout
 */

'use strict';

// --- NSE Lot Sizes (2025 revised) ---
const LOT_SIZES = Object.freeze({
  NIFTY:      65,
  BANKNIFTY:  35,
  FINNIFTY:   60,
  MIDCPNIFTY: 120,
  SENSEX:     10,
});

// --- Strategy Parameters ---
const STRATEGY = Object.freeze({
  id:                   'nifty-atm-independent-breakout',
  name:                 'NIFTY ATM CE/PE Independent 0.9% Breakout',
  breakoutPct:          0.009,     // 0.9%  -> Upper = refHigh x 1.009 / Lower = refLow x 0.991
  target1Pts:           20,        // +Rs20 -> exit lot 1 (65 qty)
  target2Pts:           40,        // +Rs40 -> exit lots 2+3 (130 qty)
  entryLots:            3,         // 3 lots per leg
  referenceCandleStart: '09:15',
  referenceCandleEnd:   '09:20',
  tradingStartTime:     '09:20',
  forceSquareOffTime:   '15:10',
  strikeStep:           50,
  orderType:            'MIS',
  segment:              'OPTIDX',
});

// --- Convenience helpers ---

function resolveLotSize(symbol) {
  const s = (symbol || '').toUpperCase();
  if (s.includes('BANK'))                          return LOT_SIZES.BANKNIFTY;
  if (s.includes('FIN'))                           return LOT_SIZES.FINNIFTY;
  if (s.includes('MIDCAP') || s.includes('MIDCP')) return LOT_SIZES.MIDCPNIFTY;
  if (s.includes('SENSEX'))                        return LOT_SIZES.SENSEX;
  if (s.includes('NIFTY'))                         return LOT_SIZES.NIFTY;
  return 1;
}

function resolveStrikeStep(symbol) {
  const s = (symbol || '').toUpperCase();
  if (s.includes('BANK')) return 100;
  return 50;
}

function resolveOrderQty(symbol) {
  return resolveLotSize(symbol) * STRATEGY.entryLots;
}

module.exports = { LOT_SIZES, STRATEGY, resolveLotSize, resolveStrikeStep, resolveOrderQty };
