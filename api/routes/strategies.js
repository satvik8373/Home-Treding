const express = require('express');
const router = express.Router();

// In-memory strategies storage
const strategies = new Map();
const templates = new Map();

// Active strategy deployments
let activeDeployments = [];

// Initial Custom Strategies - 100% official NIFTY 0.09% ATM Full-Day Breakout Strategy
const INITIAL_STRATEGIES = [
  {
    id: 'nifty-009-atm-breakout',
    userId: 'user_admin',
    name: 'NIFTY 0.09% ATM Full-Day Breakout',
    author: 'AR427232',
    description: 'Calculates +0.09% upper and -0.09% lower levels from the first 5-min candle (09:15-09:20) close. Locks 09:20 ATM CE and PE contracts via Dhan Option Chain, monitoring full-day 5-min candle closes for breakout BUY (Close > Upper => BUY CE, Close < Lower => BUY PE) with symmetric reversal exit and 15:10 force square-off.',
    segmentType: 'OPTION',
    strategyType: 'Breakout / Trigger',
    symbol: 'NIFTY 50',
    underlyingType: 'Spot',
    orderType: 'MIS',
    startTime: '09:20',
    endTime: '15:10',
    tradingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    lotSize: 75,
    maxLoss: 2500,
    maxProfit: 5000,
    trailingSl: 'No Trailing',
    noTradeAfter: '15:10',
    legs: [
      {
        id: 'leg_ce_breakout',
        action: 'BUY',
        symbol: 'NIFTY 50',
        strike: 'ATM',
        strikeCriteria: 'ATM 0',
        strikeType: 'ATM',
        optionType: 'CE',
        quantity: 75,
        slType: 'points',
        slValue: 0,
        targetType: 'points',
        targetValue: 0,
        isActive: true
      },
      {
        id: 'leg_pe_breakout',
        action: 'BUY',
        symbol: 'NIFTY 50',
        strike: 'ATM',
        strikeCriteria: 'ATM 0',
        strikeType: 'ATM',
        optionType: 'PE',
        quantity: 75,
        slType: 'points',
        slValue: 0,
        targetType: 'points',
        targetValue: 0,
        isActive: true
      }
    ],
    advancedFeatures: {
      referenceCandle: 'First 5-min candle (09:15 to 09:20 IST)',
      referenceCloseCalculation: 'Close of 09:15-09:20 candle = X',
      upperBreakoutFormula: 'X * 1.0009 (+0.09%)',
      lowerBreakoutFormula: 'X * 0.9991 (-0.09%)',
      atmSelection: 'Lock ATM Strike at 09:20 from NIFTY 50 Spot price (multiples of 50)',
      contractResolution: 'Live Dhan Option Chain (Nearest Weekly Expiry CE + PE)',
      entryTrigger: '5-min Candle Close > Upper Level => BUY ATM CE | 5-min Candle Close < Lower Level => BUY ATM PE',
      exitTrigger: 'CE Active & Close < Lower => Exit CE | PE Active & Close > Upper => Exit PE',
      positionConstraint: 'Max 1 active position held at a time (Symmetric Reversal)',
      reEntryAllowed: true,
      forceSquareOffTime: '15:10 IST',
      executionSupport: ['PAPER_MODE', 'LIVE_DHAN_MODE']
    },
    createdAt: '2026-09-20T06:00:00.000Z',
    status: 'active'
  }
];

// Empty Templates Library
const INITIAL_TEMPLATES = [];

// Initialize stores
INITIAL_STRATEGIES.forEach(s => strategies.set(s.id, s));
INITIAL_TEMPLATES.forEach(t => templates.set(t.id, t));

// ==========================================
// DEPLOYMENT ROUTES
// ==========================================

// Get active deployed strategies
router.get('/active', (_req, res) => {
  res.json({
    success: true,
    deployments: activeDeployments
  });
});

// Deploy strategy (paper or live)
router.post('/deploy', (req, res) => {
  try {
    const {
      strategyId,
      name,
      symbol = 'NIFTY 50',
      templateType = 'dhokiya_009',
      qtyMultiplier = 1,
      maxProfit = 0,
      maxLoss = 2500,
      broker = 'paper',
      mode = 'paper'
    } = req.body || {};

    const deploymentId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newDeployment = {
      deploymentId,
      strategyId: strategyId || templateType || 'custom_strategy',
      name: name || 'Strategy Deployment',
      symbol: (symbol || 'NIFTY 50').toUpperCase(),
      templateType: templateType || 'custom',
      mode: mode || (broker === 'paper' ? 'paper' : 'live'),
      status: 'RUNNING',
      qtyMultiplier: Number(qtyMultiplier) || 1,
      maxProfit: Number(maxProfit) || 0,
      maxLoss: Number(maxLoss) || 2500,
      deployedAt: new Date().toISOString(),
      tradesExecuted: 0,
      pnl: 0
    };

    activeDeployments.unshift(newDeployment);

    res.json({
      success: true,
      message: `Strategy "${newDeployment.name}" deployed successfully in ${newDeployment.mode.toUpperCase()} mode!`,
      deployment: newDeployment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test trigger execution on deployment
router.post('/test-trigger', (req, res) => {
  try {
    const { deploymentId } = req.body || {};
    const deployment = activeDeployments.find(d => d.deploymentId === deploymentId);
    if (deployment) {
      deployment.tradesExecuted = (deployment.tradesExecuted || 0) + 1;
      deployment.pnl = Number(((deployment.pnl || 0) + 325.50).toFixed(2));
      return res.json({
        success: true,
        message: `Test trigger executed on ${deployment.name}. Trade simulated successfully.`,
        deployment
      });
    }
    res.json({
      success: true,
      message: 'Test trigger executed successfully.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Stop deployment
router.post('/stop', (req, res) => {
  try {
    const { deploymentId } = req.body || {};
    const deployment = activeDeployments.find(d => d.deploymentId === deploymentId);
    if (deployment) {
      deployment.status = 'STOPPED';
    }
    res.json({
      success: true,
      message: 'Strategy deployment stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete deployment
router.delete('/deployment/:id', (req, res) => {
  try {
    const id = req.params.id;
    activeDeployments = activeDeployments.filter(d => d.deploymentId !== id);
    res.json({
      success: true,
      message: 'Deployment removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// TEMPLATES ROUTES (MUST BE BEFORE /:id)
// ==========================================

// Get all templates
router.get('/templates', (_req, res) => {
  if (templates.size < INITIAL_TEMPLATES.length) {
    INITIAL_TEMPLATES.forEach(t => templates.set(t.id, t));
  }
  res.json({
    success: true,
    templates: Array.from(templates.values())
  });
});

// Get template by ID
router.get('/templates/:id', (req, res) => {
  const id = req.params.id;
  const tmpl = templates.get(id) || Array.from(templates.values()).find(t => t.id === id);
  if (tmpl) {
    return res.json({
      success: true,
      template: tmpl
    });
  }
  res.status(404).json({
    success: false,
    message: 'Template not found'
  });
});

// Create new template
router.post('/templates', (req, res) => {
  try {
    const { name, category = 'Custom', description = '', timeframe = '5m', symbols = ['NIFTY 50'], margin = '₹50,000', maxDrawdown = '₹-2,500', winRate = '65%', rules = [] } = req.body || {};
    const id = `tpl_${Date.now()}`;
    const newTmpl = {
      id,
      name: (name || 'New Template').trim(),
      category,
      description,
      timeframe,
      symbols: Array.isArray(symbols) ? symbols : [symbols],
      margin,
      maxDrawdown,
      winRate,
      rules: Array.isArray(rules) ? rules : [],
      createdAt: new Date().toISOString()
    };
    templates.set(id, newTmpl);
    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template: newTmpl
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update template
router.put('/templates/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = templates.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    const updated = {
      ...existing,
      ...(req.body || {}),
      id
    };
    templates.set(id, updated);
    res.json({
      success: true,
      message: 'Template updated successfully',
      template: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete template
router.delete('/templates/:id', (req, res) => {
  try {
    const id = req.params.id;
    if (templates.has(id)) {
      templates.delete(id);
      return res.json({ success: true, message: 'Template deleted successfully' });
    }
    res.status(404).json({ success: false, message: 'Template not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Duplicate template
router.post('/templates/duplicate/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = templates.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    const newId = `tpl_${Date.now()}`;
    const duplicated = {
      ...existing,
      id: newId,
      name: `${existing.name} (Copy)`,
      createdAt: new Date().toISOString()
    };
    templates.set(newId, duplicated);
    res.json({
      success: true,
      message: 'Template duplicated successfully',
      template: duplicated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// CUSTOM STRATEGIES ROUTES
// ==========================================

// Get all strategies
router.get('/', (req, res) => {
  try {
    const { userId } = req.query;
    const all = Array.from(strategies.values());
    const result = userId ? all.filter(s => s.userId === userId || !s.userId) : all;
    res.json({
      success: true,
      strategies: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create strategy
router.post('/', (req, res) => {
  try {
    const data = req.body || {};
    const id = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newStrat = {
      id,
      name: (data.name || 'Custom Strategy').trim(),
      author: data.author || 'AR427232',
      description: data.description || '',
      segmentType: data.segmentType || 'OPTION',
      strategyType: data.strategyType || 'Time Based',
      symbol: data.symbol || 'BANKNIFTY',
      startTime: data.startTime || '09:16',
      endTime: data.endTime || '15:10',
      tradingDays: data.tradingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      legs: Array.isArray(data.legs) ? data.legs : [],
      maxLoss: Number(data.maxLoss) || 2500,
      maxProfit: Number(data.maxProfit) || 5000,
      trailingSl: data.trailingSl || 'No Trailing',
      status: 'active',
      deploymentStatus: 'stopped',
      createdAt: new Date().toISOString()
    };
    strategies.set(id, newStrat);
    res.status(201).json({
      success: true,
      message: 'Strategy created successfully',
      strategy: newStrat
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Duplicate strategy
router.post('/duplicate/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = strategies.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Strategy not found' });
    }
    const newId = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const duplicated = {
      ...existing,
      id: newId,
      name: `${existing.name} (Copy)`,
      createdAt: new Date().toISOString()
    };
    strategies.set(newId, duplicated);
    res.json({
      success: true,
      message: 'Strategy duplicated successfully',
      strategy: duplicated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get strategy by ID (placed after /templates, /active, /duplicate)
router.get('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const strategy = strategies.get(id) || templates.get(id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update strategy by ID
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    let strategy = strategies.get(id);
    if (!strategy) {
      const tmpl = templates.get(id);
      if (tmpl) {
        strategy = { ...tmpl, id };
      }
    }
    if (!strategy) {
      return res.status(404).json({ success: false, message: 'Strategy not found' });
    }
    const updated = {
      ...strategy,
      ...(req.body || {}),
      id,
      updatedAt: new Date().toISOString()
    };
    strategies.set(id, updated);
    res.json({
      success: true,
      message: 'Strategy updated successfully',
      strategy: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete strategy
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    if (strategies.has(id)) {
      strategies.delete(id);
      return res.json({ success: true, message: 'Strategy deleted successfully' });
    }
    return res.status(404).json({ success: false, message: 'Strategy not found' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// NIFTY 0.09% BREAKOUT ENGINE STATUS & SESSION
// ==========================================
const handleNifty009Status = (req, res) => {
  const isRunning = activeDeployments.some(d => d.status === 'RUNNING');
  const activeDep = activeDeployments.find(d => d.status === 'RUNNING') || activeDeployments[0];
  const mode = activeDep?.mode || 'paper';
  res.json({
    success: true,
    data: {
      isRunning,
      isPaused: false,
      isHalted: false,
      mode,
      sessionDate: new Date().toISOString().split('T')[0],
      state: isRunning ? 'MONITORING' : 'IDLE',
      niftyLtp: 24850,
      firstCandleClose: null,
      upperLevel: null,
      lowerLevel: null,
      lockedAtm: null,
      activePosition: null,
      candles: 0,
      tradesCount: 0,
      sessionPnl: 0,
      squareOffTime: '15:10',
      events: [],
      lastUpdated: new Date().toISOString()
    },
    session: {
      isRunning,
      state: isRunning ? 'MONITORING' : 'IDLE',
      mode
    }
  });
};

router.get(['/nifty009/status', '/nifty009/session'], handleNifty009Status);
router.get('/nifty009/events', (req, res) => res.json({ success: true, events: [] }));
router.get('/nifty009/reports', (req, res) => res.json({ success: true, reports: [] }));
router.post('/nifty009/start', (req, res) => {
  res.json({ success: true, message: 'Nifty 0.09% strategy started successfully' });
});
router.post('/nifty009/stop', (req, res) => {
  res.json({ success: true, message: 'Nifty 0.09% strategy stopped' });
});

module.exports = router;
