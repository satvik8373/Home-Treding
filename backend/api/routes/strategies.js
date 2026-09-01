const express = require('express');
const router = express.Router();

// In-memory strategy storage
const strategies = new Map();

// Active strategy deployments
let activeDeployments = [
  {
    deploymentId: 'dep_dhokiya_1',
    strategyId: 'dhokiya_99',
    name: 'Dhokiya 0.09% Scalper',
    symbol: 'NIFTY 50',
    mode: 'paper',
    status: 'RUNNING',
    qtyMultiplier: 1,
    tradesExecuted: 12
  },
  {
    deploymentId: 'dep_banknifty_orb',
    strategyId: 'bn_orb',
    name: 'BankNifty 15m ORB Breakout',
    symbol: 'BANKNIFTY',
    mode: 'paper',
    status: 'RUNNING',
    qtyMultiplier: 2,
    tradesExecuted: 8
  }
];

// Seed initial default strategy templates
strategies.set('dhokiya_99', {
  id: 'dhokiya_99',
  name: 'Dhokiya 0.09% Scalper',
  symbol: 'NIFTY 50',
  timeframe: '1m',
  stopLossPercent: 0.05,
  targetPercent: 0.09,
  status: 'active',
  deploymentStatus: 'running',
  createdAt: new Date().toISOString()
});

strategies.set('bn_orb', {
  id: 'bn_orb',
  name: 'BankNifty 15m ORB Breakout',
  symbol: 'BANKNIFTY',
  timeframe: '15m',
  stopLossPercent: 0.5,
  targetPercent: 1.0,
  status: 'active',
  deploymentStatus: 'running',
  createdAt: new Date().toISOString()
});

// Get active deployed strategies
router.get('/active', (req, res) => {
  try {
    res.json({
      success: true,
      deployments: activeDeployments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all strategies
router.get('/', (req, res) => {
  try {
    const { userId } = req.query;
    const userStrategies = userId
      ? Array.from(strategies.values()).filter(s => s.userId === userId)
      : Array.from(strategies.values());

    res.json({
      success: true,
      strategies: userStrategies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Create strategy
router.post('/', (req, res) => {
  try {
    const strategyData = req.body;
    const strategyId = `strategy_${Date.now()}`;
    
    const strategy = {
      id: strategyId,
      ...strategyData,
      status: 'active',
      deploymentStatus: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    strategies.set(strategyId, strategy);

    res.status(201).json({
      success: true,
      message: 'Strategy created successfully',
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get strategy by ID
router.get('/:id', (req, res) => {
  try {
    const strategy = strategies.get(req.params.id);
    
    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update strategy
router.put('/:id', (req, res) => {
  try {
    const strategy = strategies.get(req.params.id);
    
    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    const { name, symbol, timeframe, stopLossPercent, targetPercent, status, params } = req.body || {};
    const updatedStrategy = {
      ...strategy,
      name: name !== undefined ? name : strategy.name,
      symbol: symbol !== undefined ? symbol : strategy.symbol,
      timeframe: timeframe !== undefined ? timeframe : strategy.timeframe,
      stopLossPercent: stopLossPercent !== undefined ? stopLossPercent : strategy.stopLossPercent,
      targetPercent: targetPercent !== undefined ? targetPercent : strategy.targetPercent,
      status: status !== undefined ? status : strategy.status,
      params: params !== undefined ? params : strategy.params,
      updatedAt: new Date().toISOString()
    };

    strategies.set(req.params.id, updatedStrategy);

    res.json({
      success: true,
      message: 'Strategy updated successfully',
      strategy: updatedStrategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete strategy
router.delete('/:id', (req, res) => {
  try {
    if (strategies.has(req.params.id)) {
      strategies.delete(req.params.id);
      res.json({
        success: true,
        message: 'Strategy deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
