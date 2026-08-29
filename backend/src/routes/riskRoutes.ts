import { Router } from 'express';
import {
  getRiskStatus,
  updateRiskConfig,
  triggerKillSwitch,
  resetKillSwitch
} from '../controllers/riskController';

const router = Router();

router.get('/status', getRiskStatus);
router.post('/config', updateRiskConfig);
router.post('/kill-switch/activate', triggerKillSwitch);
router.post('/kill-switch/reset', resetKillSwitch);

export default router;
