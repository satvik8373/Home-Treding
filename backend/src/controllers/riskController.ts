import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { riskEngine } from '../risk/RiskEngine';
import { killSwitch } from '../risk/KillSwitch';

/**
 * Get current risk limits and Kill Switch status
 */
export const getRiskStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    config: riskEngine.getConfig(),
    killSwitch: killSwitch.getStatus()
  });
});

/**
 * Update risk limits
 */
export const updateRiskConfig = asyncHandler(async (req: Request, res: Response) => {
  const updated = riskEngine.updateConfig(req.body);
  res.json({
    success: true,
    message: 'Risk settings updated successfully',
    config: updated
  });
});

/**
 * Trigger Global Emergency Stop (Kill Switch)
 */
export const triggerKillSwitch = asyncHandler(async (req: Request, res: Response) => {
  const { reason, autoSquareOff } = req.body;
  const status = killSwitch.activate(reason || 'Manual User Emergency Stop', !!autoSquareOff);

  res.json({
    success: true,
    message: '🛑 Emergency Stop Activated. All automation halted immediately.',
    killSwitch: status
  });
});

/**
 * Reset Emergency Stop
 */
export const resetKillSwitch = asyncHandler(async (_req: Request, res: Response) => {
  const status = killSwitch.reset();
  res.json({
    success: true,
    message: '🟢 Emergency Stop Reset. Normal trading automation resumed.',
    killSwitch: status
  });
});
