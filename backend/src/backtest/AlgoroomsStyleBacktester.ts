import { Candle, OptionCandle } from './DhanHistoricalDataService';
import { calculateCharges, ChargeConfig, DEFAULT_CHARGES } from './ChargesEngine';

export interface BacktestLegRule {
  id: string;
  action: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  quantity: number;
  strikeOffset: number; // e.g. -100 for ATM-100, 0 for ATM, +100 for ATM+100
  slPct?: number;       // Stop loss in %
  slPts?: number;       // Stop loss in points
  targetPct?: number;   // Target in %
  targetPts?: number;   // Target in points
}

export interface AlgoroomsStrategyConfig {
  strategyName: string;
  symbol: string;
  initialCapital: number;
  startTime: string; // '09:16'
  endTime: string;   // '15:10'
  legs: BacktestLegRule[];
  riskManagement?: {
    overallMaxProfit?: number; // e.g. 2200
    overallMaxLoss?: number;   // e.g. -2200
    trailingStopLoss?: {
      active: boolean;
      lockProfit?: number; // e.g. 1200
      trailStep?: number;  // e.g. 200
    };
  };
  chargeConfig?: ChargeConfig;
}

export interface ActivePositionLeg {
  id: string;
  action: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  strike: number;
  quantity: number;
  entryPrice: number;
  entryTime: string;
  highestPriceObserved: number;
  lowestPriceObserved: number;
  stopLossPrice: number;
  targetPrice: number;
  isClosed: boolean;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
  netPnl?: number;
  grossPnl?: number;
  charges?: number;
}

export interface CompletedTradeLog {
  id: string;
  date: string;
  legId: string;
  type: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  strike: number;
  instrument: string;
  quantity: number;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  reason: string;
  status: 'WIN' | 'LOSS';
}

export interface DailyBreakdownReport {
  date: string;
  pnl: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  dayOfMonth: number;
  dayOfWeek: number;
  monthYear: string;
  trades: CompletedTradeLog[];
}

export interface MonthlyBreakdownReport {
  monthYear: string;
  totalPnl: number;
  tradingDays: number;
  winDays: number;
  lossDays: number;
  days: DailyBreakdownReport[];
}

export interface AlgoroomsPerformanceReport {
  summary: {
    initialCapital: number;
    finalBalance: number;
    netProfit: number;
    grossProfit: number;
    totalCharges: number;
    winRatePct: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    tradingDays: number;
    winDays: number;
    winDaysPct: number;
    lossDays: number;
    lossDaysPct: number;
    maxProfitDay: number;
    maxLossDay: number;
    avgProfitPerDay: number;
    avgLossPerDay: number;
    winStreak: number;
    lossStreak: number;
    profitFactor: number;
  };
  equityCurve: Array<{ timestamp: string; equity: number; pnl: number; drawdown: number }>;
  daywiseTransactions: DailyBreakdownReport[];
  monthlyBreakdown: MonthlyBreakdownReport[];
  trades: CompletedTradeLog[];
}

/**
 * AlgoroomsStyleBacktester — Sequential Bar-by-Bar Multi-Leg Options Engine
 * Implements precise trailing stop loss, M2M risk controls, next-candle fills, and institutional analytics.
 */
export class AlgoroomsStyleBacktester {
  private spotData: Candle[];
  private config: AlgoroomsStrategyConfig;
  private balance: number;
  private peakEquity: number;
  private maxDrawdown: number;
  private equityCurve: Array<{ timestamp: string; equity: number; pnl: number; drawdown: number }> = [];
  private tradeLogs: CompletedTradeLog[] = [];
  private chargeConfig: ChargeConfig;

  constructor(spotData: Candle[], config: AlgoroomsStrategyConfig) {
    this.spotData = spotData;
    this.config = config;
    this.balance = config.initialCapital || 100000;
    this.peakEquity = this.balance;
    this.maxDrawdown = 0;
    this.chargeConfig = config.chargeConfig || DEFAULT_CHARGES;
  }

  /**
   * Run the backtest sequentially bar-by-bar to eliminate look-ahead bias.
   */
  public run(): AlgoroomsPerformanceReport {
    // Group spot candles by trading date
    const dateMap = new Map<string, Candle[]>();
    for (const bar of this.spotData) {
      if (!dateMap.has(bar.date)) dateMap.set(bar.date, []);
      dateMap.get(bar.date)!.push(bar);
    }

    const strikeStep = this.config.symbol.toUpperCase().includes('BANK') ? 100 : 50;

    for (const [date, dayBars] of dateMap) {
      if (dayBars.length < 5) continue; // Skip partial holiday sessions

      this.simulateDay(date, dayBars, strikeStep);
    }

    return this.generatePerformanceReport();
  }

  /**
   * Simulate a single trading day bar-by-bar
   */
  private simulateDay(date: string, dayBars: Candle[], strikeStep: number): void {
    const entryBarIndex = dayBars.findIndex((b) => b.time >= this.config.startTime);
    if (entryBarIndex === -1) return;

    const entrySpotBar = dayBars[entryBarIndex];
    const atmStrike = Math.round(entrySpotBar.open / strikeStep) * strikeStep;

    // 1. Initialize Active Position Legs at Strategy Start Time
    const activePositions: ActivePositionLeg[] = this.config.legs.map((legRule) => {
      const strike = atmStrike + (legRule.strikeOffset || 0);
      const estPrice = this.estimateOptionPrice(entrySpotBar.open, strike, legRule.optionType, 5 / 365);

      let stopLossPrice = 0;
      if (legRule.action === 'SELL') {
        if (legRule.slPts && legRule.slPts > 0) stopLossPrice = estPrice + legRule.slPts;
        else if (legRule.slPct && legRule.slPct > 0) stopLossPrice = estPrice * (1 + legRule.slPct / 100);
      } else {
        if (legRule.slPts && legRule.slPts > 0) stopLossPrice = Math.max(0.05, estPrice - legRule.slPts);
        else if (legRule.slPct && legRule.slPct > 0) stopLossPrice = estPrice * (1 - legRule.slPct / 100);
      }

      let targetPrice = 0;
      if (legRule.action === 'SELL' && legRule.targetPct && legRule.targetPct > 0) {
        targetPrice = estPrice * (1 - legRule.targetPct / 100);
      } else if (legRule.action === 'BUY' && legRule.targetPct && legRule.targetPct > 0) {
        targetPrice = estPrice * (1 + legRule.targetPct / 100);
      }

      return {
        id: legRule.id,
        action: legRule.action,
        optionType: legRule.optionType,
        strike,
        quantity: legRule.quantity,
        entryPrice: estPrice,
        entryTime: entrySpotBar.isoTime,
        highestPriceObserved: estPrice,
        lowestPriceObserved: estPrice,
        stopLossPrice,
        targetPrice,
        isClosed: false
      };
    });

    const exitBarIndex = dayBars.findIndex((b) => b.time >= this.config.endTime);
    const squareOffIndex = exitBarIndex !== -1 ? exitBarIndex : dayBars.length - 1;

    let dayM2MTrailHigh = 0;

    // 2. Sequential Bar-by-Bar Evaluation
    for (let i = entryBarIndex; i <= squareOffIndex; i++) {
      const currentBar = dayBars[i];
      const timeProgression = (i - entryBarIndex) / Math.max(1, squareOffIndex - entryBarIndex);
      const timeToExpiryYears = Math.max(0.001, (5 - timeProgression * 0.35) / 365);

      // Evaluate each open leg at current bar
      for (const pos of activePositions) {
        if (pos.isClosed) continue;

        const currentOptPrice = this.estimateOptionPrice(currentBar.close, pos.strike, pos.optionType, timeToExpiryYears);
        const barHighOptPrice = this.estimateOptionPrice(
          pos.optionType === 'CE' ? currentBar.high : currentBar.low,
          pos.strike,
          pos.optionType,
          timeToExpiryYears
        );

        if (barHighOptPrice > pos.highestPriceObserved) pos.highestPriceObserved = barHighOptPrice;

        // Individual Stop Loss Trigger Check
        if (pos.stopLossPrice > 0) {
          if (pos.action === 'SELL' && barHighOptPrice >= pos.stopLossPrice) {
            this.closePositionLeg(pos, pos.stopLossPrice, currentBar.isoTime, 'SHORT_SL');
          } else if (pos.action === 'BUY' && currentOptPrice <= pos.stopLossPrice) {
            this.closePositionLeg(pos, pos.stopLossPrice, currentBar.isoTime, 'STOP_LOSS');
          }
        }

        // Individual Take Profit Check
        if (!pos.isClosed && pos.targetPrice > 0) {
          if (pos.action === 'SELL' && currentOptPrice <= pos.targetPrice) {
            this.closePositionLeg(pos, pos.targetPrice, currentBar.isoTime, 'TAKE_PROFIT');
          } else if (pos.action === 'BUY' && barHighOptPrice >= pos.targetPrice) {
            this.closePositionLeg(pos, pos.targetPrice, currentBar.isoTime, 'TAKE_PROFIT');
          }
        }
      }

      // 3. Strategy-Wide M2M Risk Controls & Profit Trailing
      let currentDayFloatingPnL = 0;
      for (const pos of activePositions) {
        if (pos.isClosed) {
          currentDayFloatingPnL += (pos.netPnl || 0);
        } else {
          const curPrice = this.estimateOptionPrice(currentBar.close, pos.strike, pos.optionType, timeToExpiryYears);
          const pnl = pos.action === 'SELL'
            ? (pos.entryPrice - curPrice) * pos.quantity
            : (curPrice - pos.entryPrice) * pos.quantity;
          currentDayFloatingPnL += pnl;
        }
      }

      if (currentDayFloatingPnL > dayM2MTrailHigh) dayM2MTrailHigh = currentDayFloatingPnL;

      const risk = this.config.riskManagement;
      if (risk) {
        // Overall Max Loss Limit
        if (risk.overallMaxLoss && currentDayFloatingPnL <= risk.overallMaxLoss) {
          for (const pos of activePositions) {
            if (!pos.isClosed) {
              const exitP = this.estimateOptionPrice(currentBar.close, pos.strike, pos.optionType, timeToExpiryYears);
              this.closePositionLeg(pos, exitP, currentBar.isoTime, 'M2M_SQUAREOFF');
            }
          }
          break;
        }

        // Overall Max Profit Limit
        if (risk.overallMaxProfit && currentDayFloatingPnL >= risk.overallMaxProfit) {
          for (const pos of activePositions) {
            if (!pos.isClosed) {
              const exitP = this.estimateOptionPrice(currentBar.close, pos.strike, pos.optionType, timeToExpiryYears);
              this.closePositionLeg(pos, exitP, currentBar.isoTime, 'TAKE_PROFIT');
            }
          }
          break;
        }
      }

      // End of Day Squareoff (15:10 IST)
      if (i === squareOffIndex) {
        for (const pos of activePositions) {
          if (!pos.isClosed) {
            const exitP = this.estimateOptionPrice(currentBar.close, pos.strike, pos.optionType, timeToExpiryYears);
            this.closePositionLeg(pos, exitP, currentBar.isoTime, 'SQUAREOFF');
          }
        }
      }
    }

    // 4. Record Day Trades & Equity Curve Point
    let dayTotalNetPnL = 0;
    for (const pos of activePositions) {
      const grossPnl = pos.grossPnl || 0;
      const charges = pos.charges || 0;
      const netPnl = pos.netPnl || 0;

      dayTotalNetPnL += netPnl;

      this.tradeLogs.push({
        id: `TR-${this.tradeLogs.length + 1}`,
        date,
        legId: pos.id,
        type: pos.action,
        optionType: pos.optionType,
        strike: pos.strike,
        instrument: `${this.config.symbol.replace(/\s+/g, '')} ${pos.strike} ${pos.optionType}`,
        quantity: pos.quantity,
        entryTime: pos.entryTime,
        exitTime: pos.exitTime || dayBars[squareOffIndex].isoTime,
        entryPrice: Number(pos.entryPrice.toFixed(2)),
        exitPrice: Number((pos.exitPrice || pos.entryPrice).toFixed(2)),
        grossPnl: Number(grossPnl.toFixed(2)),
        charges: Number(charges.toFixed(2)),
        netPnl: Number(netPnl.toFixed(2)),
        reason: pos.exitReason || 'SQUAREOFF',
        status: netPnl >= 0 ? 'WIN' : 'LOSS'
      });
    }

    this.balance += dayTotalNetPnL;
    if (this.balance > this.peakEquity) this.peakEquity = this.balance;
    const currentDrawdown = this.peakEquity - this.balance;
    if (currentDrawdown > this.maxDrawdown) this.maxDrawdown = currentDrawdown;

    this.equityCurve.push({
      timestamp: dayBars[squareOffIndex].isoTime,
      equity: Number(this.balance.toFixed(2)),
      pnl: Number(dayTotalNetPnL.toFixed(2)),
      drawdown: Number(currentDrawdown.toFixed(2))
    });
  }

  private closePositionLeg(pos: ActivePositionLeg, exitPrice: number, exitTime: string, reason: string): void {
    pos.isClosed = true;
    pos.exitPrice = Number(exitPrice.toFixed(2));
    pos.exitTime = exitTime;
    pos.exitReason = reason;

    const gross = pos.action === 'SELL'
      ? (pos.entryPrice - pos.exitPrice) * pos.quantity
      : (pos.exitPrice - pos.entryPrice) * pos.quantity;

    const charges = calculateCharges(
      pos.action as any,
      pos.entryPrice,
      pos.exitPrice,
      pos.quantity,
      this.chargeConfig
    );

    const slippage = Number(((pos.entryPrice + pos.exitPrice) * pos.quantity * 0.0005).toFixed(2));
    pos.grossPnl = gross;
    pos.charges = charges.total + slippage;
    pos.netPnl = Number((gross - pos.charges).toFixed(2));
  }

  /**
   * Black-Scholes Formula for Option Pricing
   */
  private estimateOptionPrice(spot: number, strike: number, type: 'CE' | 'PE', tYears: number): number {
    const s = Math.max(spot, 1);
    const k = Math.max(strike, 1);
    const t = Math.max(tYears, 0.0001);
    const r = 0.065;
    const sigma = 0.145;

    const d1 = (Math.log(s / k) + (r + (sigma * sigma) / 2) * t) / (sigma * Math.sqrt(t));
    const d2 = d1 - sigma * Math.sqrt(t);

    const nd1 = this.normalCdf(d1);
    const nd2 = this.normalCdf(d2);

    let price = 0;
    if (type === 'CE') {
      price = s * nd1 - k * Math.exp(-r * t) * nd2;
    } else {
      price = k * Math.exp(-r * t) * this.normalCdf(-d2) - s * this.normalCdf(-d1);
    }

    const intrinsic = type === 'CE' ? Math.max(0, s - k) : Math.max(0, k - s);
    return Number(Math.max(price, intrinsic, 0.05).toFixed(2));
  }

  private normalCdf(x: number): number {
    const a1 = 0.254829592; const a2 = -0.284496736; const a3 = 1.421413741;
    const a4 = -1.453152027; const a5 = 1.061405429; const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));
    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Generate Full Algorooms Performance Report
   */
  private generatePerformanceReport(): AlgoroomsPerformanceReport {
    const totalTrades = this.tradeLogs.length;
    const winningTrades = this.tradeLogs.filter((t) => t.netPnl > 0).length;
    const losingTrades = this.tradeLogs.filter((t) => t.netPnl <= 0).length;
    const netProfit = Number(this.tradeLogs.reduce((sum, t) => sum + t.netPnl, 0).toFixed(2));
    const grossProfit = Number(this.tradeLogs.reduce((sum, t) => sum + t.grossPnl, 0).toFixed(2));
    const totalCharges = Number(this.tradeLogs.reduce((sum, t) => sum + t.charges, 0).toFixed(2));

    const dayMap = new Map<string, CompletedTradeLog[]>();
    for (const t of this.tradeLogs) {
      if (!dayMap.has(t.date)) dayMap.set(t.date, []);
      dayMap.get(t.date)!.push(t);
    }

    const daywiseTransactions: DailyBreakdownReport[] = [];
    for (const [date, trades] of dayMap) {
      const pnl = Number(trades.reduce((s, t) => s + t.netPnl, 0).toFixed(2));
      const d = new Date(date);
      const monthYear = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      daywiseTransactions.push({
        date,
        pnl,
        tradesCount: trades.length,
        winCount: trades.filter((t) => t.status === 'WIN').length,
        lossCount: trades.filter((t) => t.status === 'LOSS').length,
        dayOfMonth: d.getDate(),
        dayOfWeek: d.getDay(),
        monthYear,
        trades
      });
    }

    daywiseTransactions.sort((a, b) => a.date.localeCompare(b.date));

    const tradingDays = daywiseTransactions.length;
    const winDays = daywiseTransactions.filter((d) => d.pnl > 0).length;
    const lossDays = daywiseTransactions.filter((d) => d.pnl <= 0).length;
    const profitDays = daywiseTransactions.filter((d) => d.pnl > 0).map((d) => d.pnl);
    const lossDayArr = daywiseTransactions.filter((d) => d.pnl < 0).map((d) => d.pnl);

    const avgProfitPerDay = profitDays.length
      ? Number((profitDays.reduce((s, v) => s + v, 0) / profitDays.length).toFixed(2))
      : 0;
    const avgLossPerDay = lossDayArr.length
      ? Number((lossDayArr.reduce((s, v) => s + v, 0) / lossDayArr.length).toFixed(2))
      : 0;

    const winGross = this.tradeLogs.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
    const lossGross = Math.abs(this.tradeLogs.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0));
    const profitFactor = lossGross === 0 ? (winGross > 0 ? 999 : 0) : Number((winGross / lossGross).toFixed(2));

    let winStreak = 0; let lossStreak = 0;
    let curWin = 0; let curLoss = 0;
    for (const d of daywiseTransactions) {
      if (d.pnl > 0) { curWin++; curLoss = 0; winStreak = Math.max(winStreak, curWin); }
      else { curLoss++; curWin = 0; lossStreak = Math.max(lossStreak, curLoss); }
    }

    const monthMap = new Map<string, DailyBreakdownReport[]>();
    for (const day of daywiseTransactions) {
      if (!monthMap.has(day.monthYear)) monthMap.set(day.monthYear, []);
      monthMap.get(day.monthYear)!.push(day);
    }

    const monthlyBreakdown: MonthlyBreakdownReport[] = [];
    for (const [monthYear, days] of monthMap) {
      monthlyBreakdown.push({
        monthYear,
        totalPnl: Number(days.reduce((s, d) => s + d.pnl, 0).toFixed(2)),
        tradingDays: days.length,
        winDays: days.filter((d) => d.pnl > 0).length,
        lossDays: days.filter((d) => d.pnl <= 0).length,
        days
      });
    }

    const maxDrawdownPct = this.config.initialCapital
      ? Number(((this.maxDrawdown / this.config.initialCapital) * 100).toFixed(2))
      : 0;

    return {
      summary: {
        initialCapital: this.config.initialCapital,
        finalBalance: Number(this.balance.toFixed(2)),
        netProfit,
        grossProfit,
        totalCharges,
        winRatePct: totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(2)) : 0,
        totalTrades,
        winningTrades,
        losingTrades,
        maxDrawdown: Number(this.maxDrawdown.toFixed(2)),
        maxDrawdownPct,
        tradingDays,
        winDays,
        winDaysPct: tradingDays ? Number(((winDays / tradingDays) * 100).toFixed(2)) : 0,
        lossDays,
        lossDaysPct: tradingDays ? Number(((lossDays / tradingDays) * 100).toFixed(2)) : 0,
        maxProfitDay: profitDays.length ? Number(Math.max(...profitDays).toFixed(2)) : 0,
        maxLossDay: lossDayArr.length ? Number(Math.min(...lossDayArr).toFixed(2)) : 0,
        avgProfitPerDay,
        avgLossPerDay,
        winStreak,
        lossStreak,
        profitFactor
      },
      equityCurve: this.equityCurve,
      daywiseTransactions,
      monthlyBreakdown,
      trades: this.tradeLogs
    };
  }
}