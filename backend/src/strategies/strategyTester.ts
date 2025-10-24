/**
 * Strategy Testing Module
 * Tests strategies with historical data and simulates trades
 */

import { FirstCandleBreakout009Strategy } from './firstCandleBreakout009';

interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradeResult {
  entryTime: Date;
  entryPrice: number;
  exitTime: Date;
  exitPrice: number;
  type: 'call' | 'put';
  profit: number;
  reason: string;
}

interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  maxDrawdown: number;
  profitFactor: number;
  trades: TradeResult[];
  dailyResults: DailyResult[];
}

interface DailyResult {
  date: string;
  trades: number;
  profit: number;
  gapFilterPassed: boolean;
  firstCandleClose: number | null;
  upperTrigger: number | null;
  lowerTrigger: number | null;
}

export class StrategyTester {
  private strategy: FirstCandleBreakout009Strategy;
  private trades: TradeResult[] = [];
  private currentTrade: Partial<TradeResult> | null = null;

  constructor() {
    this.strategy = new FirstCandleBreakout009Strategy();
  }

  /**
   * Backtest strategy with historical data
   */
  async backtest(
    historicalData: CandleData[],
    previousClose: number
  ): Promise<BacktestResult> {
    this.trades = [];
    this.strategy.reset();

    // Group data by day
    const dayGroups = this.groupByDay(historicalData);
    const dailyResults: DailyResult[] = [];

    for (const [date, candles] of dayGroups) {
      const dailyResult = await this.testDay(candles, previousClose, date);
      dailyResults.push(dailyResult);
      
      // Update previous close for next day
      if (candles.length > 0) {
        previousClose = candles[candles.length - 1].close;
      }
    }

    return this.calculateResults(dailyResults);
  }

  /**
   * Test strategy for a single day
   */
  private async testDay(
    candles: CandleData[],
    previousClose: number,
    date: string
  ): Promise<DailyResult> {
    this.strategy.reset();
    
    const dailyResult: DailyResult = {
      date,
      trades: 0,
      profit: 0,
      gapFilterPassed: false,
      firstCandleClose: null,
      upperTrigger: null,
      lowerTrigger: null
    };

    if (candles.length === 0) return dailyResult;

    // Check gap filter
    const openPrice = candles[0].open;
    const gapFilterValid = this.strategy.checkGapFilter(openPrice, previousClose);
    dailyResult.gapFilterPassed = gapFilterValid;

    if (!gapFilterValid) {
      console.log(`${date}: Gap filter failed - No trading`);
      return dailyResult;
    }

    // Process first candle (9:15-9:20)
    const firstCandle = candles[0];
    this.strategy.processFirstCandle(firstCandle);
    
    const state = this.strategy.getState();
    dailyResult.firstCandleClose = state.firstCandleClose;
    dailyResult.upperTrigger = state.upperTrigger;
    dailyResult.lowerTrigger = state.lowerTrigger;

    // Process remaining candles
    for (let i = 1; i < candles.length; i++) {
      const candle = candles[i];
      const result = this.strategy.processCandle(candle);

      // Handle entry signals
      if (result.action === 'call_entry') {
        this.currentTrade = {
          entryTime: candle.timestamp,
          entryPrice: result.price,
          type: 'call'
        };
        console.log(`${date} ${candle.timestamp.toLocaleTimeString()}: CALL ENTRY at ${result.price}`);
      }

      if (result.action === 'put_entry') {
        this.currentTrade = {
          entryTime: candle.timestamp,
          entryPrice: result.price,
          type: 'put'
        };
        console.log(`${date} ${candle.timestamp.toLocaleTimeString()}: PUT ENTRY at ${result.price}`);
      }

      // Handle exit signals
      if ((result.action === 'call_exit' || result.action === 'put_exit') && this.currentTrade) {
        const trade: TradeResult = {
          entryTime: this.currentTrade.entryTime!,
          entryPrice: this.currentTrade.entryPrice!,
          exitTime: candle.timestamp,
          exitPrice: result.price,
          type: this.currentTrade.type!,
          profit: this.calculateProfit(
            this.currentTrade.entryPrice!,
            result.price,
            this.currentTrade.type!
          ),
          reason: result.reason
        };

        this.trades.push(trade);
        dailyResult.trades++;
        dailyResult.profit += trade.profit;

        console.log(`${date} ${candle.timestamp.toLocaleTimeString()}: ${trade.type.toUpperCase()} EXIT at ${result.price} - Profit: ${trade.profit} - ${result.reason}`);
        
        this.currentTrade = null;
      }
    }

    return dailyResult;
  }

  /**
   * Calculate profit for a trade
   */
  private calculateProfit(entryPrice: number, exitPrice: number, type: 'call' | 'put'): number {
    // Simplified: Assume 1:1 movement between index and premium
    // In reality, you'd use option pricing models
    if (type === 'call') {
      return exitPrice - entryPrice;
    } else {
      return entryPrice - exitPrice;
    }
  }

  /**
   * Group candles by day
   */
  private groupByDay(candles: CandleData[]): Map<string, CandleData[]> {
    const groups = new Map<string, CandleData[]>();

    for (const candle of candles) {
      const date = candle.timestamp.toISOString().split('T')[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(candle);
    }

    return groups;
  }

  /**
   * Calculate backtest results
   */
  private calculateResults(dailyResults: DailyResult[]): BacktestResult {
    const winningTrades = this.trades.filter(t => t.profit > 0);
    const losingTrades = this.trades.filter(t => t.profit <= 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const netProfit = totalProfit - totalLoss;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningProfit = 0;

    for (const trade of this.trades) {
      runningProfit += trade.profit;
      if (runningProfit > peak) {
        peak = runningProfit;
      }
      const drawdown = peak - runningProfit;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
      totalProfit,
      totalLoss,
      netProfit,
      maxDrawdown,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
      trades: this.trades,
      dailyResults
    };
  }

  /**
   * Generate sample historical data for testing
   */
  static generateSampleData(days: number = 5): { candles: CandleData[], previousClose: number } {
    const candles: CandleData[] = [];
    let basePrice = 19500;
    const previousClose = basePrice;

    for (let day = 0; day < days; day++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - day - 1));
      date.setHours(9, 15, 0, 0);

      // Generate gap (sometimes within ±150, sometimes not)
      const gap = (Math.random() - 0.5) * 300; // -150 to +150
      const openPrice = basePrice + gap;

      // Generate candles for the day (9:15 to 15:15, 5-min candles)
      const candlesPerDay = 72; // 6 hours * 12 candles per hour
      
      for (let i = 0; i < candlesPerDay; i++) {
        const timestamp = new Date(date);
        timestamp.setMinutes(timestamp.getMinutes() + (i * 5));

        // Random price movement
        const movement = (Math.random() - 0.5) * 20;
        const open = i === 0 ? openPrice : candles[candles.length - 1].close;
        const close = open + movement;
        const high = Math.max(open, close) + Math.random() * 10;
        const low = Math.min(open, close) - Math.random() * 10;

        candles.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume: Math.floor(Math.random() * 1000000) + 500000
        });
      }

      basePrice = candles[candles.length - 1].close;
    }

    return { candles, previousClose };
  }

  /**
   * Print backtest results
   */
  static printResults(results: BacktestResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('BACKTEST RESULTS - First Candle Breakout 0.09%');
    console.log('='.repeat(60));
    
    console.log('\n📊 OVERALL STATISTICS:');
    console.log(`Total Trades: ${results.totalTrades}`);
    console.log(`Winning Trades: ${results.winningTrades}`);
    console.log(`Losing Trades: ${results.losingTrades}`);
    console.log(`Win Rate: ${results.winRate.toFixed(2)}%`);
    
    console.log('\n💰 PROFIT/LOSS:');
    console.log(`Total Profit: ₹${results.totalProfit.toFixed(2)}`);
    console.log(`Total Loss: ₹${results.totalLoss.toFixed(2)}`);
    console.log(`Net Profit: ₹${results.netProfit.toFixed(2)}`);
    console.log(`Max Drawdown: ₹${results.maxDrawdown.toFixed(2)}`);
    console.log(`Profit Factor: ${results.profitFactor.toFixed(2)}`);
    
    console.log('\n📅 DAILY BREAKDOWN:');
    for (const daily of results.dailyResults) {
      console.log(`\n${daily.date}:`);
      console.log(`  Gap Filter: ${daily.gapFilterPassed ? '✅ Passed' : '❌ Failed'}`);
      if (daily.gapFilterPassed) {
        console.log(`  First Candle Close: ${daily.firstCandleClose?.toFixed(2)}`);
        console.log(`  Upper Trigger: ${daily.upperTrigger?.toFixed(2)}`);
        console.log(`  Lower Trigger: ${daily.lowerTrigger?.toFixed(2)}`);
        console.log(`  Trades: ${daily.trades}`);
        console.log(`  Profit: ₹${daily.profit.toFixed(2)}`);
      }
    }
    
    console.log('\n📋 TRADE DETAILS:');
    for (let i = 0; i < results.trades.length; i++) {
      const trade = results.trades[i];
      const profitEmoji = trade.profit > 0 ? '✅' : '❌';
      console.log(`\nTrade ${i + 1} ${profitEmoji}:`);
      console.log(`  Type: ${trade.type.toUpperCase()}`);
      console.log(`  Entry: ${trade.entryTime.toLocaleString()} @ ${trade.entryPrice.toFixed(2)}`);
      console.log(`  Exit: ${trade.exitTime.toLocaleString()} @ ${trade.exitPrice.toFixed(2)}`);
      console.log(`  Profit: ₹${trade.profit.toFixed(2)}`);
      console.log(`  Reason: ${trade.reason}`);
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Example usage
if (require.main === module) {
  console.log('🧪 Running Strategy Backtest...\n');
  
  const tester = new StrategyTester();
  const { candles, previousClose } = StrategyTester.generateSampleData(5);
  
  tester.backtest(candles, previousClose).then(results => {
    StrategyTester.printResults(results);
  });
}

export default StrategyTester;
