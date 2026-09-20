import { Router } from 'express';
import {
  getRiskStatus,
  updateRiskConfig,
  triggerKillSwitch,
  resetKillSwitch
} from '../controllers/riskController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/status', optionalAuth, getRiskStatus);
router.post('/config', authenticate, updateRiskConfig);
router.post('/kill-switch/activate', authenticate, triggerKillSwitch);
router.post('/kill-switch/reset', authenticate, resetKillSwitch);

export default router;
