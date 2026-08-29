/**
 * Strategy Routes - Strategy Management, Templates, Live Deployment & Trigger Execution
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { paperExecutor } from '../execution/PaperExecutor';
import { BrokerRegistry } from '../brokers/BrokerRegistry';
import fs from 'fs';
import path from 'path';

const router = Router();

export interface StrategyLeg {
  id: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  strike: string; // 'ATM 0', 'ATM +100', 'ATM -100', etc.
  optionType: 'CE' | 'PE';
  quantity: number;
  slType?: 'percentage' | 'points';
  slValue?: number;
  targetType?: 'percentage' | 'points';
  targetValue?: number;
}

export interface CustomStrategy {
  id: string;
  name: string;
  author: string;
  description?: string;
  segmentType: 'OPTION' | 'EQUITY' | 'FUTURES';
  strategyType: 'Time Based' | 'Indicator Based' | 'Breakout / Trigger';
  symbol: string;
  startTime: string;
  endTime: string;
  tradingDays: string[];
  legs: StrategyLeg[];
  maxLoss?: number;
  maxProfit?: number;
  trailingSl?: string;
  createdAt: string;
  status: 'draft' | 'active';
}

export interface StrategyTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  timeframe: string;
  symbols: string[];
  margin: string;
  maxDrawdown: string;
  winRate: string;
  rules: string[];
  createdAt?: string;
}

export interface DeployedStrategy {
  deploymentId: string;
  strategyId: string;
  name: string;
  symbol: string;
  templateType: string;
  mode: 'paper' | 'live';
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  qtyMultiplier: number;
  maxProfit: number;
  maxLoss: number;
  deployedAt: string;
  lastTriggerAt?: string;
  tradesExecuted: number;
  pnl: number;
  config: any;
}

const activeDeployments: Map<string, DeployedStrategy> = new Map();
const customStrategies: Map<string, CustomStrategy> = new Map();
const strategyTemplates: Map<string, StrategyTemplate> = new Map();

const deploymentsFile = path.join(__dirname, '../../data/active-deployments.json');
const strategiesFile = path.join(__dirname, '../../data/strategies.json');
const templatesFile = path.join(__dirname, '../../data/templates.json');

// Default initial custom strategies
const INITIAL_STRATEGIES: CustomStrategy[] = [
  {
    id: 'strat_1_percent_sl_strangle_bnf',
    name: '1 % SL strangle BNF',
    author: 'AR427232',
    description: 'Intraday BankNIFTY ATM Strangle (CE + PE Sell) entered at 09:16 with 1% fixed stop loss on each leg, profit trailing, and 15:10 auto-exit.',
    segmentType: 'OPTION',
    strategyType: 'Time Based',
    symbol: 'NIFTY BANK',
    startTime: '09:16',
    endTime: '15:10',
    tradingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    legs: [
      {
        id: 'leg_bnf_ce_1',
        action: 'SELL',
        symbol: 'NIFTY BANK',
        strike: 'ATM 0',
        optionType: 'CE',
        quantity: 35,
        slType: 'percentage',
        slValue: 1,
        targetType: 'percentage',
        targetValue: 0
      },
      {
        id: 'leg_bnf_pe_2',
        action: 'SELL',
        symbol: 'NIFTY BANK',
        strike: 'ATM 0',
        optionType: 'PE',
        quantity: 35,
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
    createdAt: '2026-08-28T09:16:00.000Z'
  }
];

// Default initial templates library
const INITIAL_TEMPLATES: StrategyTemplate[] = [
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
    maxDrawdown: '₹2,500',
    winRate: '68.4%',
    rules: [
      '09:15 - 09:20 5-min reference candle close determines Upper (+0.09%) & Lower (-0.09%) levels',
      'At 09:20, ATM strike is selected and locked for the entire day (CE & PE contracts)',
      'Completed 5-min candle CLOSE > Upper Level triggers BUY ATM CE',
      'Completed 5-min candle CLOSE < Lower Level triggers BUY ATM PE',
      'Active CE exits on 5-min candle CLOSE < Lower Level; Active PE exits on 5-min candle CLOSE > Upper Level',
      'Full-day re-entry enabled up to 3 trades/day. Maximum concurrent position = 1',
      'Automatic force square-off at 15:10:00 IST'
    ]
  },
  {
    id: 'nifty-920-short-straddle',
    name: 'NIFTY 9:20 Short Straddle (25% SL)',
    category: 'Delta Neutral Straddle',
    description: 'Time-tested 09:20 AM intraday NIFTY 50 ATM Short Straddle with 25% individual stop-loss per leg, delta decay harvest, and 15:15 exit.',
    timeframe: '5m',
    symbols: ['NIFTY 50'],
    margin: '₹1,20,000',
    maxDrawdown: '₹4,200',
    winRate: '64.5%',
    rules: [
      'Entry at 09:20 IST sharp: Sell NIFTY ATM CE + Sell NIFTY ATM PE',
      'Stop Loss: 25% on entry premium of each individual leg',
      'If one leg SL hits, the other leg remains open with profit trailing',
      'Over-all strategy profit target: ₹3,500 per lot',
      'Auto Square-off at 15:15 IST'
    ]
  },
  {
    id: 'bnf-weekly-iron-condor',
    name: 'BANKNIFTY Weekly Iron Condor',
    category: 'Range Bound Hedged',
    description: 'Defined-risk 4-leg Iron Condor selling OTM 15-Delta options with protective 5-Delta wings for margin optimization and range-bound decay.',
    timeframe: '15m',
    symbols: ['BANKNIFTY'],
    margin: '₹65,000',
    maxDrawdown: '₹3,100',
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
    maxDrawdown: '₹1,800',
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
    maxDrawdown: '₹1,900',
    winRate: '66.8%',
    rules: [
      'Stock must be above 20 EMA and VWAP on 15m chart',
      '5-minute pullback touching VWAP with bullish reversal candle triggers BUY',
      'Stop Loss: Below the pullback swing low (0.4%)',
      'Target: 1.2% intraday gain or 15:15 square-off'
    ]
  }
];

// Auto-load deployed strategies from disk
try {
  if (fs.existsSync(deploymentsFile)) {
    const raw = fs.readFileSync(deploymentsFile, 'utf-8');
    const list: DeployedStrategy[] = JSON.parse(raw);
    list.forEach(d => activeDeployments.set(d.deploymentId, d));
  }
} catch (e) {
  // Ignore
}

// Auto-load custom strategies from disk
try {
  if (fs.existsSync(strategiesFile)) {
    const raw = fs.readFileSync(strategiesFile, 'utf-8');
    const list: CustomStrategy[] = JSON.parse(raw);
    if (list && list.length > 0) {
      list.forEach(s => customStrategies.set(s.id, s));
    } else {
      INITIAL_STRATEGIES.forEach(s => customStrategies.set(s.id, s));
      saveStrategies();
    }
  } else {
    INITIAL_STRATEGIES.forEach(s => customStrategies.set(s.id, s));
    saveStrategies();
  }
} catch (e) {
  INITIAL_STRATEGIES.forEach(s => customStrategies.set(s.id, s));
}

// Auto-load templates from disk
try {
  if (fs.existsSync(templatesFile)) {
    const raw = fs.readFileSync(templatesFile, 'utf-8');
    const list: StrategyTemplate[] = JSON.parse(raw);
    if (list && list.length > 0) {
      list.forEach(t => strategyTemplates.set(t.id, t));
    } else {
      INITIAL_TEMPLATES.forEach(t => strategyTemplates.set(t.id, t));
      saveTemplates();
    }
  } else {
    INITIAL_TEMPLATES.forEach(t => strategyTemplates.set(t.id, t));
    saveTemplates();
  }
} catch (e) {
  INITIAL_TEMPLATES.forEach(t => strategyTemplates.set(t.id, t));
}

const saveDeployments = () => {
  try {
    const dir = path.dirname(deploymentsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(deploymentsFile, JSON.stringify(Array.from(activeDeployments.values()), null, 2));
  } catch (e) {
    logger.error('Failed to save deployments', e);
  }
};

function saveStrategies() {
  try {
    const dir = path.dirname(strategiesFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(strategiesFile, JSON.stringify(Array.from(customStrategies.values()), null, 2));
  } catch (e) {
    logger.error('Failed to save custom strategies', e);
  }
}

function saveTemplates() {
  try {
    const dir = path.dirname(templatesFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(templatesFile, JSON.stringify(Array.from(strategyTemplates.values()), null, 2));
  } catch (e) {
    logger.error('Failed to save templates', e);
  }
}

// ==========================================
// CUSTOM STRATEGY CRUD ROUTES
// ==========================================

/**
 * GET /api/strategies
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    strategies: Array.from(customStrategies.values())
  });
});

/**
 * POST /api/strategies
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      name,
      author = 'AR427232',
      description = '',
      segmentType = 'OPTION',
      strategyType = 'Time Based',
      symbol = 'NIFTY BANK',
      startTime = '09:16',
      endTime = '15:10',
      tradingDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      legs = [],
      maxLoss = 2500,
      maxProfit = 5000,
      trailingSl = 'No Trailing'
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Strategy name is required' });
    }

    const id = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newStrategy: CustomStrategy = {
      id,
      name: name.trim(),
      author,
      description,
      segmentType,
      strategyType,
      symbol,
      startTime,
      endTime,
      tradingDays,
      legs: Array.isArray(legs) && legs.length > 0 ? legs : [
        {
          id: `leg_${Date.now()}_1`,
          action: 'SELL',
          symbol,
          strike: 'ATM 0',
          optionType: 'CE',
          quantity: symbol.includes('BANK') ? 35 : 50,
          slType: 'percentage',
          slValue: 1
        },
        {
          id: `leg_${Date.now()}_2`,
          action: 'SELL',
          symbol,
          strike: 'ATM 0',
          optionType: 'PE',
          quantity: symbol.includes('BANK') ? 35 : 50,
          slType: 'percentage',
          slValue: 1
        }
      ],
      maxLoss: Number(maxLoss) || 2500,
      maxProfit: Number(maxProfit) || 5000,
      trailingSl,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    customStrategies.set(id, newStrategy);
    saveStrategies();

    logger.info(`✨ [Strategy Created] "${newStrategy.name}" (${newStrategy.id}) saved.`);

    res.json({
      success: true,
      message: `Strategy "${newStrategy.name}" created successfully!`,
      strategy: newStrategy
    });
  } catch (error: any) {
    logger.error('Create strategy error:', error);
    res.status(500).json({ success: false, message: 'Failed to create strategy', error: error.message });
  }
});

/**
 * PUT /api/strategies/:id
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    let existing = customStrategies.get(id);

    if (!existing) {
      // Check if updating a template ID or converting template to custom strategy
      const tmpl = strategyTemplates.get(id);
      if (tmpl) {
        existing = {
          id,
          name: tmpl.name,
          author: 'AR427232',
          description: tmpl.description,
          segmentType: 'OPTION',
          strategyType: 'Time Based',
          symbol: tmpl.symbols?.[0] || 'NIFTY BANK',
          startTime: '09:16',
          endTime: '15:10',
          tradingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          legs: [],
          maxLoss: 2200.10,
          maxProfit: 2200,
          createdAt: new Date().toISOString(),
          status: 'active'
        };
      } else {
        existing = {
          id,
          name: req.body.name || 'Custom Strategy',
          author: req.body.author || 'AR427232',
          segmentType: req.body.segmentType || 'OPTION',
          strategyType: req.body.strategyType || 'Time Based',
          symbol: req.body.symbol || 'NIFTY BANK',
          startTime: req.body.startTime || '09:16',
          endTime: req.body.endTime || '15:10',
          tradingDays: req.body.tradingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          legs: req.body.legs || [],
          maxLoss: req.body.maxLoss || 2200.10,
          maxProfit: req.body.maxProfit || 2200,
          createdAt: new Date().toISOString(),
          status: 'active'
        };
      }
    }

    const updated: CustomStrategy = {
      ...existing,
      ...req.body,
      id
    };

    customStrategies.set(id, updated);
    saveStrategies();

    logger.info(`💾 [Strategy Updated] "${updated.name}" (${updated.id}) saved to disk.`);

    res.json({
      success: true,
      message: 'Strategy updated successfully',
      strategy: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update strategy', error: error.message });
  }
});

/**
 * DELETE /api/strategies/:id
 */
router.delete('/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (customStrategies.has(id)) {
    customStrategies.delete(id);
    saveStrategies();
    return res.json({ success: true, message: 'Strategy deleted successfully' });
  }
  res.status(404).json({ success: false, message: 'Strategy not found' });
});

/**
 * POST /api/strategies/duplicate/:id
 */
router.post('/duplicate/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = customStrategies.get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Strategy not found' });
  }

  const newId = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const duplicated: CustomStrategy = {
    ...existing,
    id: newId,
    name: `${existing.name} (Copy)`,
    createdAt: new Date().toISOString()
  };

  customStrategies.set(newId, duplicated);
  saveStrategies();

  res.json({
    success: true,
    message: 'Strategy duplicated successfully',
    strategy: duplicated
  });
});

// ==========================================
// TEMPLATE STRATEGY CRUD & EDITING ROUTES
// ==========================================

/**
 * GET /api/strategies/templates
 */
router.get('/templates', (_req: Request, res: Response) => {
  if (strategyTemplates.size < INITIAL_TEMPLATES.length) {
    INITIAL_TEMPLATES.forEach((t) => strategyTemplates.set(t.id, t));
  }
  res.json({
    success: true,
    templates: Array.from(strategyTemplates.values())
  });
});

/**
 * GET /api/strategies/templates/:id
 */
router.get('/templates/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const template = strategyTemplates.get(id) || Array.from(strategyTemplates.values()).find((t) => t.id === id);
  if (template) {
    return res.json({ success: true, template });
  }
  res.status(404).json({ success: false, message: 'Template not found' });
});

/**
 * POST /api/strategies/templates
 * Create new template strategy
 */
router.post('/templates', (req: Request, res: Response) => {
  try {
    const {
      name,
      category = 'Custom Template',
      description = '',
      timeframe = '5m',
      symbols = ['NIFTY 50', 'BANKNIFTY'],
      margin = '₹25,000',
      maxDrawdown = '₹2,500',
      winRate = '65.0%',
      rules = []
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Template name is required' });
    }

    const id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newTemplate: StrategyTemplate = {
      id,
      name: name.trim(),
      category,
      description,
      timeframe,
      symbols: Array.isArray(symbols) && symbols.length > 0 ? symbols : ['NIFTY 50', 'BANKNIFTY'],
      margin: margin || '₹25,000',
      maxDrawdown: maxDrawdown || '₹2,500',
      winRate: winRate || '65.0%',
      rules: Array.isArray(rules) ? rules : [],
      createdAt: new Date().toISOString()
    };

    strategyTemplates.set(id, newTemplate);
    saveTemplates();

    res.json({
      success: true,
      message: `Template "${newTemplate.name}" created successfully!`,
      template: newTemplate
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create template', error: error.message });
  }
});

/**
 * PUT /api/strategies/templates/:id
 * Edit/Update template strategy
 */
router.put('/templates/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = strategyTemplates.get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const updated: StrategyTemplate = {
      ...existing,
      ...req.body,
      id // preserve original id
    };

    strategyTemplates.set(id, updated);
    saveTemplates();

    res.json({
      success: true,
      message: `Template "${updated.name}" updated successfully!`,
      template: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update template', error: error.message });
  }
});

/**
 * DELETE /api/strategies/templates/:id
 * Delete template strategy
 */
router.delete('/templates/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (strategyTemplates.has(id)) {
    strategyTemplates.delete(id);
    saveTemplates();
    return res.json({ success: true, message: 'Template removed successfully' });
  }
  res.status(404).json({ success: false, message: 'Template not found' });
});

/**
 * POST /api/strategies/templates/duplicate/:id
 * Duplicate a template strategy
 */
router.post('/templates/duplicate/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = strategyTemplates.get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Template not found' });
  }

  const newId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const duplicated: StrategyTemplate = {
    ...existing,
    id: newId,
    name: `${existing.name} (Custom Copy)`,
    createdAt: new Date().toISOString()
  };

  strategyTemplates.set(newId, duplicated);
  saveTemplates();

  res.json({
    success: true,
    message: `Template duplicated as "${duplicated.name}"`,
    template: duplicated
  });
});

// ==========================================
// DEPLOYMENT ROUTES
// ==========================================

/**
 * GET /api/strategies/active
 */
router.get('/active', (_req: Request, res: Response) => {
  res.json({
    success: true,
    deployments: Array.from(activeDeployments.values())
  });
});

/**
 * POST /api/strategies/deploy
 */
router.post('/deploy', async (req: Request, res: Response) => {
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
      squareOff = '15:15',
      type = 'paper'
    } = req.body;

    if (!strategyId && !name) {
      return res.status(400).json({ success: false, message: 'Strategy ID or Name is required' });
    }

    if (!symbol) {
      return res.status(400).json({ success: false, message: 'Target trading symbol is required' });
    }

    const multiplier = Number(qtyMultiplier);
    if (isNaN(multiplier) || multiplier < 1 || multiplier > 10) {
      return res.status(400).json({ success: false, message: 'Lot Multiplier must be between 1 and 10' });
    }

    const lossLimit = Number(maxLoss);
    if (isNaN(lossLimit) || lossLimit <= 0) {
      return res.status(400).json({ success: false, message: 'Max Daily Loss must be greater than ₹0' });
    }

    const targetStrategyId = strategyId || templateType || 'custom_strategy';

    // Duplicate Check
    const existingRunning = Array.from(activeDeployments.values()).find(
      d => (d.strategyId === targetStrategyId || d.templateType === templateType) &&
           d.symbol.toUpperCase() === symbol.toUpperCase() &&
           d.status === 'RUNNING'
    );

    if (existingRunning) {
      return res.status(409).json({
        success: false,
        message: `Strategy "${existingRunning.name}" is already RUNNING on ${symbol}. Stop the existing deployment before creating a duplicate.`
      });
    }

    const deploymentId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const template = strategyTemplates.get(strategyId) || strategyTemplates.get(templateType);
    const custom = customStrategies.get(strategyId);

    const deployment: DeployedStrategy = {
      deploymentId,
      strategyId: targetStrategyId,
      name: name || custom?.name || template?.name || 'Automated Strategy',
      symbol,
      templateType: templateType || 'dhokiya_009',
      mode: type === 'live' ? 'live' : 'paper',
      status: 'RUNNING',
      qtyMultiplier: multiplier,
      maxProfit: Number(maxProfit) || 0,
      maxLoss: lossLimit,
      deployedAt: new Date().toISOString(),
      tradesExecuted: 0,
      pnl: 0,
      config: { broker, squareOff, type }
    };

    activeDeployments.set(deploymentId, deployment);
    saveDeployments();

    paperExecutor.recordAudit('STRATEGY_SIGNAL', symbol, {
      action: 'DEPLOYED',
      deploymentId,
      strategyName: deployment.name,
      mode: deployment.mode
    });

    logger.info(`🚀 [Strategy Deployed] ${deployment.name} (${deployment.symbol}) deployed in ${deployment.mode.toUpperCase()} mode.`);

    res.json({
      success: true,
      message: `Strategy "${deployment.name}" successfully deployed on ${symbol}!`,
      deployment
    });
  } catch (error: any) {
    logger.error('Deploy strategy error:', error);
    res.status(500).json({ success: false, message: 'Failed to deploy strategy', error: error.message });
  }
});

/**
 * DELETE /api/strategies/deployment/:id
 */
router.delete('/deployment/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (activeDeployments.has(id)) {
    activeDeployments.delete(id);
    saveDeployments();
    return res.json({ success: true, message: 'Deployment removed' });
  }
  res.status(404).json({ success: false, message: 'Deployment not found' });
});

/**
 * POST /api/strategies/test-trigger
 */
router.post('/test-trigger', async (req: Request, res: Response) => {
  try {
    const { deploymentId, symbol = 'RELIANCE', side = 'BUY', quantity = 5 } = req.body;

    const deployment = deploymentId ? activeDeployments.get(deploymentId) : null;
    const targetSymbol = deployment ? deployment.symbol : symbol;
    const tradeQty = deployment ? deployment.qtyMultiplier * quantity : quantity;

    logger.info(`⚡ [Strategy Trigger Test] Evaluating trigger for ${targetSymbol} (${side})`);

    const orderResult = await paperExecutor.executeOrder({
      symbol: targetSymbol,
      exchange: 'NSE',
      side: side as 'BUY' | 'SELL',
      orderType: 'MARKET',
      productType: 'INTRADAY',
      validity: 'DAY',
      quantity: tradeQty,
      strategyId: deployment ? deployment.strategyId : 'dhokiya_009'
    });

    if (deployment) {
      deployment.tradesExecuted += 1;
      deployment.lastTriggerAt = new Date().toISOString();
      activeDeployments.set(deployment.deploymentId, deployment);
      saveDeployments();
    }

    res.json({
      success: true,
      message: `Trigger executed: ${side} ${tradeQty} Qty of ${targetSymbol}`,
      orderResult,
      deployment
    });
  } catch (error: any) {
    logger.error('Test trigger error:', error);
    res.status(500).json({ success: false, message: 'Failed to test strategy trigger', error: error.message });
  }
});

/**
 * POST /api/strategies/stop
 */
router.post('/stop', (req: Request, res: Response) => {
  const { deploymentId } = req.body;
  const deployment = activeDeployments.get(deploymentId);
  if (!deployment) {
    return res.status(404).json({ success: false, message: 'Deployment not found' });
  }

  deployment.status = 'STOPPED';
  activeDeployments.set(deploymentId, deployment);
  saveDeployments();

  paperExecutor.recordAudit('STRATEGY_SIGNAL', deployment.symbol, {
    action: 'STOPPED',
    deploymentId
  });

  res.json({
    success: true,
    message: `Strategy ${deployment.name} stopped`,
    deployment
  });
});

/**
 * GET /api/strategies/:id
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const strategy = customStrategies.get(id) || Array.from(customStrategies.values()).find((s) => s.id === id || s.id === `strat_${id}`);
  if (strategy) {
    return res.json({ success: true, strategy });
  }

  // Fallback to check templates
  const template = strategyTemplates.get(id) || Array.from(strategyTemplates.values()).find((t) => t.id === id || t.id === `tmpl_${id}`);
  if (template) {
    return res.json({ success: true, strategy: template, isTemplate: true });
  }

  res.status(404).json({ success: false, message: 'Strategy not found' });
});

// ============================================================
// NIFTY 0.09% ATM FULL-DAY BREAKOUT STRATEGY ENGINE ROUTES
// ============================================================

import { nifty009Engine } from '../strategies/nifty009/Nifty009Engine';
import { DEFAULT_CONFIG } from '../strategies/nifty009/StrategyStateMachine';

/**
 * POST /api/strategies/nifty009/start
 */
router.post('/nifty009/start', async (req: Request, res: Response) => {
  try {
    const {
      lotSize,
      capitalAllocation,
      squareOffTime,
      maxTradesPerDay,
      maxDailyLoss,
      enableReEntry
    } = req.body;

    const config: Partial<typeof DEFAULT_CONFIG> = {};
    if (lotSize) config.lotSize = Number(lotSize);
    if (capitalAllocation) config.capitalAllocation = Number(capitalAllocation);
    if (squareOffTime) config.squareOffTime = squareOffTime;
    if (maxTradesPerDay) config.maxTradesPerDay = Number(maxTradesPerDay);
    if (maxDailyLoss) config.maxDailyLoss = Number(maxDailyLoss);
    if (enableReEntry !== undefined) config.enableReEntry = Boolean(enableReEntry);

    await nifty009Engine.start(config);

    logger.info('[Route] NIFTY 0.09% strategy started', config);
    res.json({ success: true, message: 'NIFTY 0.09% ATM Full-Day Breakout strategy started (PAPER MODE)', status: nifty009Engine.getStatus() });
  } catch (err: any) {
    logger.error('[Route] nifty009/start error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/strategies/nifty009/stop
 */
router.post('/nifty009/stop', async (req: Request, res: Response) => {
  try {
    await nifty009Engine.stop('Manual stop via API');
    res.json({ success: true, message: 'Strategy stopped', status: nifty009Engine.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/strategies/nifty009/pause
 */
router.post('/nifty009/pause', (_req: Request, res: Response) => {
  try {
    nifty009Engine.pause();
    res.json({ success: true, message: 'Strategy paused', status: nifty009Engine.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/strategies/nifty009/resume
 */
router.post('/nifty009/resume', (_req: Request, res: Response) => {
  try {
    nifty009Engine.resume();
    res.json({ success: true, message: 'Strategy resumed', status: nifty009Engine.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/strategies/nifty009/squareoff
 */
router.post('/nifty009/squareoff', async (_req: Request, res: Response) => {
  try {
    await nifty009Engine.manualSquareOff();
    res.json({ success: true, message: 'Manual square-off executed', status: nifty009Engine.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/strategies/nifty009/emergency-stop
 */
router.post('/nifty009/emergency-stop', async (_req: Request, res: Response) => {
  try {
    await nifty009Engine.emergencyStop();
    res.json({ success: true, message: 'Emergency stop executed', status: nifty009Engine.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/strategies/nifty009/status
 */
router.get('/nifty009/status', (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: nifty009Engine.getStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/strategies/nifty009/report
 */
router.get('/nifty009/report', async (_req: Request, res: Response) => {
  try {
    const report = await nifty009Engine.getDailyReport();
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
