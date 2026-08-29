import { Router } from 'express';
import {
  placePaperOrder,
  getPaperOrders,
  getPaperPositions,
  getPaperPortfolio,
  getPaperDailyReport,
  getPaperAuditLogs,
  resetPaperPortfolio
} from '../controllers/paperController';

const router = Router();

router.post('/order', placePaperOrder);
router.get('/orders', getPaperOrders);
router.get('/positions', getPaperPositions);
router.get('/portfolio', getPaperPortfolio);
router.get('/report', getPaperDailyReport);
router.get('/audit-logs', getPaperAuditLogs);
router.post('/reset', resetPaperPortfolio);

export default router;
