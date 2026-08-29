/**
 * Strategy Testing & Backtest Engine
 * Evaluates real trading strategies against 60-day historical candle data
 */

export interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeResult {
  id: string;
  entryTime: string;
  exitTime: string;
  symbol: string;
  type: 'BUY CALL' | 'BUY PUT' | 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  points: number;
  profit: number;
  quantity: number;
  reason: string;
  durationMinutes: number;
}

export interface DailyResult {
  date: string;
  trades: number;
  profit: number;
  winningTrades: number;
  losingTrades: number;
  gapFilterPassed?: boolean;
}

export interface BacktestResult {
  strategyName: string;
  symbol: string;
  periodDays: number;
  initialCapital: number;
  finalCapital: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  netReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  riskRewardRatio: number;
  trades: TradeResult[];
  dailyResults: DailyResult[];
  equityCurve: Array<{ date: string; equity: number; profit: number }>;
}

export class StrategyTester {
  private trades: TradeResult[] = [];

  /**
   * Run backtest for the specified strategy type
   */
  public async backtest(
    historicalData: CandleData[],
    previousClose: number,
    strategyType: string = 'dhokiya_009',
    symbol: string = 'NIFTY 50',
    initialCapital: number = 100000
  ): Promise<BacktestResult> {
    this.trades = [];

    if (historicalData.length === 0) {
      return this.emptyResult(strategyType, symbol, initialCapital);
    }

    const isIndex = symbol.toUpperCase().includes('NIFTY') || symbol.toUpperCase().includes('BANK');
    const isBankNifty = symbol.toUpperCase().includes('BANK');
    const lotSize = isBankNifty ? 15 : isIndex ? 50 : 25;

    switch (strategyType) {
      case 'ema_crossover':
        this.runEmaCrossover(historicalData, symbol, lotSize);
        break;
      case 'supertrend':
        this.runSupertrend(historicalData, symbol, lotSize);
        break;
      case 'rsi_momentum':
        this.runRsiMomentum(historicalData, symbol, lotSize);
        break;
      case 'orb_15':
        this.runOrb15(historicalData, symbol, lotSize);
        break;
      case 'dhokiya_009':
      default:
        this.runDhokiya(historicalData, previousClose, symbol, lotSize);
        break;
    }

    // Aggregate daily results
    const dayGroups = this.groupByDay(historicalData);
    const dailyResults: DailyResult[] = [];

    for (const [date] of dayGroups) {
      const dayTradesList = this.trades.filter(t => t.entryTime.startsWith(date));
      const dayTrades = dayTradesList.length;
      const dayProfit = dayTradesList.reduce((acc, t) => acc + t.profit, 0);
      const dayWins = dayTradesList.filter(t => t.profit > 0).length;
      const dayLosses = dayTradesList.filter(t => t.profit <= 0).length;

      dailyResults.push({
        date,
        trades: dayTrades,
        profit: Number(dayProfit.toFixed(2)),
        winningTrades: dayWins,
        losingTrades: dayLosses
      });
    }

    return this.calculateResults(dailyResults, strategyType, symbol, initialCapital);
  }

  /**
   * Strategy 1: Dhokiya 0.09% First Candle Breakout (Option Buyer)
   */
  private runDhokiya(
    candles: CandleData[],
    previousClose: number,
    symbol: string,
    lotSize: number
  ): void {
    const dayGroups = this.groupByDay(candles);
    let prevDayClose = previousClose || (candles[0] ? candles[0].open : 24000);

    for (const [date, dayCandles] of dayGroups) {
      if (dayCandles.length < 3) continue;

      const firstCandle = dayCandles[0];
      const openPrice = firstCandle.open;
      const gap = Math.abs(openPrice - prevDayClose);

      // Gap Filter: Only trade if market opens within 150 points
      if (gap <= 150) {
        const firstClose = firstCandle.close;
        const upperTrigger = firstClose * 1.0009;
        const lowerTrigger = firstClose * 0.9991;

        let inCall = false;
        let inPut = false;
        let entryPrice = 0;
        let entryTime = '';
        let dayHigh = firstCandle.high;
        let dayLow = firstCandle.low;

        for (let i = 1; i < dayCandles.length; i++) {
          const c = dayCandles[i];
          dayHigh = Math.max(dayHigh, c.high);
          dayLow = Math.min(dayLow, c.low);

          if (!inCall && !inPut) {
            if (c.close > upperTrigger) {
              inCall = true;
              entryPrice = c.close;
              entryTime = c.timestamp.toISOString();
            } else if (c.close < lowerTrigger) {
              inPut = true;
              entryPrice = c.close;
              entryTime = c.timestamp.toISOString();
            }
          } else if (inCall) {
            const points = c.close - entryPrice;
            const isTarget = points >= 35;
            const isSL = points <= -20 || c.low < dayLow;
            const isEod = i === dayCandles.length - 1;

            if (isTarget || isSL || isEod) {
              const actualPoints = Number(points.toFixed(2));
              const profit = Number((actualPoints * lotSize).toFixed(2));
              this.trades.push({
                id: `TR_${date}_C_${i}`,
                entryTime,
                exitTime: c.timestamp.toISOString(),
                symbol,
                type: 'BUY CALL',
                entryPrice,
                exitPrice: c.close,
                points: actualPoints,
                profit,
                quantity: lotSize,
                reason: isTarget ? 'Target (+35 pts)' : isSL ? 'SL Triggered' : 'EOD Auto-Squareoff',
                durationMinutes: i * 5
              });
              break;
            }
          } else if (inPut) {
            const points = entryPrice - c.close;
            const isTarget = points >= 35;
            const isSL = points <= -20 || c.high > dayHigh;
            const isEod = i === dayCandles.length - 1;

            if (isTarget || isSL || isEod) {
              const actualPoints = Number(points.toFixed(2));
              const profit = Number((actualPoints * lotSize).toFixed(2));
              this.trades.push({
                id: `TR_${date}_P_${i}`,
                entryTime,
                exitTime: c.timestamp.toISOString(),
                symbol,
                type: 'BUY PUT',
                entryPrice,
                exitPrice: c.close,
                points: actualPoints,
                profit,
                quantity: lotSize,
                reason: isTarget ? 'Target (+35 pts)' : isSL ? 'SL Triggered' : 'EOD Auto-Squareoff',
                durationMinutes: i * 5
              });
              break;
            }
          }
        }
      }

      prevDayClose = dayCandles[dayCandles.length - 1].close;
    }
  }

  /**
   * Strategy 2: EMA 9/21 Dynamic Trend Crossover
   */
  private runEmaCrossover(
    candles: CandleData[],
    symbol: string,
    lotSize: number
  ): void {
    if (candles.length < 25) return;

    const closes = candles.map(c => c.close);
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);

    let inPosition = false;
    let posType: 'BUY CALL' | 'BUY PUT' = 'BUY CALL';
    let entryPrice = 0;
    let entryTime = '';
    let entryIdx = 0;

    for (let i = 21; i < candles.length; i++) {
      const prevFast = ema9[i - 1];
      const prevSlow = ema21[i - 1];
      const currFast = ema9[i];
      const currSlow = ema21[i];
      const c = candles[i];

      const bullishCross = prevFast <= prevSlow && currFast > currSlow;
      const bearishCross = prevFast >= prevSlow && currFast < currSlow;

      if (!inPosition) {
        if (bullishCross) {
          inPosition = true;
          posType = 'BUY CALL';
          entryPrice = c.close;
          entryTime = c.timestamp.toISOString();
          entryIdx = i;
        } else if (bearishCross) {
          inPosition = true;
          posType = 'BUY PUT';
          entryPrice = c.close;
          entryTime = c.timestamp.toISOString();
          entryIdx = i;
        }
      } else {
        const points = posType === 'BUY CALL' ? c.close - entryPrice : entryPrice - c.close;
        const targetPts = entryPrice * 0.007; // 0.7% target
        const slPts = entryPrice * 0.0035;   // 0.35% SL (1:2 R:R)
        const isTarget = points >= targetPts;
        const isSL = points <= -slPts;
        const isReverse = (posType === 'BUY CALL' && bearishCross) || (posType === 'BUY PUT' && bullishCross);
        const isMaxHold = (i - entryIdx) >= 40; // Max 40 candles (~3.5 hrs)

        if (isTarget || isSL || isReverse || isMaxHold) {
          const actualPoints = Number(points.toFixed(2));
          const profit = Number((actualPoints * lotSize).toFixed(2));
          const reason = isTarget ? '1:2 Target Hit' : isSL ? 'Stop Loss (0.35%)' : isReverse ? 'EMA Trend Flip' : 'Max Time Exit';

          this.trades.push({
            id: `TR_EMA_${i}`,
            entryTime,
            exitTime: c.timestamp.toISOString(),
            symbol,
            type: posType,
            entryPrice,
            exitPrice: c.close,
            points: actualPoints,
            profit,
            quantity: lotSize,
            reason,
            durationMinutes: (i - entryIdx) * 5
          });

          inPosition = false;
        }
      }
    }
  }

  /**
   * Strategy 3: Supertrend (7, 3) Trend Engine
   */
  private runSupertrend(
    candles: CandleData[],
    symbol: string,
    lotSize: number
  ): void {
    if (candles.length < 15) return;

    // Calculate ATR (7)
    const atr: number[] = new Array(candles.length).fill(0);
    const tr: number[] = new Array(candles.length).fill(0);

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];
      tr[i] = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    }

    let sum = 0;
    for (let i = 1; i <= 7 && i < candles.length; i++) sum += tr[i];
    atr[7] = sum / 7;

    for (let i = 8; i < candles.length; i++) {
      atr[i] = (atr[i - 1] * 6 + tr[i]) / 7;
    }

    // Supertrend Bands
    const upperBand: number[] = new Array(candles.length).fill(0);
    const lowerBand: number[] = new Array(candles.length).fill(0);
    const trend: number[] = new Array(candles.length).fill(1); // 1 = Bullish, -1 = Bearish

    for (let i = 7; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];
      const mid = (c.high + c.low) / 2;
      const bUpper = mid + (3 * atr[i]);
      const bLower = mid - (3 * atr[i]);

      upperBand[i] = (bUpper < upperBand[i - 1] || p.close > upperBand[i - 1]) ? bUpper : upperBand[i - 1];
      lowerBand[i] = (bLower > lowerBand[i - 1] || p.close < lowerBand[i - 1]) ? bLower : lowerBand[i - 1];

      if (c.close > upperBand[i - 1]) {
        trend[i] = 1;
      } else if (c.close < lowerBand[i - 1]) {
        trend[i] = -1;
      } else {
        trend[i] = trend[i - 1];
      }
    }

    let inPosition = false;
    let posType: 'BUY CALL' | 'BUY PUT' = 'BUY CALL';
    let entryPrice = 0;
    let entryTime = '';
    let entryIdx = 0;

    for (let i = 8; i < candles.length; i++) {
      const currTrend = trend[i];
      const prevTrend = trend[i - 1];
      const c = candles[i];

      const bullishSignal = prevTrend === -1 && currTrend === 1;
      const bearishSignal = prevTrend === 1 && currTrend === -1;

      if (!inPosition) {
        if (bullishSignal) {
          inPosition = true;
          posType = 'BUY CALL';
          entryPrice = c.close;
          entryTime = c.timestamp.toISOString();
          entryIdx = i;
        } else if (bearishSignal) {
          inPosition = true;
          posType = 'BUY PUT';
          entryPrice = c.close;
          entryTime = c.timestamp.toISOString();
          entryIdx = i;
        }
      } else {
        const points = posType === 'BUY CALL' ? c.close - entryPrice : entryPrice - c.close;
        const targetPts = entryPrice * 0.008;
        const slPts = entryPrice * 0.004;
        const isTarget = points >= targetPts;
        const isSL = points <= -slPts;
        const isTrendFlip = (posType === 'BUY CALL' && currTrend === -1) || (posType === 'BUY PUT' && currTrend === 1);
        const isMaxHold = (i - entryIdx) >= 35;

        if (isTarget || isSL || isTrendFlip || isMaxHold) {
          const actualPoints = Number(points.toFixed(2));
          const profit = Number((actualPoints * lotSize).toFixed(2));
          const reason = isTarget ? 'Supertrend Target Hit' : isSL ? 'Supertrend SL' : isTrendFlip ? 'Trend Reversal Flip' : 'Time Exit';

          this.trades.push({
            id: `TR_ST_${i}`,
            entryTime,
            exitTime: c.timestamp.toISOString(),
            symbol,
            type: posType,
            entryPrice,
            exitPrice: c.close,
            points: actualPoints,
            profit,
            quantity: lotSize,
            reason,
            durationMinutes: (i - entryIdx) * 5
          });

          inPosition = false;
        }
      }
    }
  }

  /**
   * Strategy 4: 15-Minute Opening Range Breakout (ORB)
   */
  private runOrb15(
    candles: CandleData[],
    symbol: string,
    lotSize: number
  ): void {
    const dayGroups = this.groupByDay(candles);

    for (const [date, dayCandles] of dayGroups) {
      if (dayCandles.length < 5) continue;

      // First 3 candles = 15 minutes
      const orbSlice = dayCandles.slice(0, 3);
      const orbHigh = Math.max(...orbSlice.map(c => c.high));
      const orbLow = Math.min(...orbSlice.map(c => c.low));
      const range = orbHigh - orbLow;

      let inPosition = false;
      let posType: 'BUY CALL' | 'BUY PUT' = 'BUY CALL';
      let entryPrice = 0;
      let entryTime = '';
      let entryIdx = 0;

      for (let i = 3; i < dayCandles.length; i++) {
        const c = dayCandles[i];

        if (!inPosition) {
          if (c.close > orbHigh) {
            inPosition = true;
            posType = 'BUY CALL';
            entryPrice = c.close;
            entryTime = c.timestamp.toISOString();
            entryIdx = i;
          } else if (c.close < orbLow) {
            inPosition = true;
            posType = 'BUY PUT';
            entryPrice = c.close;
            entryTime = c.timestamp.toISOString();
            entryIdx = i;
          }
        } else {
          const points = posType === 'BUY CALL' ? c.close - entryPrice : entryPrice - c.close;
          const isTarget = points >= Math.max(range * 1.2, 30);
          const isSL = points <= -Math.max(range * 0.6, 18);
          const isEod = i === dayCandles.length - 1;

          if (isTarget || isSL || isEod) {
            const actualPoints = Number(points.toFixed(2));
            const profit = Number((actualPoints * lotSize).toFixed(2));

            this.trades.push({
              id: `TR_ORB_${date}_${i}`,
              entryTime,
              exitTime: c.timestamp.toISOString(),
              symbol,
              type: posType,
              entryPrice,
              exitPrice: c.close,
              points: actualPoints,
              profit,
              quantity: lotSize,
              reason: isTarget ? 'ORB 1.2x Target' : isSL ? 'ORB SL Triggered' : 'EOD Squareoff',
              durationMinutes: (i - entryIdx) * 5
            });

            break; // 1 trade per day
          }
        }
      }
    }
  }

  /**
   * Strategy 5: RSI (14) Mean Reversion & Momentum
   */
  private runRsiMomentum(
    candles: CandleData[],
    symbol: string,
    lotSize: number
  ): void {
    if (candles.length < 20) return;

    const closes = candles.map(c => c.close);
    const rsi = this.calculateRSI(closes, 14);

    let inPosition = false;
    let posType: 'BUY CALL' | 'BUY PUT' = 'BUY CALL';
    let entryPrice = 0;
    let entryTime = '';
    let entryIdx = 0;

    for (let i = 15; i < candles.length; i++) {
      const c = candles[i];
      const r = rsi[i];
      const prevR = rsi[i - 1];

      // Oversold bounce up -> BUY CALL
      const buySignal = prevR < 32 && r >= 32;
      // Overbought dip down -> BUY PUT
      const sellSignal = prevR > 68 && r <= 68;

      if (!inPosition) {
        if (buySignal) {
          inPosition = true;
          posType = 'BUY CALL';
          entryPrice = c.close;
          entryTime = c.timestamp.toISOString();
          entryIdx = i;
        } else if (sellSignal) {
          inPosition = true;
          posType = 'BUY PUT';
          entryPrice = c.close;
          entryTime = c.timestamp.toISOString();
          entryIdx = i;
        }
      } else {
        const points = posType === 'BUY CALL' ? c.close - entryPrice : entryPrice - c.close;
        const isTarget = (posType === 'BUY CALL' && r >= 55) || (posType === 'BUY PUT' && r <= 45) || points >= entryPrice * 0.006;
        const isSL = points <= -(entryPrice * 0.0035);
        const isMaxHold = (i - entryIdx) >= 30;

        if (isTarget || isSL || isMaxHold) {
          const actualPoints = Number(points.toFixed(2));
          const profit = Number((actualPoints * lotSize).toFixed(2));

          this.trades.push({
            id: `TR_RSI_${i}`,
            entryTime,
            exitTime: c.timestamp.toISOString(),
            symbol,
            type: posType,
            entryPrice,
            exitPrice: c.close,
            points: actualPoints,
            profit,
            quantity: lotSize,
            reason: isTarget ? 'RSI 50+ Target' : isSL ? 'RSI SL Triggered' : 'Time Exit',
            durationMinutes: (i - entryIdx) * 5
          });

          inPosition = false;
        }
      }
    }
  }

  // --- Helper Indicators ---

  private calculateEMA(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = new Array(values.length).fill(0);
    
    let sum = 0;
    for (let i = 0; i < period && i < values.length; i++) {
      sum += values[i];
      ema[i] = sum / (i + 1);
    }

    for (let i = period; i < values.length; i++) {
      ema[i] = values[i] * k + ema[i - 1] * (1 - k);
    }

    return ema;
  }

  private calculateRSI(values: number[], period: number = 14): number[] {
    const rsi: number[] = new Array(values.length).fill(50);
    if (values.length <= period) return rsi;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
      }

      if (avgLoss === 0) {
        rsi[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi[i] = 100 - (100 / (1 + rs));
      }
    }

    return rsi;
  }

  private groupByDay(candles: CandleData[]): Map<string, CandleData[]> {
    const groups = new Map<string, CandleData[]>();
    for (const candle of candles) {
      const d = new Date(candle.timestamp);
      const date = d.toISOString().split('T')[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(candle);
    }
    return groups;
  }

  private calculateResults(
    dailyResults: DailyResult[],
    strategyName: string,
    symbol: string,
    initialCapital: number
  ): BacktestResult {
    const totalTrades = this.trades.length;
    const winningTrades = this.trades.filter(t => t.profit > 0).length;
    const losingTrades = this.trades.filter(t => t.profit <= 0).length;
    const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

    let totalProfit = 0;
    let totalLoss = 0;
    let runningEquity = initialCapital;
    let peakEquity = initialCapital;
    let maxDrawdown = 0;
    const equityCurve: Array<{ date: string; equity: number; profit: number }> = [];

    equityCurve.push({ date: dailyResults[0]?.date || 'Day 0', equity: initialCapital, profit: 0 });

    for (const trade of this.trades) {
      if (trade.profit > 0) {
        totalProfit += trade.profit;
      } else {
        totalLoss += Math.abs(trade.profit);
      }

      runningEquity += trade.profit;
      peakEquity = Math.max(peakEquity, runningEquity);
      const dd = peakEquity - runningEquity;
      maxDrawdown = Math.max(maxDrawdown, dd);
    }

    // Populate daily equity points
    let currentEq = initialCapital;
    for (const d of dailyResults) {
      currentEq += d.profit;
      equityCurve.push({
        date: d.date,
        equity: Number(currentEq.toFixed(2)),
        profit: d.profit
      });
    }

    const netProfit = Number((totalProfit - totalLoss).toFixed(2));
    const profitFactor = totalLoss > 0 ? Number((totalProfit / totalLoss).toFixed(2)) : totalProfit > 0 ? 99.9 : 0;
    const avgWin = winningTrades > 0 ? Number((totalProfit / winningTrades).toFixed(2)) : 0;
    const avgLoss = losingTrades > 0 ? Number((totalLoss / losingTrades).toFixed(2)) : 0;
    const riskRewardRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : avgWin > 0 ? 2.5 : 0;
    const finalCapital = Number((initialCapital + netProfit).toFixed(2));
    const netReturnPercent = Number(((netProfit / initialCapital) * 100).toFixed(2));
    const maxDrawdownPercent = Number(((maxDrawdown / initialCapital) * 100).toFixed(2));

    return {
      strategyName,
      symbol,
      periodDays: dailyResults.length,
      initialCapital,
      finalCapital,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalProfit: Number(totalProfit.toFixed(2)),
      totalLoss: Number(totalLoss.toFixed(2)),
      netProfit,
      netReturnPercent,
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      maxDrawdownPercent,
      profitFactor,
      avgWin,
      avgLoss,
      riskRewardRatio,
      trades: this.trades.reverse(), // Most recent trades first
      dailyResults,
      equityCurve
    };
  }

  private emptyResult(strategyName: string, symbol: string, initialCapital: number): BacktestResult {
    return {
      strategyName,
      symbol,
      periodDays: 0,
      initialCapital,
      finalCapital: initialCapital,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      netReturnPercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      riskRewardRatio: 0,
      trades: [],
      dailyResults: [],
      equityCurve: []
    };
  }
}

export default StrategyTester;
