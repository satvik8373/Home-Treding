const express = require('express');
const router = express.Router();

let riskConfig = {
  maxDailyLoss: 5000,
  maxPositionSize: 50000,
  maxOpenPositions: 5,
  trailingStopLoss: 2.0,
  killSwitchEnabled: true
};

let killSwitchStatus = {
  isHalted: false,
  haltedAt: null,
  haltReason: null
};

// Get risk status
router.get('/status', (req, res) => {
  try {
    res.json({
      success: true,
      config: riskConfig,
      killSwitch: killSwitchStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update risk config
router.post('/config', (req, res) => {
  try {
    riskConfig = { ...riskConfig, ...req.body };
    res.json({
      success: true,
      config: riskConfig,
      message: 'Risk parameters updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Activate kill switch
router.post('/kill-switch/activate', (req, res) => {
  try {
    killSwitchStatus = {
      isHalted: true,
      haltedAt: new Date().toISOString(),
      haltReason: req.body.reason || 'Manual emergency stop triggered by trader'
    };
    res.json({
      success: true,
      killSwitch: killSwitchStatus,
      message: 'Emergency Kill-Switch ACTIVATED'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Reset kill switch
router.post('/kill-switch/reset', (req, res) => {
  try {
    killSwitchStatus = {
      isHalted: false,
      haltedAt: null,
      haltReason: null
    };
    res.json({
      success: true,
      killSwitch: killSwitchStatus,
      message: 'Kill-Switch reset to normal'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
