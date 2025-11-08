import { EventEmitter } from 'events';
import { tradingEngine } from './tradingEngine';
import { orderManagement } from './orderManagement';
import { portfolioService } from './portfolioService';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  code: string;
  language: 'javascript' | 'python';
  status: 'stopped' | 'running' | 'paused' | 'error';
  symbols: string[];
  timeframe: string;
  parameters: { [key: string]: any };
  riskSettings: RiskSettings;
  performance: StrategyPerformance;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  brokerId?: string;
}

export interface RiskSettings {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxOrdersPerDay: number;
}

export interface StrategyPerformance {
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  lastUpdated: Date;
}

export interface StrategySignal {
  strategyId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  quantity: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT';
  reason: string;
  confidence: number;
  timestamp: Date;
}

export class StrategyManager extends EventEmitter {
  private strategies: Map<string, Strategy> = new Map();
  private runningStrategies: Map<string, any> = new Map();
  private strategyIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    tradingEngine.on('marketTick', (tick) => {
      this.processMarketTick(tick);
    });

    orderManagement.on('orderFilled', (order) => {
      this.updateStrategyPerformance(order.strategyId, order);
    });
  }  
// Create new strategy
  async createStrategy(strategyData: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt' | 'performance'>): Promise<Strategy> {
    const strategy: Strategy = {
      ...strategyData,
      id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      performance: {
        totalPnL: 0,
        totalTrades: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        lastUpdated: new Date()
      }
    };

    this.strategies.set(strategy.id, strategy);
    this.emit('strategyCreated', strategy);
    
    console.log(`📈 Strategy created: ${strategy.name} (${strategy.id})`);
    return strategy;
  }

  // Start strategy
  async startStrategy(strategyId: string, brokerId?: string): Promise<boolean> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    if (strategy.status === 'running') {
      throw new Error(`Strategy ${strategyId} is already running`);
    }

    try {
      strategy.status = 'running';
      strategy.brokerId = brokerId;
      strategy.updatedAt = new Date();

      // Subscribe to market data for strategy symbols
      for (const symbol of strategy.symbols) {
        await tradingEngine.subscribeToMarketData(symbol);
      }

      // Start strategy execution
      this.startStrategyExecution(strategy);

      this.strategies.set(strategyId, strategy);
      this.emit('strategyStarted', strategy);
      
      console.log(`🚀 Strategy started: ${strategy.name}`);
      return true;
    } catch (error) {
      strategy.status = 'error';
      this.strategies.set(strategyId, strategy);
      console.error(`❌ Failed to start strategy ${strategyId}:`, error);
      throw error;
    }
  }

  // Stop strategy
  async stopStrategy(strategyId: string): Promise<boolean> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    try {
      strategy.status = 'stopped';
      strategy.updatedAt = new Date();

      // Stop strategy execution
      this.stopStrategyExecution(strategyId);

      this.strategies.set(strategyId, strategy);
      this.emit('strategyStopped', strategy);
      
      console.log(`🛑 Strategy stopped: ${strategy.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to stop strategy ${strategyId}:`, error);
      throw error;
    }
  }