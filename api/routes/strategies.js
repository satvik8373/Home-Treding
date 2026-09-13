const express = require('express');
const router = express.Router();

// In-memory strategies storage
const strategies = new Map();
const templates = new Map();

// Active strategy deployments
let activeDeployments = [
  {
    deploymentId: 'dep_dhokiya_1',
    strategyId: 'dhokiya_99',
    name: 'Dhokiya 0.09% Scalper',
    symbol: 'NIFTY 50',
    templateType: 'dhokiya_009',
    mode: 'paper',
    status: 'RUNNING',
    qtyMultiplier: 1,
    maxProfit: 5000,
    maxLoss: 2500,
    deployedAt: new Date(Date.now() - 86400000).toISOString(),
    tradesExecuted: 12,
    pnl: 1450.00
  },
  {
    deploymentId: 'dep_banknifty_orb',
    strategyId: 'bn_orb',
    name: 'BankNifty 15m ORB Breakout',
    symbol: 'BANKNIFTY',
    templateType: 'banknifty_orb',
    mode: 'paper',
    status: 'RUNNING',
    qtyMultiplier: 2,
    maxProfit: 8000,
    maxLoss: 4000,
    deployedAt: new Date(Date.now() - 43200000).toISOString(),
    tradesExecuted: 8,
    pnl: 2850.00
  }
];

// Initial Custom Strategies
const INITIAL_STRATEGIES = [
  {
    id: 'strat_1_percent_sl_strangle_bnf',
    name: '1 % SL strangle BNF',
    author: 'AR427232',
    description: 'Intraday BankNIFTY ATM Strangle (CE + PE Sell) entered at 09:16 with 1% fixed stop loss on each leg, profit trailing, and 15:10 auto-exit.',
    segmentType: 'OPTION',
    strategyType: 'Time Based',
    symbol: 'BANKNIFTY',
    startTime: '09:16',
    endTime: '15:10',
    tradingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    legs: [
      {
        id: 'leg_bnf_ce_1',
        action: 'SELL',
        symbol: 'BANKNIFTY',
        strike: 'ATM 0',
        optionType: 'CE',
        quantity: 30,
        slType: 'percentage',
        slValue: 1,
        targetType: 'percentage',
        targetValue: 0
      },
      {
        id: 'leg_bnf_pe_2',
        action: 'SELL',
        symbol: 'BANKNIFTY',
        strike: 'ATM 0',
        optionType: 'PE',
        quantity: 30,
        slType: 'percentage',
        slValue: 1,
        targetType: 'percentage',
        targetValue: 0
      }
    ],
    maxProfit: 2200,
    maxLoss: 2500,
    trailingSl: 'Lock and Trail',
    status: 'active',
    createdAt: new Date(Date.now() - 604800000).toISOString()
  },
  {
    id: 'dhokiya_99',
    name: 'Dhokiya 0.09% Scalper',
    author: 'AR427232',
    description: 'NIFTY 50 1-minute high frequency breakout scalper with 0.09% target and 0.05% stop loss.',
    segmentType: 'OPTION',
    strategyType: 'Indicator Based',
    symbol: 'NIFTY 50',
    startTime: '09:20',
    endTime: '15:10',
    timeframe: '1m',
    stopLossPercent: 0.05,
    targetPercent: 0.09,
    status: 'active',
    deploymentStatus: 'running',
    createdAt: new Date(Date.now() - 1209600000).toISOString()
  },
  {
    id: 'bn_orb',
    name: 'BankNifty 15m ORB Breakout',
    author: 'AR427232',
    description: 'BankNIFTY opening range breakout on 15-minute high/low breakout with dynamic volatility buffer.',
    segmentType: 'OPTION',
    strategyType: 'Breakout / Trigger',
    symbol: 'BANKNIFTY',
    startTime: '09:30',
    endTime: '15:10',
    timeframe: '15m',
    stopLossPercent: 0.5,
    targetPercent: 1.0,
    status: 'active',
    deploymentStatus: 'running',
    createdAt: new Date(Date.now() - 1209600000).toISOString()
  }
];

// Initial Templates Library
const INITIAL_TEMPLATES = [
  {
    id: '1_percent_sl_strangle_bnf',
    name: '1 % SL strangle BNF',
    category: 'Options Selling Strangle',
    description: 'Intraday BankNIFTY ATM Strangle (CE + PE Sell) entered at 09:16 with 1% fixed stop loss on each leg, profit trailing, and 15:10 auto-exit.',
    timeframe: '5m',
    symbols: ['BANKNIFTY'],
    margin: '₹1,40,000',
    maxDrawdown: '₹-6,600.3',
    winRate: '65.22%',
    rules: [
      'Enter at 09:16 IST: Sell ATM Call + Sell ATM Put',
      'Stop Loss: 1% on each option leg independently',
      'Target Profit / Trailing: Automated trailing stop loss per leg',
      'Auto Square-Off at 15:10 IST',
      'Backtested across 23 trading days with 65.22% win rate'
    ]
  },
  {
    id: 'nifty-009-atm-breakout',
    name: 'NIFTY 0.09% ATM Full-Day Breakout',
    category: 'Index Options Breakout',
    description: 'Full-day NIFTY 50 5-minute candle breakout strategy with ±0.09% fixed trigger levels, 09:20 locked ATM strike, CE/PE state machine, and auto square-off at 15:10 IST.',
    timeframe: '5m',
    symbols: ['NIFTY 50'],
    margin: '₹50,000',
    maxDrawdown: '₹-3,200',
    winRate: '68.5%',
    rules: [
      'Enter at 09:20 IST on breakout of opening 5-minute range',
      'Trigger level: ±0.09% from spot reference',
      'SL: 0.05% with 0.09% target',
      'Auto Square-off at 15:10 IST'
    ]
  },
  {
    id: 'iron-condor-weekly-decay',
    name: 'NIFTY Weekly Iron Condor',
    category: 'Options Theta Decay',
    description: 'Market-neutral 4-legged defined risk option strategy taking advantage of weekend theta decay and low implied volatility on NIFTY index options.',
    timeframe: '15m',
    symbols: ['NIFTY 50'],
    margin: '₹60,000',
    maxDrawdown: '₹-2,400',
    winRate: '72.0%',
    rules: [
      'Sell OTM CE (Delta ~0.20) + Buy Far OTM CE (Delta ~0.05)',
      'Sell OTM PE (Delta ~0.20) + Buy Far OTM PE (Delta ~0.05)',
      'Defined maximum loss capped by long wings',
      'Target: 50% max profit decay or expiry day exit'
    ]
  },
  {
    id: 'finnifty-hero-zero-momentum',
    name: 'FINNIFTY Expiry Zero-to-Hero Scalp',
    category: 'Expiry Day Momentum',
    description: 'High-speed breakout momentum buying deep discount OTM options between 13:30 and 15:00 on weekly expiry days with 1:3 risk-to-reward.',
    timeframe: '1m',
    symbols: ['FINNIFTY'],
    margin: '₹15,000',
    maxDrawdown: '₹-1,800',
    winRate: '58.0%',
    rules: [
      'Active only on FINNIFTY Tuesday weekly expiry from 13:30 IST',
      '5-minute consolidation range breakout triggers Long Option trade',
      'Fixed risk: ₹500/lot with 1:3 reward target (₹1,500+)'
    ]
  },
  {
    id: 'equity-vwap-pullback-trend',
    name: 'Equity Intraday VWAP Pullback',
    category: 'Trend Following Equity',
    description: 'Trend-following strategy for heavyweight stocks (RELIANCE, HDFCBANK, TCS) entering on VWAP pullbacks during established morning momentum.',
    timeframe: '5m',
    symbols: ['RELIANCE', 'HDFCBANK', 'TCS'],
    margin: '₹35,000',
    maxDrawdown: '₹-1,900',
    winRate: '66.8%',
    rules: [
      'Stock must be above 20 EMA and VWAP on 15m chart',
      '5-minute pullback touching VWAP with bullish reversal candle triggers BUY',
      'Stop Loss: Below the pullback swing low (0.4%)',
      'Target: 1.2% intraday gain or 15:15 square-off'
    ]
  }
];

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
    res.status(404).json({ success: false, message: 'Strategy not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
