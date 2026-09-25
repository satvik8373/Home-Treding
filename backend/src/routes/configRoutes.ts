/**
 * Config Routes — /api/config/strategy
 *
 * Exposes GET/PUT/POST endpoints for reading and updating
 * the centralized StrategyParameters config at runtime.
 * All changes are persisted to disk immediately.
 */

import { Router, Request, Response } from 'express';
import {
  getStrategyConfig,
  updateStrategyConfig,
  resetStrategyConfig,
  DEFAULT_STRATEGY_PARAMS,
  loadStrategyConfig,
  StrategyParameters
} from '../config/strategyConfig';
import { logger } from '../utils/logger';

const router = Router();

// ── GET /api/config/strategy ─────────────────────────────────────────────────
// Returns full current config with defaults metadata
router.get('/strategy', (_req: Request, res: Response) => {
  try {
    const config = getStrategyConfig();
    res.json({
      success: true,
      config,
      defaults: DEFAULT_STRATEGY_PARAMS,
      meta: {
        configFile: 'backend/data/strategy-config.json',
        description: 'NIFTY ATM CE/PE Breakout Strategy — centralized parameters. All values editable via PUT.'
      }
    });
  } catch (err) {
    logger.error(`[ConfigRoutes] GET /strategy error: ${err}`);
    res.status(500).json({ success: false, message: 'Failed to read config' });
  }
});

// ── PUT /api/config/strategy ─────────────────────────────────────────────────
// Partially update config (only fields provided will change)
router.put('/strategy', (req: Request, res: Response) => {
  try {
    const updates = req.body as Partial<StrategyParameters>;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No updates provided in request body' });
    }

    // Strip non-editable meta fields from user input
    const safeUpdates = { ...updates };
    delete (safeUpdates as any).schemaVersion;
    delete (safeUpdates as any).lastUpdatedAt;
    delete (safeUpdates as any).lastUpdatedBy;

    const result = updateStrategyConfig(safeUpdates, (req as any).user?.uid || 'api_user');

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.errors
      });
    }

    res.json({
      success: true,
      message: `Config updated successfully (${Object.keys(safeUpdates).join(', ')})`,
      config: result.config
    });
  } catch (err) {
    logger.error(`[ConfigRoutes] PUT /strategy error: ${err}`);
    res.status(500).json({ success: false, message: 'Failed to update config' });
  }
});

// ── POST /api/config/strategy/reset ─────────────────────────────────────────
// Reset config to factory defaults
router.post('/strategy/reset', (req: Request, res: Response) => {
  try {
    const config = resetStrategyConfig((req as any).user?.uid || 'api_user');
    res.json({
      success: true,
      message: 'Config reset to factory defaults',
      config
    });
  } catch (err) {
    logger.error(`[ConfigRoutes] POST /strategy/reset error: ${err}`);
    res.status(500).json({ success: false, message: 'Failed to reset config' });
  }
});

// ── POST /api/config/strategy/reload ─────────────────────────────────────────
// Hot-reload config from disk (useful if file was manually edited)
router.post('/strategy/reload', (_req: Request, res: Response) => {
  try {
    const config = loadStrategyConfig();
    res.json({
      success: true,
      message: 'Config reloaded from disk',
      config
    });
  } catch (err) {
    logger.error(`[ConfigRoutes] POST /strategy/reload error: ${err}`);
    res.status(500).json({ success: false, message: 'Failed to reload config' });
  }
});

export default router;
