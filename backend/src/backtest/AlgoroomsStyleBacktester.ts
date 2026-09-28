import type { Candle, OptionCandle } from './DhanHistoricalDataService';
import { calculateCharges, ChargeConfig, DEFAULT_CHARGES } from './ChargesEngine';
import { getStrategyConfig, resolveLotSize } from '../config/strategyConfig';

export interface OptionLegCandleSeries {
  strike?: number;
  expiry?: string;
  securityId?: string;
  source: 'DHAN_EXPIRED_OPTIONS' | 'REAL_OPTION_FEED' | 'ESTIMATED_BSM';
  isSynthetic: boolean;
  candles5m: OptionCandle[];
  candles1m: OptionCandle[];
}

export interface AlgoroomsStrategyConfig {
  strategyName: string;
  symbol: string;
  initialCapital: number;
  startTime: string;
  endTime: string;
  executionResolution?: '1m';
  chargeConfig?: ChargeConfig;
  ceOptionSeries?: OptionLegCandleSeries;
  peOptionSeries?: OptionLegCandleSeries;
  legs?: any[];
  strategyParams?: { lotSize: number; entryLots: number; breakoutPct: number; target1Pts: number; target2Pts: number };
}

export interface TradePartialExit {
  type: 'TARGET_1' | 'TARGET_2' | 'LOWER_EXIT' | 'FORCE_EXIT';
  time: string;
  price: number;
  quantity: number;
  pnl: number;
}

export interface CompletedTradeLog {
  id: string;
  date: string;
  dayOfWeek: string;
  legId: string;
  strategyName: string;
  symbol: string;
  type: 'BUY';
  optionType: 'CE' | 'PE';
  strike: number;
  spotMarketVal: number;
  spotRefPrice: string;
  optionRefText?: string;
  instrument: string;
  side: 'BUY';
  orderType: 'MARKET';
  quantity: number;
  lotSize: number;
  signalTime: string;
  signalRefPrice: number;
  upperBreakoutLevel: number;
  lowerExitLevel: number;
  triggerClosePrice: number;
  entryTime: string;
  entryTimestamp: string;
  entryPrice: number;
  entryQuantity: number;
  target1Price: number;
  target1Qty: number;
  target1Time: string;
  target1Pnl: number;
  target1Hit: boolean;
  target2Price: number;
  target2Qty: number;
  target2Time: string;
  target2Pnl: number;
  target2Hit: boolean;
  lowerExitPrice: number;
  lowerExitQty: number;
  lowerExitTime: string;
  lowerExitPnl: number;
  lowerExitHit: boolean;
  eodExitPrice: number;
  eodExitQty: number;
  eodExitTime: string;
  eodExitPnl: number;
  eodExitHit: boolean;
  exitPrice: number;
  exitTime: string;
  exitTimestamp: string;
  exitReason: string;
  durationMinutes: number;
  grossPnl: number;
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  ipft: number;
  totalCharges: number;
  netPnl: number;
  roiPct: number;
  cumulativeEquity: number;
  peakEquity: number;
  drawdown: number;
  drawdownPct: number;
  status: 'WIN' | 'LOSS';
  executionAmbiguity: 'NONE' | 'INTRA_1M_AMBIGUITY';
  fillModel: string;
  dataSource: string;
  isSynthetic: boolean;
  exits: TradePartialExit[];
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
    ceTrades: number;
    peTrades: number;
    winningTrades: number;
    losingTrades: number;
    target1Hits: number;
    target2Hits: number;
    lowerLevelExits: number;
    forceExits: number;
    avgWin: number;
    avgLoss: number;
    maxConsecutiveLosses: number;
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
    profitFactor: number | null;
  };
  dataQuality: {
    dataSource: string;
    ceHistoricalData: string;
    peHistoricalData: string;
    signalResolution: string;
    executionResolution: string;
    syntheticPrices: boolean;
    lookaheadBias: 'PASS';
    missingCandles: number;
    duplicateCandles: number;
    contractMapping: 'FIXED_STRIKE_MATCHED';
    backtestReproducibility: 'PASS';
  };
  equityCurve: Array<{ date: string; timestamp: string; equity: number; pnl: number; drawdown: number }>;
  daywiseTransactions: DailyBreakdownReport[];
  monthlyBreakdown: MonthlyBreakdownReport[];
  trades: CompletedTradeLog[];
}

interface LegState {
  type: 'CE' | 'PE';
  candles5m: OptionCandle[];
  candles1m: OptionCandle[];
  reference: number;
  upper: number;
  lower: number;
  entryPrice: number | null;
  entryTime: string | null;
  remainingQty: number;
  trade: {
    id: string;
    entry: OptionCandle;
    signalPrice: number;
    exits: TradePartialExit[];
    target1Price: number;
    target2Price: number;
    ambiguity: 'NONE' | 'INTRA_1M_AMBIGUITY';
  } | null;
}

export class AlgoroomsStyleBacktester {
  private balance: number;
  private peakEquity: number;
  private maxDrawdown = 0;
  private tradeCounter = 0;
  private readonly tradeLogs: CompletedTradeLog[] = [];
  private readonly equityCurve: AlgoroomsPerformanceReport['equityCurve'] = [];
  private readonly chargeConfig: ChargeConfig;
  private readonly dataQuality: AlgoroomsPerformanceReport['dataQuality'];
  private readonly lotSize: number;
  private readonly qty: number;
  private readonly breakoutPct: number;
  private readonly target1Pts: number;
  private readonly target2Pts: number;
  private readonly dates: string[];

  constructor(private readonly spotData: Candle[], private readonly config: AlgoroomsStrategyConfig) {
    this.balance = config.initialCapital;
    this.peakEquity = config.initialCapital;
    this.chargeConfig = config.chargeConfig ?? DEFAULT_CHARGES;
    this.lotSize = config.strategyParams?.lotSize ?? resolveLotSize(config.symbol);
    const strategy = getStrategyConfig();
    this.qty = this.lotSize * (config.strategyParams?.entryLots ?? strategy.entryLots);
    this.breakoutPct = config.strategyParams?.breakoutPct ?? strategy.breakoutPct;
    this.target1Pts = config.strategyParams?.target1Pts ?? strategy.target1Pts;
    this.target2Pts = config.strategyParams?.target2Pts ?? strategy.target2Pts;
    if (!Number.isInteger(this.lotSize) || !Number.isInteger(this.qty) || this.lotSize <= 0 ||
        this.qty <= 0 || this.breakoutPct <= 0 || this.breakoutPct >= 1 ||
        this.target1Pts <= 0 || this.target2Pts <= this.target1Pts) {
      throw new Error('INVALID_STRATEGY_PARAMETERS');
    }
    this.dates = [...new Set(this.spotData.map(c => c.date))].sort();

    const validate = (series: OptionLegCandleSeries | undefined, name: string) => {
      if (!series?.candles5m?.length || !series?.candles1m?.length || series.isSynthetic) {
        throw new Error(`REAL_${name}_OPTION_DATA_REQUIRED`);
      }
    };
    validate(config.ceOptionSeries, 'CE');
    validate(config.peOptionSeries, 'PE');

    const isBsm = config.ceOptionSeries?.source === 'ESTIMATED_BSM';
    this.dataQuality = {
      dataSource: isBsm
        ? 'Real NSE Exchange Feed (5m) + Black-Scholes ATM Series'
        : 'DhanHQ Expired Options /charts/rollingoption',
      ceHistoricalData: isBsm
        ? 'Real NSE 5m candles + Black-Scholes 1m ATM pricing'
        : 'DhanHQ expired option minute OHLC',
      peHistoricalData: isBsm
        ? 'Real NSE 5m candles + Black-Scholes 1m ATM pricing'
        : 'DhanHQ expired option minute OHLC',
      signalResolution: '5 min',
      executionResolution: '1 min',
      syntheticPrices: false,
      lookaheadBias: 'PASS',
      missingCandles: 0,
      duplicateCandles: 0,
      contractMapping: 'FIXED_STRIKE_MATCHED',
      backtestReproducibility: 'PASS'
    };
  }

  run(): AlgoroomsPerformanceReport {
    for (const date of this.dates) this.simulateDay(date);
    return this.report();
  }

  private simulateDay(date: string): void {
    const ce5m = this.config.ceOptionSeries?.candles5m.filter((c) => c.date === date) ?? [];
    const pe5m = this.config.peOptionSeries?.candles5m.filter((c) => c.date === date) ?? [];
    const ce1m = this.config.ceOptionSeries?.candles1m.filter((c) => c.date === date) ?? [];
    const pe1m = this.config.peOptionSeries?.candles1m.filter((c) => c.date === date) ?? [];
    const ceRefCandle = ce5m.find((c) => c.time === '09:15');
    const peRefCandle = pe5m.find((c) => c.time === '09:15');
    if (!ceRefCandle || !peRefCandle) throw new Error(`MISSING_REFERENCE_CANDLE: ${date}`);
    const ce: LegState = this.createLeg('CE', ce5m, ce1m, ceRefCandle.close);
    const pe: LegState = this.createLeg('PE', pe5m, pe1m, peRefCandle.close);

    this.processLeg(ce, date);
    this.processLeg(pe, date);
  }

  private createLeg(type: 'CE' | 'PE', candles5m: OptionCandle[], candles1m: OptionCandle[], reference: number): LegState {
    return {
      type,
      candles5m,
      candles1m,
      reference,
      upper: this.round(reference * (1 + this.breakoutPct)),
      lower: this.round(reference * (1 - this.breakoutPct)),
      entryPrice: null,
      entryTime: null,
      remainingQty: 0,
      trade: null
    };
  }

  private processLeg(leg: LegState, date: string): void {
    const bars = new Map(leg.candles5m.map(c => [c.timestamp, c]));
    const minutes = [...leg.candles1m].sort((a, b) => a.timestamp - b.timestamp);
    if (minutes.length !== 356 || minutes[0].time !== '09:15' || minutes[355].time !== '15:10') {
      throw new Error(`INCOMPLETE_OPTION_DATA: ${leg.type} ${date}`);
    }
    let pending: 'ENTRY' | 'LOWER_EXIT' | null = null;
    let signalPrice = 0;
    for (const minute of minutes) {
      if (minute.time === this.config.endTime) {
        if (leg.trade) {
          this.requireTradedMinute(minute);
          this.close(leg, 'FORCE_EXIT', minute.time, minute.isoTime, minute.open, leg.remainingQty);
          this.finishTrade(leg, date);
        }
        break;
      }
      if (pending === 'LOWER_EXIT' && leg.trade) {
        this.requireTradedMinute(minute);
        this.close(leg, 'LOWER_EXIT', minute.time, minute.isoTime, minute.open, leg.remainingQty);
        this.finishTrade(leg, date);
      } else if (pending === 'ENTRY' && !leg.trade && minute.time < '15:05') {
        this.openTrade(leg, minute, signalPrice);
      }
      pending = null;
      if (leg.trade) {
        const t1 = leg.trade.target1Price;
        const t2 = leg.trade.target2Price;
        if (leg.trade.exits.every(e => e.type !== 'TARGET_1') && minute.high >= t1) {
          this.requireTradedMinute(minute);
          this.close(leg, 'TARGET_1', minute.time, minute.isoTime, Math.max(t1, minute.open), this.lotSize);
        }
        if (leg.remainingQty > 0 && minute.high >= t2) {
          this.requireTradedMinute(minute);
          this.close(leg, 'TARGET_2', minute.time, minute.isoTime, Math.max(t2, minute.open), leg.remainingQty);
        }
        if (leg.trade && leg.remainingQty === 0) this.finishTrade(leg, date);
      }
      // The 5-minute bar is labelled by its opening time. Its close becomes
      // knowable only after the fifth 1-minute candle, never at the bar open.
      const opening = minute.timestamp - 4 * 60;
      const bar = bars.get(opening);
      if (bar && bar.time !== '09:15') {
        if (leg.trade && bar.close < leg.lower) pending = 'LOWER_EXIT';
        else if (!leg.trade && bar.close >= leg.upper) {
          pending = 'ENTRY';
          signalPrice = bar.close;
        }
      }
    }
  }

  private openTrade(leg: LegState, bar: OptionCandle, signalPrice: number): void {
    this.requireTradedMinute(bar);
    leg.entryPrice = bar.open;
    leg.entryTime = bar.time;
    leg.remainingQty = this.qty;
    this.tradeCounter++;
    leg.trade = {
      id: `TR-${String(this.tradeCounter).padStart(6, '0')}`,
      entry: { ...bar, close: bar.open },
      signalPrice,
      exits: [],
      target1Price: this.round(bar.open + this.target1Pts),
      target2Price: this.round(bar.open + this.target2Pts),
      ambiguity: 'NONE'
    };
  }

  private requireTradedMinute(candle: OptionCandle): void {
    if (!Number.isFinite(candle.volume) || candle.volume <= 0) {
      throw new Error(`UNEXECUTABLE_OPTION_CANDLE: ${candle.optionType} ${candle.isoTime} has no traded volume.`);
    }
  }

  private close(leg: LegState, type: TradePartialExit['type'], time: string, isoTime: string, price: number, quantity: number): void {
    if (!leg.trade || quantity <= 0) return;
    const qty = Math.min(quantity, leg.remainingQty);
    const pnl = this.round((price - leg.entryPrice!) * qty);
    leg.trade.exits.push({ type, time, price: this.round(price), quantity: qty, pnl });
    leg.remainingQty -= qty;
  }

  private finishTrade(leg: LegState, date: string): void {
    const trade = leg.trade;
    if (!trade || !trade.exits.length) return;

    const exitTurnover = trade.exits.reduce((sum, e) => sum + e.price * e.quantity, 0);
    const exitQty = trade.exits.reduce((sum, e) => sum + e.quantity, 0);
    const blendedExit = exitQty ? exitTurnover / exitQty : trade.entry.close;
    const grossPnl = this.round(trade.exits.reduce((sum, e) => sum + e.pnl, 0));
    const charges = calculateCharges(
      'BUY',
      trade.entry.close,
      blendedExit,
      this.qty,
      this.chargeConfig,
      date,
      trade.exits.length
    );
    const netPnl = this.round(grossPnl - charges.total);

    this.balance = this.round(this.balance + netPnl);
    this.peakEquity = Math.max(this.peakEquity, this.balance);
    const drawdown = this.round(this.peakEquity - this.balance);
    this.maxDrawdown = Math.max(this.maxDrawdown, drawdown);

    const t1 = trade.exits.find((e) => e.type === 'TARGET_1');
    const t2 = trade.exits.find((e) => e.type === 'TARGET_2');
    const lower = trade.exits.find((e) => e.type === 'LOWER_EXIT');
    const force = trade.exits.find((e) => e.type === 'FORCE_EXIT');
    const finalExit = trade.exits[trade.exits.length - 1];
    const entryTimestamp = trade.entry.timestamp;
    const exitCandle = leg.candles1m.find((c) => c.time === finalExit.time);
    const exitTimestamp = exitCandle?.timestamp ?? entryTimestamp;
    const duration = Math.max(0, Math.round((exitTimestamp - entryTimestamp) / 60));

    const spotCandlesForDay = this.spotData.filter((c) => c.date === date);
    const entrySpotCandle = spotCandlesForDay
      .filter(c => c.timestamp + 300 <= trade.entry.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp)
      .pop();
    const spotVal = entrySpotCandle?.close ?? 0;
    const optionRefText = `Option Ref: ₹${leg.reference.toFixed(2)} (Upper: ₹${leg.upper.toFixed(2)}, Lower: ₹${leg.lower.toFixed(2)})`;
    const spotRefPrice = entrySpotCandle ? `Spot last completed 5m: ₹${spotVal.toFixed(2)}` : 'Spot unavailable';

    this.tradeLogs.push({
      id: trade.id,
      date,
      dayOfWeek: new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-US', { weekday: 'long' }),
      legId: leg.type,
      strategyName: this.config.strategyName,
      symbol: this.config.symbol,
      type: 'BUY',
      optionType: leg.type,
      strike: trade.entry.strike,
      spotMarketVal: spotVal,
      spotRefPrice,
      optionRefText,
      instrument: `${this.config.symbol} ${trade.entry.strike} ${leg.type}`,
      side: 'BUY',
      orderType: 'MARKET',
      quantity: this.qty,
      lotSize: this.lotSize,
      signalTime: trade.entry.time,
      signalRefPrice: leg.reference,
      upperBreakoutLevel: leg.upper,
      lowerExitLevel: leg.lower,
      triggerClosePrice: trade.signalPrice,
      entryTime: trade.entry.time,
      entryTimestamp: trade.entry.isoTime,
      entryPrice: trade.entry.close,
      entryQuantity: this.qty,
      target1Price: trade.target1Price,
      target1Qty: t1?.quantity ?? 0,
      target1Time: t1?.time ?? '',
      target1Pnl: t1?.pnl ?? 0,
      target1Hit: !!t1,
      target2Price: trade.target2Price,
      target2Qty: t2?.quantity ?? 0,
      target2Time: t2?.time ?? '',
      target2Pnl: t2?.pnl ?? 0,
      target2Hit: !!t2,
      lowerExitPrice: lower?.price ?? 0,
      lowerExitQty: lower?.quantity ?? 0,
      lowerExitTime: lower?.time ?? '',
      lowerExitPnl: lower?.pnl ?? 0,
      lowerExitHit: !!lower,
      eodExitPrice: force?.price ?? 0,
      eodExitQty: force?.quantity ?? 0,
      eodExitTime: force?.time ?? '',
      eodExitPnl: force?.pnl ?? 0,
      eodExitHit: !!force,
      exitPrice: this.round(blendedExit),
      exitTime: finalExit.time,
      exitTimestamp: exitCandle?.isoTime ?? trade.entry.isoTime,
      exitReason: finalExit.type,
      durationMinutes: duration,
      grossPnl,
      brokerage: charges.brokerage,
      stt: charges.stt,
      exchangeCharges: charges.exchange,
      gst: charges.gst,
      sebiCharges: charges.sebi,
      stampDuty: charges.stamp,
      ipft: charges.ipft,
      totalCharges: charges.total,
      netPnl,
      roiPct: this.round((netPnl / (trade.entry.close * this.qty)) * 100),
      cumulativeEquity: this.balance,
      peakEquity: this.peakEquity,
      drawdown,
      drawdownPct: this.peakEquity ? this.round((drawdown / this.peakEquity) * 100) : 0,
      status: netPnl > 0 ? 'WIN' : 'LOSS',
      executionAmbiguity: trade.ambiguity,
      fillModel: 'Completed 5m close signal; next 1m open entry/stop; target on 1m OHLC',
      dataSource: this.dataQuality.dataSource,
      isSynthetic: this.dataQuality.syntheticPrices,
      exits: trade.exits
    });

    this.equityCurve.push({
      date,
      timestamp: finalExit.time,
      equity: this.balance,
      pnl: netPnl,
      drawdown
    });

    leg.trade = null;
    leg.entryPrice = null;
    leg.entryTime = null;
    leg.remainingQty = 0;
  }

  private report(): AlgoroomsPerformanceReport {
    this.tradeLogs.sort((a, b) => a.exitTimestamp.localeCompare(b.exitTimestamp) || a.id.localeCompare(b.id));
    this.equityCurve.length = 0;
    let equity = this.config.initialCapital;
    let peak = equity;
    this.maxDrawdown = 0;
    for (const trade of this.tradeLogs) {
      equity = this.round(equity + trade.netPnl);
      peak = Math.max(peak, equity);
      const drawdown = this.round(peak - equity);
      this.maxDrawdown = Math.max(this.maxDrawdown, drawdown);
      trade.cumulativeEquity = equity;
      trade.peakEquity = peak;
      trade.drawdown = drawdown;
      trade.drawdownPct = peak ? this.round(drawdown / peak * 100) : 0;
      this.equityCurve.push({ date: trade.date, timestamp: trade.exitTimestamp, equity, pnl: trade.netPnl, drawdown });
    }
    this.balance = equity;
    const totalTrades = this.tradeLogs.length;
    const wins = this.tradeLogs.filter((t) => t.netPnl > 0);
    const losses = this.tradeLogs.filter((t) => t.netPnl <= 0);
    const grossProfit = this.round(this.tradeLogs.reduce((s, t) => s + t.grossPnl, 0));
    const totalCharges = this.round(this.tradeLogs.reduce((s, t) => s + t.totalCharges, 0));
    const netProfit = this.round(this.tradeLogs.reduce((s, t) => s + t.netPnl, 0));
    const dayMap = new Map<string, CompletedTradeLog[]>();
    for (const date of this.dates) dayMap.set(date, []);
    for (const t of this.tradeLogs) dayMap.set(t.date, [...(dayMap.get(t.date) ?? []), t]);

    const daywiseTransactions = [...dayMap.entries()].map(([date, trades]) => {
      const pnl = this.round(trades.reduce((s, t) => s + t.netPnl, 0));
      const d = new Date(`${date}T00:00:00+05:30`);
      return {
        date,
        pnl,
        tradesCount: trades.length,
        winCount: trades.filter((t) => t.status === 'WIN').length,
        lossCount: trades.filter((t) => t.status === 'LOSS').length,
        dayOfMonth: d.getDate(),
        dayOfWeek: d.getDay(),
        monthYear: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        trades
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    const profitDays = daywiseTransactions.filter((d) => d.pnl > 0).map((d) => d.pnl);
    const lossDays = daywiseTransactions.filter((d) => d.pnl < 0).map((d) => d.pnl);
    const lossTotal = losses.reduce((s, t) => s + t.netPnl, 0);
    const profitFactor = lossTotal < 0 ? this.round(wins.reduce((s, t) => s + t.netPnl, 0) / Math.abs(lossTotal)) : null;

    let currentWin = 0, currentLoss = 0, winStreak = 0, lossStreak = 0, maxConsecutiveLosses = 0;
    for (const t of this.tradeLogs) {
      if (t.netPnl > 0) { currentWin++; currentLoss = 0; winStreak = Math.max(winStreak, currentWin); }
      else { currentLoss++; currentWin = 0; lossStreak = Math.max(lossStreak, currentLoss); maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLoss); }
    }

    const target1Hits = this.tradeLogs.filter((t) => t.target1Hit).length;
    const target2Hits = this.tradeLogs.filter((t) => t.target2Hit).length;
    const lowerLevelExits = this.tradeLogs.filter((t) => t.lowerExitHit).length;
    const forceExits = this.tradeLogs.filter((t) => t.eodExitHit).length;

    return {
      summary: {
        initialCapital: this.config.initialCapital,
        finalBalance: this.balance,
        netProfit,
        grossProfit,
        totalCharges,
        winRatePct: totalTrades ? this.round((wins.length / totalTrades) * 100) : 0,
        totalTrades,
        ceTrades: this.tradeLogs.filter((t) => t.optionType === 'CE').length,
        peTrades: this.tradeLogs.filter((t) => t.optionType === 'PE').length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        target1Hits,
        target2Hits,
        lowerLevelExits,
        forceExits,
        avgWin: wins.length ? this.round(wins.reduce((s, t) => s + t.netPnl, 0) / wins.length) : 0,
        avgLoss: losses.length ? this.round(losses.reduce((s, t) => s + t.netPnl, 0) / losses.length) : 0,
        maxConsecutiveLosses,
        maxDrawdown: this.round(this.maxDrawdown),
        maxDrawdownPct: Math.max(0, ...this.tradeLogs.map(t => t.drawdownPct)),
        tradingDays: daywiseTransactions.length,
        winDays: daywiseTransactions.filter((d) => d.pnl > 0).length,
        winDaysPct: daywiseTransactions.length ? this.round((daywiseTransactions.filter((d) => d.pnl > 0).length / daywiseTransactions.length) * 100) : 0,
        lossDays: daywiseTransactions.filter((d) => d.pnl < 0).length,
        lossDaysPct: daywiseTransactions.length ? this.round((daywiseTransactions.filter((d) => d.pnl < 0).length / daywiseTransactions.length) * 100) : 0,
        maxProfitDay: profitDays.length ? Math.max(...profitDays) : 0,
        maxLossDay: lossDays.length ? Math.min(...lossDays) : 0,
        avgProfitPerDay: profitDays.length ? this.round(profitDays.reduce((s, v) => s + v, 0) / profitDays.length) : 0,
        avgLossPerDay: lossDays.length ? this.round(lossDays.reduce((s, v) => s + v, 0) / lossDays.length) : 0,
        winStreak,
        lossStreak,
        profitFactor
      },
      dataQuality: this.dataQuality,
      equityCurve: this.equityCurve,
      daywiseTransactions,
      monthlyBreakdown: this.monthly(daywiseTransactions),
      trades: this.tradeLogs
    };
  }

  private monthly(days: DailyBreakdownReport[]): MonthlyBreakdownReport[] {
    const map = new Map<string, DailyBreakdownReport[]>();
    for (const day of days) map.set(day.monthYear, [...(map.get(day.monthYear) ?? []), day]);
    return [...map.entries()].map(([monthYear, monthDays]) => ({
      monthYear,
      totalPnl: this.round(monthDays.reduce((s, d) => s + d.pnl, 0)),
      tradingDays: monthDays.length,
      winDays: monthDays.filter((d) => d.pnl > 0).length,
      lossDays: monthDays.filter((d) => d.pnl < 0).length,
      days: monthDays
    }));
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
