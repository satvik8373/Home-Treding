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
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/order', optionalAuth, placePaperOrder);
router.get('/orders', optionalAuth, getPaperOrders);
router.get('/positions', optionalAuth, getPaperPositions);
router.get('/portfolio', optionalAuth, getPaperPortfolio);
router.get('/report', optionalAuth, getPaperDailyReport);
router.get('/audit-logs', optionalAuth, getPaperAuditLogs);
router.post('/reset', optionalAuth, resetPaperPortfolio);

export default router;
