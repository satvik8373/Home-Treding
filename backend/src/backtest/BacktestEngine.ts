import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { DhanHistoricalDataService, Candle } from './DhanHistoricalDataService';
import { AlgoroomsStyleBacktester, AlgoroomsStrategyConfig } from './AlgoroomsStyleBacktester';
import { ChargeConfig, DEFAULT_CHARGES } from './ChargesEngine';

export interface BacktestRunParams {
  strategyId: string;
  symbol: string;
  fromDate?: string;
  toDate?: string;
  capital: number;
  userId?: string;
}

export class OfficialBacktestEngine {
  private readonly results = new Map<string, any>();

  async runBacktest(
    strategyId: string,
    symbol: string,
    days = 22,
    capital = 100000,
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    const strategy = this.loadStrategy(strategyId, symbol);
    const fromDate = startDate ?? this.defaultStartDate(days);
    const toDate = endDate ?? new Date().toISOString().slice(0, 10);

    const auth = DhanHistoricalDataService.resolveAuth(userId);
    if (!auth) throw new Error('DHAN_CONNECTION_REQUIRED');

    const dhan = new DhanHistoricalDataService(auth);
    const meta = DhanHistoricalDataService.getSecurityMetadata(symbol);

    const spotCandles = await dhan.getIntradayCandles({
      securityId: meta.securityId,
      exchangeSegment: meta.exchangeSegment,
      instrument: meta.instrument,
      fromDate,
      toDate,
      interval: 5
    });
    if (!spotCandles.length) throw new Error('NO_DHAN_SPOT_DATA');

    const ce = await dhan.getFixedStrikeOptionSeries({
      symbol,
      fromDate,
      toDate,
      optionType: 'CE',
      strikeStep: 50,
      referenceTime: '09:15',
      expiryFlag: 'WEEK'
    });
    const pe = await dhan.getFixedStrikeOptionSeries({
      symbol,
      fromDate,
      toDate,
      optionType: 'PE',
      strikeStep: 50,
      referenceTime: '09:15',
      expiryFlag: 'WEEK'
    });

    const config: AlgoroomsStrategyConfig = {
      strategyName: strategy.name,
      symbol,
      initialCapital: capital,
      startTime: '09:20',
      endTime: '15:10',
      executionResolution: '1m',
      chargeConfig: strategy.chargeConfig ?? DEFAULT_CHARGES,
      ceOptionSeries: {
        source: 'DHAN_EXPIRED_OPTIONS',
        isSynthetic: false,
        candles1m: ce.candles1m,
        candles5m: ce.candles5m
      },
      peOptionSeries: {
        source: 'DHAN_EXPIRED_OPTIONS',
        isSynthetic: false,
        candles1m: pe.candles1m,
        candles5m: pe.candles5m
      }
    };

    const report = new AlgoroomsStyleBacktester(spotCandles, config).run();
    const runId = `BT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const result = {
      runId,
      strategyId,
      strategyName: strategy.name,
      symbol,
      period: {
        startDate: spotCandles[0].date,
        endDate: spotCandles[spotCandles.length - 1].date,
        totalDays: report.summary.tradingDays
      },
      initialCapital: capital,
      finalBalance: report.summary.finalBalance,
      totalNetPnl: report.summary.netProfit,
      totalGrossPnl: report.summary.grossProfit,
      totalCharges: report.summary.totalCharges,
      winRate: report.summary.winRatePct,
      maxDrawdown: report.summary.maxDrawdown,
      profitFactor: report.summary.profitFactor,
      totalTrades: report.summary.totalTrades,
      winningTrades: report.summary.winningTrades,
      losingTrades: report.summary.losingTrades,
      dataSource: {
        provider: 'DhanHQ /charts/rollingoption',
        endpoint: '/charts/rollingoption',
        isRealMarketData: true,
        isSynthetic: false,
        feedType: 'EXPIRED_OPTIONS',
        exchangeSegment: 'NSE_FNO',
        instrument: 'OPTIDX',
        interval: 1,
        timezone: 'Asia/Kolkata',
        spotCandleCount: spotCandles.length,
        ceCandleCount: ce.candles1m.length,
        peCandleCount: pe.candles1m.length,
        fromDate,
        toDate
      },
      provenance: {
        status: 'REAL_DATA',
        signalResolution: '5m',
        executionResolution: '1m',
        contractResolution: '09:15 NIFTY close -> fixed ATM strike -> nearest weekly expiry',
        syntheticPrices: false
      },
      summary: report.summary,
      dataQuality: report.dataQuality,
      equityCurve: report.equityCurve,
      dailyPnlBars: report.daywiseTransactions.map((d) => ({
        date: d.date,
        dayLabel: new Date(`${d.date}T00:00:00+05:30`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        pnl: d.pnl,
        isProfit: d.pnl >= 0
      })),
      daywiseTransactions: report.daywiseTransactions,
      monthlyBreakdown: report.monthlyBreakdown,
      trades: report.trades,
      createdAt: new Date().toISOString()
    };

    this.results.set(runId, result);
    if (this.results.size > 50) this.results.delete(this.results.keys().next().value!);
    return result;
  }

  getResult(runId: string): any | null {
    return this.results.get(runId) ?? null;
  }

  listResults(): any[] {
    return [...this.results.values()].reverse();
  }

  private loadStrategy(strategyId: string, symbol: string): { name: string; chargeConfig?: ChargeConfig } {
    const file = path.join(__dirname, '../../data/strategies.json');
    if (!fs.existsSync(file)) throw new Error('STRATEGY_CONFIG_NOT_FOUND');

    const strategies = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<any>;
    const found = strategies.find((s) => s.id === strategyId);
    if (!found) throw new Error(`STRATEGY_NOT_FOUND:${strategyId}`);
    if (found.symbol !== symbol) throw new Error(`STRATEGY_SYMBOL_MISMATCH:${found.symbol}`);
    return { name: found.name, chargeConfig: found.chargeConfig };
  }

  private defaultStartDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - Math.ceil(days * 1.6));
    return date.toISOString().slice(0, 10);
  }
}

export const backtestEngine = new OfficialBacktestEngine();
