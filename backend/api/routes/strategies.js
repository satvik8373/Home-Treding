const express = require('express');
const router = express.Router();

// In-memory strategy storage
const strategies = new Map();

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
      status: 'draft',
      deploymentStatus: 'stopped',
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

    const updatedStrategy = {
      ...strategy,
      ...req.body,
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
