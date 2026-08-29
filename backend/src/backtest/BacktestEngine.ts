import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { freeMarketDataService } from './FreeMarketDataService';
import {
  AlgoroomsStyleBacktester,
  AlgoroomsStrategyConfig,
  AlgoroomsPerformanceReport,
  BacktestLegRule
} from './AlgoroomsStyleBacktester';
import { ChargeConfig, DEFAULT_CHARGES } from './ChargesEngine';

export interface BacktestLegConfig {
  id: string;
  action: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  quantity: number;
  slValue: number;
  targetValue: number;
  strike?: string;
  expiry?: 'WEEKLY' | 'MONTHLY';
}

export interface BacktestStrategyConfig {
  id: string;
  name: string;
  symbol: string;
  startTime: string;
  endTime: string;
  legs: BacktestLegConfig[];
  chargeConfig?: ChargeConfig;
  exitWhenOverallProfit?: number;
  exitWhenOverallLoss?: number;
}

export interface BacktestRunParams {
  strategyId: string;
  symbol: string;
  fromDate?: string;
  toDate?: string;
  capital: number;
  legs: BacktestLegConfig[];
  chargeConfig?: ChargeConfig;
}

export class OfficialBacktestEngine {
  private resultsDir: string;

  constructor() {
    this.resultsDir = path.join(__dirname, '../../data/backtest-results');
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Run the backtest using the official Algorooms-style sequential bar-by-bar engine.
   */
  async run(
    strategyConfig: BacktestStrategyConfig,
    params: BacktestRunParams
  ): Promise<any> {
    const runId = `BT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    logger.info(`[BacktestEngine] Executing AlgoroomsStyleBacktester ${runId} for "${strategyConfig.name}"`);

    // 1. Fetch real 5-minute market candles for underlying symbol
    const spotCandles = await freeMarketDataService.get5MinCandles(
      params.symbol,
      params.fromDate,
      params.toDate
    );

    if (!spotCandles || spotCandles.length === 0) {
      throw new Error(`NO_MARKET_DATA: No 5-minute candles available for ${params.symbol}`);
    }

    // 2. Map request legs into BacktestLegRule
    const mappedLegs: BacktestLegRule[] = params.legs.map((l) => {
      let strikeOffset = 0;
      const strikeStr = String(l.strike || 'ATM').toUpperCase();
      if (strikeStr.includes('-')) {
        strikeOffset = -(parseInt(strikeStr.split('-')[1]) || 100);
      } else if (strikeStr.includes('+')) {
        strikeOffset = parseInt(strikeStr.split('+')[1]) || 100;
      } else if (strikeStr.includes('ITM')) {
        const pts = parseInt(strikeStr.replace(/[^0-9]/g, '')) || 100;
        strikeOffset = l.optionType === 'CE' ? -pts : pts;
      } else if (strikeStr.includes('OTM')) {
        const pts = parseInt(strikeStr.replace(/[^0-9]/g, '')) || 100;
        strikeOffset = l.optionType === 'CE' ? pts : -pts;
      }

      const slVal = Number(l.slValue) || 0;
      const tgtVal = Number(l.targetValue) || 0;

      return {
        id: l.id,
        action: l.action,
        optionType: l.optionType,
        quantity: Number(l.quantity) || 30,
        strikeOffset,
        slPts: slVal <= 5 ? slVal : undefined,
        slPct: slVal > 5 ? slVal : undefined,
        targetPct: tgtVal > 0 ? tgtVal : undefined
      };
    });

    // 3. Build Algorooms Strategy Configuration
    const algoConfig: AlgoroomsStrategyConfig = {
      strategyName: strategyConfig.name,
      symbol: params.symbol,
      initialCapital: params.capital || 100000,
      startTime: strategyConfig.startTime || '09:16',
      endTime: strategyConfig.endTime || '15:10',
      legs: mappedLegs,
      riskManagement: {
        overallMaxProfit: strategyConfig.exitWhenOverallProfit ?? 2200,
        overallMaxLoss: strategyConfig.exitWhenOverallLoss ?? -2200,
        trailingStopLoss: {
          active: true,
          lockProfit: 1200,
          trailStep: 200
        }
      },
      chargeConfig: params.chargeConfig ?? strategyConfig.chargeConfig ?? DEFAULT_CHARGES
    };

    // 4. Initialize and Run AlgoroomsStyleBacktester
    const engine = new AlgoroomsStyleBacktester(spotCandles, algoConfig);
    const report: AlgoroomsPerformanceReport = engine.run();

    // 5. Structure final response
    const result = {
      runId,
      strategyId: strategyConfig.id,
      strategyName: strategyConfig.name,
      symbol: params.symbol,
      periodDays: report.summary.tradingDays,
      initialCapital: report.summary.initialCapital,
      finalCapital: report.summary.finalBalance,
      totalGrossPnl: report.summary.grossProfit,
      totalCharges: report.summary.totalCharges,
      totalBrokerage: Number((report.summary.totalTrades * 20).toFixed(2)),
      totalStt: 0,
      totalGst: 0,
      totalNetPnl: report.summary.netProfit,
      maxDrawdown: report.summary.maxDrawdown,
      maxDrawdownPercent: report.summary.maxDrawdownPct,
      dataSource: {
        provider: '100% Free NSE Intraday Market Feed',
        underlyingEndpoint: '5-Minute Real Intraday OHLC',
        optionEndpoint: 'Algorooms-Style Sequential Trade Engine',
        interval: 5,
        timezone: 'Asia/Kolkata',
        syntheticData: false,
        fromDate: spotCandles[0].date,
        toDate: spotCandles[spotCandles.length - 1].date
      },
      summary: {
        tradingDays: report.summary.tradingDays,
        winDays: report.summary.winDays,
        winDaysPercent: report.summary.winDaysPct,
        lossDays: report.summary.lossDays,
        lossDaysPercent: report.summary.lossDaysPct,
        totalTrades: report.summary.totalTrades,
        winTrades: report.summary.winningTrades,
        winTradesPercent: report.summary.winRatePct,
        lossTrades: report.summary.losingTrades,
        lossTradesPercent: Number((100 - report.summary.winRatePct).toFixed(2)),
        maxProfit: report.summary.maxProfitDay,
        maxLoss: report.summary.maxLossDay,
        avgProfitPerDay: report.summary.avgProfitPerDay,
        avgLossPerDay: report.summary.avgLossPerDay,
        winStreak: report.summary.winStreak,
        lossStreak: report.summary.lossStreak,
        profitFactor: report.summary.profitFactor
      },
      equityCurve: report.equityCurve,
      daywiseTransactions: report.daywiseTransactions,
      monthlyBreakdown: report.monthlyBreakdown,
      createdAt: new Date().toISOString()
    };

    this.saveResult(runId, result);
    logger.info(`[BacktestEngine] Backtest complete. Net PnL: ₹${result.totalNetPnl}`);
    return result;
  }

  /** Legacy signature helper */
  async runBacktest(
    strategyId: string,
    symbol: string,
    days: number = 22,
    capital: number = 100000
  ): Promise<any> {
    let strategyConfig: BacktestStrategyConfig | null = null;
    try {
      const strategiesFile = path.join(__dirname, '../../data/strategies.json');
      if (fs.existsSync(strategiesFile)) {
        const strategies: any[] = JSON.parse(fs.readFileSync(strategiesFile, 'utf8'));
        const found = strategies.find((s) => s.id === strategyId || s.name === strategyId);
        if (found) {
          strategyConfig = {
            id: found.id,
            name: found.name,
            symbol: found.symbol ?? symbol,
            startTime: found.startTime ?? '09:16',
            endTime: found.endTime ?? found.squareOff ?? '15:10',
            legs: (found.legs ?? []).map((l: any) => ({
              id: l.id,
              action: l.action ?? l.position ?? 'SELL',
              optionType: l.optionType ?? l.type ?? 'CE',
              quantity: Number(l.quantity ?? l.qty ?? 0),
              slValue: Number(l.slValue ?? l.sl ?? 0),
              targetValue: Number(l.targetValue ?? l.tp ?? 0),
              strike: l.strike ?? l.strikeType ?? 'ATM',
              expiry: l.expiry ?? 'MONTHLY'
            }))
          };
        }
      }
    } catch (_) {}

    if (!strategyConfig) {
      strategyConfig = {
        id: strategyId,
        name: strategyId,
        symbol,
        startTime: '09:16',
        endTime: '15:10',
        legs: [
          { id: 'leg-1', action: 'SELL', optionType: 'CE', quantity: 30, slValue: 0, targetValue: 0, strike: 'ATM -100', expiry: 'MONTHLY' },
          { id: 'leg-2', action: 'SELL', optionType: 'PE', quantity: 30, slValue: 1, targetValue: 0, strike: 'ATM -100', expiry: 'MONTHLY' }
        ]
      };
    }

    return this.run(strategyConfig, {
      strategyId,
      symbol,
      capital,
      legs: strategyConfig.legs
    });
  }

  private saveResult(runId: string, result: any): void {
    try {
      const filePath = path.join(this.resultsDir, `${runId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
      logger.info(`[BacktestEngine] Saved result to ${filePath}`);
    } catch (_) {}
  }
}

export const backtestEngine = new OfficialBacktestEngine();