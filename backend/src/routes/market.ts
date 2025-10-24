import { Router } from 'express';
import { getAllMarketData } from '../controllers/marketController';

const router = Router();

// ONE ENDPOINT - Get everything
router.get('/all', getAllMarketData);

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Market route is working!' });
});

export default router;
