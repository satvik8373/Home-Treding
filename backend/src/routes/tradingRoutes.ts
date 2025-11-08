import express from 'express';
import { tradingEngine } from '../services/tradingEngine';
import { orderManagement } from '../services/orderManagement';
import { portfolioService } from '../services/portfolioService';

const router = express.Router();

// Trading Engine Routes
router.get('/engine/status', (req, res) => {
  try {
    const status = tradingEngine.getStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get engine status',
      error: error.message
    });
  }
});

router.post('/engine/start', async (req, res) => {
  try {
    await tradingEngine.start();
    res.json({
      success: true,
      message: 'Trading engine started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start trading engine',
      error: error.message
    });
  }
});

router.post('/engine/stop', async (req, res) => {
  try {
    await tradingEngine.stop();
    res.json({
      success: true,
      message: 'Trading engine stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop trading engine',
      error: error.message
    });
  }
});

// Order Management Routes
router.post('/orders', async (req, res) => {
  try {
    const order = await orderManagement.placeOrder(req.body);
    res.json({
      success: true,
      message: 'Order placed successfully',
      order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to place order',
      error: error.message
    });
  }
});

router.get('/orders', (req, res) => {
  try {
    const { brokerId, status } = req.query;
    let orders;
    
    if (brokerId) {
      orders = orderManagement.getOrdersByBroker(brokerId as string);
    } else if (status) {
      orders = orderManagement.getOrdersByStatus(status as string);
    } else {
      orders = orderManagement.getOrdersByBroker(''); // Get all orders
    }

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get orders',
      error: error.message
    });
  }
});

export default router;