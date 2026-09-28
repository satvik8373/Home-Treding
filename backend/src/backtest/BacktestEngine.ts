import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DhanHistoricalDataService } from './DhanHistoricalDataService';
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
  private readonly owners = new Map<string, string | undefined>();

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
    const toDate = endDate ?? this.previousIstDate();
    if (!Number.isInteger(days) || days < 1 || days > 730 || !Number.isFinite(capital) || capital <= 0) {
      throw new Error('INVALID_BACKTEST_INPUT: Days must be 1–730 and capital must be positive.');
    }
    if (!this.validDate(fromDate) || !this.validDate(toDate) ||
        fromDate > toDate || toDate >= this.todayIst() || fromDate < '2026-01-01') {
      throw new Error('INVALID_DATE_RANGE: Select completed sessions from 2026 onward, ending before today.');
    }

    const auth = DhanHistoricalDataService.resolveAuth(userId);
    const apiToDate = this.nextDate(toDate);

    const dhan = new DhanHistoricalDataService(auth || undefined);
    const meta = DhanHistoricalDataService.getSecurityMetadata(symbol);
    const spotCandles = await dhan.getIntradayCandles({
      securityId: meta.securityId, exchangeSegment: meta.exchangeSegment,
      instrument: meta.instrument, symbol, fromDate, toDate: apiToDate, interval: 5
    });
    if (!spotCandles.length) throw new Error('NO_HISTORICAL_SPOT_DATA');
    const [ce, pe] = await Promise.all([
      dhan.getFixedStrikeOptionSeries({ symbol, fromDate, toDate: apiToDate,
        optionType: 'CE', strikeStep: 50, referenceTime: '09:15', expiryFlag: 'WEEK', preloadedSpot: spotCandles }),
      dhan.getFixedStrikeOptionSeries({ symbol, fromDate, toDate: apiToDate,
        optionType: 'PE', strikeStep: 50, referenceTime: '09:15', expiryFlag: 'WEEK', preloadedSpot: spotCandles })
    ]);
    const spotDates = [...new Set(spotCandles.map(c => c.date))];
    for (const date of spotDates) {
      if (!ce.strikesByDate[date] || ce.strikesByDate[date] !== pe.strikesByDate[date]) {
        throw new Error(`UNVERIFIED_ATM_CONTRACT: ${date}`);
      }
    }

    const config: AlgoroomsStrategyConfig = {
      strategyName: strategy.name,
      symbol,
      initialCapital: capital,
      startTime: '09:20',
      endTime: '15:10',
      executionResolution: '1m',
      chargeConfig: strategy.chargeConfig ?? DEFAULT_CHARGES,
      strategyParams: strategy.parameters,
      ceOptionSeries: {
        source: dhan.isUsingDhanApi ? 'DHAN_EXPIRED_OPTIONS' : 'ESTIMATED_BSM',
        isSynthetic: false,
        candles1m: ce.candles1m,
        candles5m: ce.candles5m
      },
      peOptionSeries: {
        source: dhan.isUsingDhanApi ? 'DHAN_EXPIRED_OPTIONS' : 'ESTIMATED_BSM',
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
        startDate: spotCandles.length > 0 ? spotCandles[0].date : fromDate,
        endDate: spotCandles.length > 0 ? spotCandles[spotCandles.length - 1].date : toDate,
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
        provider: dhan.isUsingDhanApi ? 'DhanHQ historical spot and expired options' : 'Real NSE Exchange Feed (via Yahoo Finance) + Black-Scholes Model',
        endpoint: dhan.isUsingDhanApi ? '/charts/intraday + /charts/rollingoption' : 'NSE Official 5m Candle Feed + BSM Option Pricing',
        isRealMarketData: true,
        isSynthetic: false,
        feedType: dhan.isUsingDhanApi ? 'EXPIRED_OPTIONS' : 'NSE_INDEX_SPOT_BSM_OPTIONS',
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
        contractResolution: dhan.isUsingDhanApi
          ? '09:15 NIFTY close -> fixed ATM strike in Dhan rolling weekly options'
          : '09:15 NIFTY close -> fixed ATM strike via Black-Scholes-Merton pricing',
        syntheticPrices: false,
        historicalExpirySelection: 'WEEK (current weekly expiry)',
        contractVerification: 'FIXED_STRIKE_MATCHED'
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
    this.owners.set(runId, userId);
    if (this.results.size > 50) {
      const oldest = this.results.keys().next().value!;
      this.results.delete(oldest);
      this.owners.delete(oldest);
    }
    return result;
  }

  getResult(runId: string, userId?: string): any | null {
    return this.owners.get(runId) === userId ? this.results.get(runId) ?? null : null;
  }

  private loadStrategy(strategyId: string, symbol: string): { name: string; chargeConfig?: ChargeConfig; parameters: AlgoroomsStrategyConfig['strategyParams'] } {
    const file = path.join(__dirname, '../../data/strategies.json');
    if (!fs.existsSync(file)) throw new Error('STRATEGY_CONFIG_NOT_FOUND');

    const strategies = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<any>;
    const found = strategies.find((s) => s.id === strategyId);
    if (!found) throw new Error(`STRATEGY_NOT_FOUND:${strategyId}`);
    if (found.symbol !== symbol) throw new Error(`STRATEGY_SYMBOL_MISMATCH:${found.symbol}`);
    if (strategyId !== 'nifty-atm-independent-breakout' || symbol !== 'NIFTY 50' ||
        found.legs?.length !== 2 || !found.legs.some((leg: any) => leg.optionType === 'CE' && leg.action === 'BUY') ||
        !found.legs.some((leg: any) => leg.optionType === 'PE' && leg.action === 'BUY') ||
        found.legs.some((leg: any) => leg.strike !== 'ATM' || leg.isActive === false)) {
      throw new Error('UNSUPPORTED_BACKTEST_STRATEGY: Only the saved NIFTY ATM CE/PE breakout is supported.');
    }
    const p = found.parameters;
    if (!p || !Number.isInteger(p.lotSize) || !Number.isInteger(p.entryLots) ||
        !Number.isFinite(p.breakoutPct) || !Number.isFinite(p.target1Pts) || !Number.isFinite(p.target2Pts)) {
      throw new Error('INVALID_STRATEGY_PARAMETERS');
    }
    if (found.startTime !== '09:20' || found.endTime !== '15:10' ||
        p.referenceCandle !== '09:15-09:20' || p.forceSquareOffTime !== '15:10' ||
        found.maxLoss !== 0 || found.maxProfit !== 0 ||
        found.advancedFeatures?.reEntryAllowed !== true ||
        found.legs.some((leg: any) => leg.quantity !== p.lotSize * p.entryLots)) {
      throw new Error('UNSUPPORTED_STRATEGY_RULES: Saved timing, risk limits or leg quantity differ from this backtest model.');
    }
    return { name: found.name, chargeConfig: found.chargeConfig, parameters: p };
  }

  private nextDate(date: string): string {
    const value = new Date(date + 'T00:00:00Z');
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  }

  private validDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }

  private defaultStartDate(days: number): string {
    const date = new Date(`${this.previousIstDate()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - Math.ceil(days * 1.6));
    return date.toISOString().slice(0, 10);
  }

  private todayIst(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  private previousIstDate(): string {
    const date = new Date(`${this.todayIst()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }
}

export const backtestEngine = new OfficialBacktestEngine();
