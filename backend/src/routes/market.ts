import { Router } from 'express';
import { getAllMarketData, getMarketDepth, getMarketStatusController } from '../controllers/marketController';

const router = Router();

// Live Market Data & Status Endpoints
router.get('/status', getMarketStatusController);
router.get('/all', getAllMarketData);
router.get('/live', getAllMarketData);
router.get('/depth/:symbol', getMarketDepth);

export default router;
