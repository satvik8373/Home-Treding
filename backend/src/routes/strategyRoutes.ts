import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { paperExecutor } from '../execution/PaperExecutor';
import { paperTradingManager } from '../execution/PaperTradingManager';
import { brokerRegistry } from '../brokers/BrokerRegistry';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

export interface StrategyLeg {
  id: string;
  action: 'BUY' | 'SELL';
  symbol?: string;
  strike?: string; // 'ATM 0', 'ATM +100', 'ATM -100', etc.
  strikeCriteria?: string;
  strikeType?: string;
  optionType: 'CE' | 'PE';
  quantity: number;
  expiry?: string;
  slType?: string;
  slValue?: number;
  slOnPrice?: string;
  targetType?: string;
  targetValue?: number;
  tpType?: string;
  tpValue?: number;
  tpOnPrice?: string;
  isActive?: boolean;
}

export interface CustomStrategy {
  id: string;
  userId?: string;
  name: string;
  author: string;
  description?: string;
  segmentType: 'OPTION' | 'EQUITY' | 'FUTURES';
  strategyType: 'Time Based' | 'Indicator Based' | 'Breakout / Trigger';
  symbol: string;
  underlyingType?: 'Spot' | 'Future';
  orderType?: string;
  startTime: string;
  endTime: string;
  tradingDays: string[];
  legs: StrategyLeg[];
  maxLoss?: number;
  maxProfit?: number;
  trailingSl?: string;
  noTradeAfter?: string;
  advancedFeatures?: any;
  lotSize?: number;
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
  symbol?: string;
  segmentType?: string;
  margin: string;
  maxDrawdown: string;
  winRate: string;
  rules: string[];
  underlyingType?: 'Spot' | 'Future';
  strategyType?: string;
  orderType?: string;
  startTime?: string;
  endTime?: string;
  tradingDays?: string[];
  legs?: StrategyLeg[];
  maxLoss?: number;
  maxProfit?: number;
  trailingSl?: string;
  noTradeAfter?: string;
  advancedFeatures?: any;
  lotSize?: number;
  status?: string;
  createdAt?: string;
}

export interface DeployedStrategy {
  deploymentId: string;
  strategyId: string;
  userId?: string;
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

// Default initial custom strategy: Official NIFTY 0.09% ATM Full-Day Breakout Strategy
const INITIAL_STRATEGIES: CustomStrategy[] = [
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
const INITIAL_TEMPLATES: StrategyTemplate[] = [];

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
    }
  }
  if (customStrategies.size === 0 && INITIAL_STRATEGIES.length > 0) {
    INITIAL_STRATEGIES.forEach(s => customStrategies.set(s.id, s));
  }
} catch (e) {
  // Ignore
}

// Auto-load templates from disk
try {
  if (fs.existsSync(templatesFile)) {
    const raw = fs.readFileSync(templatesFile, 'utf-8');
    const list: StrategyTemplate[] = JSON.parse(raw);
    if (list && list.length > 0) {
      list.forEach(t => strategyTemplates.set(t.id, t));
    }
  }
} catch (e) {
  // Ignore
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
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string);
  const all = Array.from(customStrategies.values());
  const filtered = userId 
    ? all.filter(s => !s.userId || s.userId === userId || s.userId === 'user_admin' || s.userId === 'default_user')
    : all;

  res.json({
    success: true,
    strategies: filtered
  });
});


/**
 * POST /api/strategies
 */
router.post('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || 'default_user';
    const {
      name,
      author = req.user?.name || 'Trader',
      description = '',
      segmentType = 'OPTION',
      strategyType = 'Time Based',
      symbol = 'NIFTY BANK',
      underlyingType = 'Spot',
      orderType = 'MIS',
      startTime = '09:16',
      endTime = '15:10',
      tradingDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      legs = [],
      maxLoss = 2500,
      maxProfit = 5000,
      trailingSl = 'No Trailing',
      noTradeAfter = '15:10',
      advancedFeatures = {},
      lotSize = 30
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Strategy name is required' });
    }

    const id = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newStrategy: CustomStrategy = {
      id,
      userId,
      name: name.trim(),
      author: req.user?.name || author,
      description,
      segmentType,
      strategyType,
      symbol,
      underlyingType,
      orderType,
      startTime,
      endTime,
      tradingDays,
      legs: Array.isArray(legs) && legs.length > 0 ? legs : [
        {
          id: `leg_${Date.now()}_1`,
          action: 'SELL',
          symbol,
          strike: 'ATM 0',
          strikeType: 'ATM 0',
          strikeCriteria: 'ATM pt',
          optionType: 'CE',
          quantity: symbol.includes('BANK') ? 30 : 65,
          slType: 'percentage',
          slValue: 1,
          slOnPrice: 'On Price',
          targetType: 'percentage',
          targetValue: 0,
          tpType: 'TP%',
          tpValue: 0,
          tpOnPrice: 'On Price',
          isActive: true
        },
        {
          id: `leg_${Date.now()}_2`,
          action: 'SELL',
          symbol,
          strike: 'ATM 0',
          strikeType: 'ATM 0',
          strikeCriteria: 'ATM pt',
          optionType: 'PE',
          quantity: symbol.includes('BANK') ? 30 : 65,
          slType: 'percentage',
          slValue: 1,
          slOnPrice: 'On Price',
          targetType: 'percentage',
          targetValue: 0,
          tpType: 'TP%',
          tpValue: 0,
          tpOnPrice: 'On Price',
          isActive: true
        }
      ],
      maxLoss: Number(maxLoss) || 2500,
      maxProfit: Number(maxProfit) || 5000,
      trailingSl,
      noTradeAfter,
      advancedFeatures,
      lotSize: Number(lotSize) || (symbol.includes('BANK') ? 30 : 65),
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
router.put('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || 'default_user';
    const id = String(req.params.id);
    let existing = customStrategies.get(id);

    if (!existing) {
      // Check if updating a template ID or converting template to custom strategy
      const tmpl = strategyTemplates.get(id) || Array.from(strategyTemplates.values()).find(t => t.id === id);
      if (tmpl) {
        existing = {
          id,
          userId,
          name: tmpl.name,
          author: req.user?.name || 'Trader',
          description: tmpl.description,
          segmentType: (tmpl as any).segmentType || 'OPTION',
          strategyType: (tmpl as any).strategyType || 'Time Based',
          symbol: (tmpl as any).symbol || tmpl.symbols?.[0] || 'NIFTY BANK',
          underlyingType: (tmpl as any).underlyingType || 'Spot',
          orderType: (tmpl as any).orderType || 'MIS',
          startTime: (tmpl as any).startTime || '09:16',
          endTime: (tmpl as any).endTime || '15:10',
          tradingDays: (tmpl as any).tradingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          legs: (tmpl as any).legs || [],
          maxLoss: (tmpl as any).maxLoss || 2200.10,
          maxProfit: (tmpl as any).maxProfit || 2200,
          trailingSl: (tmpl as any).trailingSl || 'No Trailing',
          noTradeAfter: (tmpl as any).noTradeAfter || '15:10',
          advancedFeatures: (tmpl as any).advancedFeatures || {},
          lotSize: (tmpl as any).lotSize || 30,
          createdAt: new Date().toISOString(),
          status: 'active'
        };
      } else {
        existing = {
          id,
          userId,
          name: req.body.name || 'Custom Strategy',
          author: req.body.author || 'Trader',
          segmentType: req.body.segmentType || 'OPTION',
          strategyType: req.body.strategyType || 'Time Based',
          symbol: req.body.symbol || 'NIFTY BANK',
          underlyingType: req.body.underlyingType || 'Spot',
          orderType: req.body.orderType || 'MIS',
          startTime: req.body.startTime || '09:16',
          endTime: req.body.endTime || '15:10',
          tradingDays: req.body.tradingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          legs: req.body.legs || [],
          maxLoss: req.body.maxLoss || 2200.10,
          maxProfit: req.body.maxProfit || 2200,
          trailingSl: req.body.trailingSl || 'No Trailing',
          noTradeAfter: req.body.noTradeAfter || '15:10',
          advancedFeatures: req.body.advancedFeatures || {},
          lotSize: req.body.lotSize || 30,
          createdAt: new Date().toISOString(),
          status: 'active'
        };
      }
    }

    const {
      name,
      author,
      description,
      segmentType,
      strategyType,
      symbol,
      underlyingType,
      orderType,
      startTime,
      endTime,
      tradingDays,
      legs,
      maxLoss,
      maxProfit,
      trailingSl,
      noTradeAfter,
      advancedFeatures,
      lotSize,
      status
    } = req.body || {};

    const updated: CustomStrategy = {
      ...existing,
      id,
      ...(name !== undefined && { name }),
      ...(author !== undefined && { author }),
      ...(description !== undefined && { description }),
      ...(segmentType !== undefined && { segmentType }),
      ...(strategyType !== undefined && { strategyType }),
      ...(symbol !== undefined && { symbol }),
      ...(underlyingType !== undefined && { underlyingType }),
      ...(orderType !== undefined && { orderType }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(tradingDays !== undefined && { tradingDays }),
      ...(legs !== undefined && { legs }),
      ...(maxLoss !== undefined && { maxLoss: Number(maxLoss) }),
      ...(maxProfit !== undefined && { maxProfit: Number(maxProfit) }),
      ...(trailingSl !== undefined && { trailingSl }),
      ...(noTradeAfter !== undefined && { noTradeAfter }),
      ...(advancedFeatures !== undefined && { advancedFeatures }),
      ...(lotSize !== undefined && { lotSize: Number(lotSize) }),
      ...(status !== undefined && { status })
    };

    customStrategies.set(id, updated);
    saveStrategies();

    // If template with this id exists, sync it too
    const existingTmpl = strategyTemplates.get(id);
    if (existingTmpl) {
      strategyTemplates.set(id, {
        ...existingTmpl,
        name: updated.name,
        description: updated.description || existingTmpl.description,
        symbols: [updated.symbol],
        symbol: updated.symbol,
        startTime: updated.startTime,
        endTime: updated.endTime,
        tradingDays: updated.tradingDays,
        legs: updated.legs,
        maxLoss: updated.maxLoss,
        maxProfit: updated.maxProfit,
        trailingSl: updated.trailingSl,
        underlyingType: updated.underlyingType,
        orderType: updated.orderType,
        advancedFeatures: updated.advancedFeatures,
        lotSize: updated.lotSize
      } as any);
      saveTemplates();
    }

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
router.delete('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = customStrategies.get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Strategy not found' });
  }

  customStrategies.delete(id);
  saveStrategies();
  return res.json({ success: true, message: 'Strategy deleted successfully' });
});

/**
 * POST /api/strategies/duplicate/:id
 */
router.post('/duplicate/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId || 'default_user';
  const id = String(req.params.id);
  let existing = customStrategies.get(id);

  if (!existing) {
    const tmpl = strategyTemplates.get(id) || Array.from(strategyTemplates.values()).find(t => t.id === id);
    if (tmpl) {
      existing = {
        id,
        userId,
        name: tmpl.name,
        author: 'Trader',
        description: tmpl.description,
        segmentType: (tmpl as any).segmentType || 'OPTION',
        strategyType: (tmpl as any).strategyType || 'Time Based',
        symbol: (tmpl as any).symbol || tmpl.symbols?.[0] || 'NIFTY BANK',
        underlyingType: (tmpl as any).underlyingType || 'Spot',
        orderType: (tmpl as any).orderType || 'MIS',
        startTime: (tmpl as any).startTime || '09:16',
        endTime: (tmpl as any).endTime || '15:10',
        tradingDays: (tmpl as any).tradingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        legs: (tmpl as any).legs || [],
        maxLoss: (tmpl as any).maxLoss || 2200.10,
        maxProfit: (tmpl as any).maxProfit || 2200,
        trailingSl: (tmpl as any).trailingSl || 'No Trailing',
        noTradeAfter: (tmpl as any).noTradeAfter || '15:10',
        advancedFeatures: (tmpl as any).advancedFeatures || {},
        lotSize: (tmpl as any).lotSize || 30,
        createdAt: new Date().toISOString(),
        status: 'active'
      };
    } else {
      return res.status(404).json({ success: false, message: 'Strategy not found' });
    }
  }

  const newId = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const duplicated: CustomStrategy = {
    ...existing,
    id: newId,
    userId,
    author: req.user?.name || existing.author,
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
      symbol = 'NIFTY 50',
      segmentType = 'OPTION',
      strategyType = 'Time Based',
      orderType = 'MIS',
      underlyingType = 'Spot',
      startTime = '09:16',
      endTime = '15:10',
      tradingDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      legs = [],
      maxLoss = 2200.10,
      maxProfit = 2200,
      trailingSl = 'No Trailing',
      noTradeAfter = '15:10',
      advancedFeatures = {},
      lotSize = 65,
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
      symbols: Array.isArray(symbols) && symbols.length > 0 ? symbols : [symbol || 'NIFTY 50'],
      symbol: symbol || symbols?.[0] || 'NIFTY 50',
      segmentType,
      strategyType,
      orderType,
      underlyingType,
      startTime,
      endTime,
      tradingDays,
      legs,
      maxLoss: Number(maxLoss),
      maxProfit: Number(maxProfit),
      trailingSl,
      noTradeAfter,
      advancedFeatures,
      lotSize: Number(lotSize),
      margin: margin || '₹25,000',
      maxDrawdown: maxDrawdown || '₹2,500',
      winRate: winRate || '65.0%',
      rules: Array.isArray(rules) ? rules : [],
      status: 'active',
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
    const existing = strategyTemplates.get(id) || Array.from(strategyTemplates.values()).find(t => t.id === id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const {
      name,
      category,
      description,
      timeframe,
      symbols,
      symbol,
      segmentType,
      strategyType,
      orderType,
      underlyingType,
      startTime,
      endTime,
      tradingDays,
      legs,
      maxLoss,
      maxProfit,
      trailingSl,
      noTradeAfter,
      advancedFeatures,
      lotSize,
      margin,
      maxDrawdown,
      winRate,
      rules
    } = req.body || {};

    const updated: StrategyTemplate = {
      ...existing,
      id, // preserve original id
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description }),
      ...(timeframe !== undefined && { timeframe }),
      ...(symbols !== undefined && { symbols }),
      ...(symbol !== undefined && { symbol }),
      ...(segmentType !== undefined && { segmentType }),
      ...(strategyType !== undefined && { strategyType }),
      ...(orderType !== undefined && { orderType }),
      ...(underlyingType !== undefined && { underlyingType }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(tradingDays !== undefined && { tradingDays }),
      ...(legs !== undefined && { legs }),
      ...(maxLoss !== undefined && { maxLoss: Number(maxLoss) }),
      ...(maxProfit !== undefined && { maxProfit: Number(maxProfit) }),
      ...(trailingSl !== undefined && { trailingSl }),
      ...(noTradeAfter !== undefined && { noTradeAfter }),
      ...(advancedFeatures !== undefined && { advancedFeatures }),
      ...(lotSize !== undefined && { lotSize: Number(lotSize) }),
      ...(margin !== undefined && { margin }),
      ...(maxDrawdown !== undefined && { maxDrawdown }),
      ...(winRate !== undefined && { winRate }),
      ...(rules !== undefined && { rules })
    } as any;

    strategyTemplates.set(id, updated);
    saveTemplates();

    // Also update customStrategies if exists
    if (customStrategies.has(id)) {
      customStrategies.set(id, {
        ...customStrategies.get(id)!,
        name: updated.name,
        symbol: updated.symbol || updated.symbols?.[0] || 'NIFTY BANK',
        startTime: updated.startTime || '09:16',
        endTime: updated.endTime || '15:10',
        legs: updated.legs || [],
        maxLoss: updated.maxLoss || 2200.10,
        maxProfit: updated.maxProfit || 2200,
        trailingSl: updated.trailingSl || 'No Trailing'
      });
      saveStrategies();
    }

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
router.get('/active', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId || (req.query.userId as string) || 'user_admin';
  const all = Array.from(activeDeployments.values());
  const filtered = all.filter(d => !d.userId || d.userId === userId || d.userId === 'user_admin' || d.userId === 'default');

  res.json({
    success: true,
    count: filtered.length,
    deployments: filtered
  });
});

/**
 * POST /api/strategies/deploy
 */
router.post('/deploy', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || (req.query.userId as string) || (req.body && req.body.userId) || 'user_admin';
    const {
      strategyId,
      name,
      symbol = 'NIFTY 50',
      templateType = 'dhokiya_009',
      qtyMultiplier = 1,
      maxProfit = 0,
      maxLoss = 2500,
      broker = 'paper',
      squareOff = '15:10',
      type = 'paper'
    } = req.body;

    if (!strategyId && !name) {
      return res.status(400).json({ success: false, message: 'Strategy ID or Name is required' });
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

    // Fetch actual strategy logic from custom strategies or templates library
    const custom = customStrategies.get(targetStrategyId) || (strategyId ? customStrategies.get(strategyId) : undefined);
    const template = strategyTemplates.get(targetStrategyId) || (strategyId ? strategyTemplates.get(strategyId) : undefined) || strategyTemplates.get(templateType);
    const sourceStrategy = custom || template;

    const actualSymbol = sourceStrategy?.symbol || (sourceStrategy as any)?.symbols?.[0] || symbol;

    // Duplicate Check strictly within this user's deployments
    const existingRunning = Array.from(activeDeployments.values()).find(
      d => (d.userId === userId || d.userId === 'user_admin') &&
           (d.strategyId === targetStrategyId || d.templateType === templateType) &&
           d.symbol.toUpperCase() === actualSymbol.toUpperCase() &&
           d.status === 'RUNNING'
    );

    if (existingRunning) {
      return res.status(409).json({
        success: false,
        message: `Strategy "${existingRunning.name}" is already RUNNING on ${actualSymbol}. Stop the existing deployment before creating a duplicate.`
      });
    }

    const deploymentId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const deployment: DeployedStrategy = {
      deploymentId,
      strategyId: targetStrategyId,
      userId,
      name: name || sourceStrategy?.name || 'Automated Strategy',
      symbol: actualSymbol,
      templateType: templateType || targetStrategyId,
      mode: type === 'live' ? 'live' : 'paper',
      status: 'RUNNING',
      qtyMultiplier: multiplier,
      maxProfit: Number(maxProfit) || sourceStrategy?.maxProfit || 0,
      maxLoss: lossLimit || sourceStrategy?.maxLoss || 2500,
      deployedAt: new Date().toISOString(),
      tradesExecuted: 0,
      pnl: 0,
      config: {
        broker: type === 'live' ? 'dhan' : 'paper',
        type,
        squareOff: squareOff || sourceStrategy?.endTime || '15:10',
        startTime: sourceStrategy?.startTime || '09:16',
        tradingDays: sourceStrategy?.tradingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        legs: sourceStrategy?.legs && sourceStrategy.legs.length > 0 ? sourceStrategy.legs : [],
        lotSize: sourceStrategy?.lotSize || (actualSymbol.includes('BANK') ? 30 : 65),
        orderType: sourceStrategy?.orderType || 'MIS',
        underlyingType: sourceStrategy?.underlyingType || 'Spot',
        trailingSl: sourceStrategy?.trailingSl || 'No Trailing',
        advancedFeatures: sourceStrategy?.advancedFeatures || {}
      }
    };

    activeDeployments.set(deploymentId, deployment);
    saveDeployments();

    // If deploying NIFTY 0.09% breakout, activate the state-machine engine
    if (targetStrategyId === 'nifty-009-atm-breakout' || templateType === 'nifty-009-atm-breakout') {
      try {
        await nifty009Engine.start(
          {
            lotSize: (deployment.config?.lotSize || 75) * multiplier,
            maxDailyLoss: deployment.maxLoss,
            squareOffTime: deployment.config?.squareOff || '15:10'
          },
          deployment.mode,
          userId
        );
        logger.info(`[Nifty009 Engine] Auto-started for deployment ${deploymentId} (${deployment.mode.toUpperCase()} mode)`);
      } catch (err: any) {
        logger.error(`[Nifty009 Engine] Failed to auto-start: ${err.message}`);
      }
    }

    const userExecutor = paperTradingManager.getExecutor(userId);
    userExecutor.recordAudit('STRATEGY_SIGNAL', actualSymbol, {
      action: 'DEPLOYED',
      deploymentId,
      strategyName: deployment.name,
      mode: deployment.mode,
      legsCount: deployment.config?.legs?.length || 0
    });

    logger.info(`🚀 [Strategy Deployed] "${deployment.name}" (${deployment.symbol}) deployed for user ${userId} in ${deployment.mode.toUpperCase()} mode with ${deployment.config?.legs?.length || 0} legs.`);

    res.json({
      success: true,
      message: `Strategy "${deployment.name}" successfully deployed on ${actualSymbol} (${deployment.mode.toUpperCase()} mode)!`,
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
router.delete('/deployment/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = activeDeployments.get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Deployment not found' });
  }

  activeDeployments.delete(id);
  saveDeployments();
  return res.json({ success: true, message: 'Deployment removed' });
});

/**
 * POST /api/strategies/test-trigger
 * Executes all actual configured strategy legs with real market prices, virtual margins, slippage, and live broker routing.
 */
router.post('/test-trigger', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || (req.query.userId as string) || (req.body && req.body.userId) || 'user_admin';
    const executor = paperTradingManager.getExecutor(userId);
    const { deploymentId, symbol = 'NIFTY 50', side = 'BUY', quantity = 25 } = req.body;

    const deployment = deploymentId ? activeDeployments.get(deploymentId) : null;
    const configuredLegs: StrategyLeg[] = deployment?.config?.legs || [];
    const activeLegs = configuredLegs.filter((l) => l.isActive !== false);

    logger.info(`⚡ [Strategy Trigger Execution] Deployment: "${deployment?.name || 'Standalone'}" (${activeLegs.length} active legs) for user ${userId}`);

    // If strategy has real multi-legs configured, execute each leg with its real parameters!
    if (activeLegs.length > 0 && deployment) {
      const executedLegs: any[] = [];
      const liveOrders: any[] = [];

      for (const leg of activeLegs) {
        const legSymbol = `${deployment.symbol} ${leg.strikeType || leg.strike || 'ATM 0'} ${leg.optionType}`;
        const legQty = (Number(leg.quantity) || deployment.config?.lotSize || 30) * deployment.qtyMultiplier;
        const legSide = leg.action || 'BUY';
        const productType = deployment.config?.orderType === 'CNC' ? 'CNC' : 'INTRADAY';

        let liveOrderRes: any = null;
        if (deployment.mode === 'live') {
          const adapter = brokerRegistry.getPrimaryAdapter(userId);
          if (adapter) {
            try {
              liveOrderRes = await adapter.placeOrder({
                symbol: legSymbol,
                exchange: legSymbol.includes('NIFTY') || legSymbol.includes('BANK') ? 'NFO' : 'NSE',
                side: legSide,
                orderType: 'MARKET',
                productType,
                validity: 'DAY',
                quantity: legQty
              });
              liveOrders.push({ legId: leg.id, symbol: legSymbol, result: liveOrderRes });
              logger.info(`[Live Dhan Strategy Order] Leg ${leg.id} placed: ${JSON.stringify(liveOrderRes)}`);
            } catch (err: any) {
              logger.error(`[Live Dhan Strategy Order Failed] Leg ${leg.id}:`, err.message);
              liveOrders.push({ legId: leg.id, symbol: legSymbol, error: err.message });
            }
          }
        }

        // Execute in virtual execution engine for full portfolio, margin, and P&L tracking
        const paperOrderRes = await executor.executeOrder({
          symbol: legSymbol,
          exchange: 'NSE',
          side: legSide,
          orderType: 'MARKET',
          productType,
          validity: 'DAY',
          quantity: legQty,
          strategyId: deployment.strategyId
        });

        executedLegs.push({
          legId: leg.id,
          symbol: legSymbol,
          side: legSide,
          quantity: legQty,
          strike: leg.strikeType || leg.strike,
          optionType: leg.optionType,
          slType: leg.slType,
          slValue: leg.slValue,
          targetType: leg.targetType || leg.tpType,
          targetValue: leg.targetValue || leg.tpValue,
          paperOrder: paperOrderRes,
          liveOrder: liveOrderRes
        });
      }

      deployment.tradesExecuted += activeLegs.length;
      deployment.lastTriggerAt = new Date().toISOString();
      activeDeployments.set(deployment.deploymentId, deployment);
      saveDeployments();

      return res.json({
        success: true,
        message: `Real strategy execution: ${activeLegs.length} leg(s) executed for "${deployment.name}" (${deployment.mode.toUpperCase()} mode)`,
        deployment,
        executedLegs,
        liveOrders
      });
    }

    // Fallback for single-order trigger when no multi-legs are attached
    const targetSymbol = deployment ? deployment.symbol : symbol;
    const tradeQty = deployment ? deployment.qtyMultiplier * quantity : quantity;

    let liveOrderResult: any = null;
    if (deployment && deployment.mode === 'live') {
      const adapter = brokerRegistry.getPrimaryAdapter(userId);
      if (adapter) {
        try {
          liveOrderResult = await adapter.placeOrder({
            symbol: targetSymbol,
            exchange: targetSymbol.includes('NIFTY') ? 'NFO' : 'NSE',
            side: side as 'BUY' | 'SELL',
            orderType: 'MARKET',
            productType: 'INTRADAY',
            validity: 'DAY',
            quantity: tradeQty
          });
        } catch (err: any) {
          liveOrderResult = { success: false, message: err.message };
        }
      }
    }

    const orderResult = await executor.executeOrder({
      symbol: targetSymbol,
      exchange: 'NSE',
      side: side as 'BUY' | 'SELL',
      orderType: 'MARKET',
      productType: 'INTRADAY',
      validity: 'DAY',
      quantity: tradeQty,
      strategyId: deployment ? deployment.strategyId : 'standalone'
    });

    if (deployment) {
      deployment.tradesExecuted += 1;
      deployment.lastTriggerAt = new Date().toISOString();
      activeDeployments.set(deployment.deploymentId, deployment);
      saveDeployments();
    }

    res.json({
      success: true,
      message: `Trigger executed: ${side} ${tradeQty} Qty of ${targetSymbol}${deployment?.mode === 'live' ? ' (LIVE DHAN GATEWAY)' : ' (PAPER SIMULATED)'}`,
      orderResult,
      liveOrderResult,
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
router.post('/stop', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { deploymentId } = req.body;
  const deployment = activeDeployments.get(deploymentId);

  if (!deployment) {
    return res.status(404).json({ success: false, message: 'Deployment not found' });
  }

  deployment.status = 'STOPPED';
  activeDeployments.set(deploymentId, deployment);
  saveDeployments();

  if (deployment.strategyId === 'nifty-009-atm-breakout' || deployment.templateType === 'nifty-009-atm-breakout') {
    try {
      await nifty009Engine.stop('User stopped deployment');
    } catch (e: any) {
      logger.warn('[Stop deployment] nifty009Engine stop notice:', e.message);
    }
  }

  const userExecutor = paperTradingManager.getExecutor(req.userId || 'user_admin');
  userExecutor.recordAudit('STRATEGY_SIGNAL', deployment.symbol, {
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
    return res.json({ success: true, strategy, template: strategy });
  }

  // Fallback to check templates
  const template = strategyTemplates.get(id) || Array.from(strategyTemplates.values()).find((t) => t.id === id || t.id === `tmpl_${id}`);
  if (template) {
    return res.json({ success: true, strategy: template, template, isTemplate: true });
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
