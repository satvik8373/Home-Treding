import { signFor, referenceStop, isBeyondEntry, entryTransaction, exitTransaction } from '../../shared/strategy.ts'
import { levels } from '../strategy.ts'
import { targetPrice, targetDeadline } from '../../shared/targets.ts'
import type { BacktestCycle, BacktestDataset, BacktestDay, BacktestOptions, BacktestReport, EquityPoint } from '../../shared/backtest.ts'
import type { Reason, Side } from '../../shared/model.ts'
import { RULES } from '../../shared/model.ts'
import { istTime } from '../time.ts'
import { DEFAULT_SETTINGS } from '../../shared/settings.ts'

export const ENGINE = 'nifty-009-ohlc-v7'
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const sides: Side[] = ['CE', 'PE']
export const ASSUMPTIONS = [
  'Buy enters on an upper breakout and exits on a lower close; Sell enters on a lower breakout and covers on an upper close. Price targets and reference stops mirror direction. Closed-candle entry and close-exit signals execute at the next available candle open. Signal-candle highs never fill a new position.',
  'Time targets are sequential (T1 before T2), measured from the original entry or fixed IST clock. They execute at the first available five-minute candle open at/after the deadline, regardless of P&L; exact minute/tick execution is not modelled.',
  'Targets use observed opens for gaps and target-price proxies for intrabar touches, with adverse slippage. Intrabar timestamps are unknown and marked explicitly.',
  'The 15:10 square-off uses the 15:10 candle open. If that candle is unavailable, the session remains partial; no closing price is invented.',
  'CALL and PUT use independent positions, original session contracts and historical lot sizes. All simulated orders fill in full; liquidity, latency, margin and partial fills are not modelled.',
  'Costs are a fixed estimate per simulated order. Zero costs exclude brokerage and taxes. Drawdown uses synchronized candle-close marks, not the unknown intrabar path.',
  'Imported contracts are user-supplied. Missing option data is never replaced by NIFTY spot prices or current expiry contracts.',
  'References stay fixed all day. Buy re-entry needs a post-exit close below the original upper breakout, then a later close above it. Sell needs a post-exit close above the original lower breakout, then a later close below it. An intrabar-unknown exit cannot use that same bar as its reset.',
  'When enabled, the premium stop exits at the fixed 09:15–09:20 option reference close minus the configured points for Buy, plus those points for Sell. Gaps fill at the observed open with slippage. After open-price targets, ambiguous intrabar stop/target touches assume stop first; OHLC cannot establish tick order.',
]
type Position = { average: number; quantity: number; firstTarget: boolean; cycle: BacktestCycle }

/** Standalone deterministic OHLC engine. No live strategy/session/broker objects. */
export function replay(data: BacktestDataset, config: BacktestOptions): BacktestDay {
  const settings = config.strategySettings ?? DEFAULT_SETTINGS, sign = signFor(settings)
  const cutoff = istTime(data.date, settings.cutoff)
  const maps = { CE: new Map(data.candles.CE.map(bar => [bar.start, bar])), PE: new Map(data.candles.PE.map(bar => [bar.start, bar])) }
  const complete = sides.every(side => maps[side].has(cutoff))
  const asOf = Math.min(cutoff, ...sides.map(side => data.candles[side].at(-1)!.end))
  const reference = Object.fromEntries(sides.map(side => {
    const close = data.candles[side][0].close
    return [side, { close, ...levels(close, settings) }]
  })) as BacktestDay['reference']
  const result: BacktestDay = { date: data.date, source: data.source, contractSource: data.contractSource, status: complete ? 'complete' : 'partial', asOf,
    atm: data.contracts.CE.strike, expiry: data.contracts.CE.expiry, lotSize: data.contracts.CE.lotSize, reference,
    fills: [], cycles: [], equity: [{ at: istTime(data.date, RULES.referenceEnd), netPnl: 0 }], grossPnl: 0, fees: 0, netRealizedPnl: 0, openPnl: 0, markedNetPnl: 0, maxDrawdown: 0 }
  const positions: Partial<Record<Side, Position>> = {}, pending: Partial<Record<Side, 'BREAKOUT' | 'LOWER_CLOSE' | 'UPPER_CLOSE'>> = {}, entries: Record<Side, number> = { CE: 0, PE: 0 }
  const reentryReady: Record<Side, boolean> = { CE: false, PE: false }, lastExitAt: Partial<Record<Side, number>> = {}
  let peak = 0
  function execute(side: Side, reason: Reason, market: number, at: number, timing: NonNullable<BacktestDay['fills'][number]['timing']>) {
    const entering = reason === 'BREAKOUT', contract = data.contracts[side], position = positions[side]
    const transaction = entering ? entryTransaction(settings) : exitTransaction(settings), buy = transaction === 'BUY'
    if (entering && position || !entering && !position) throw new Error('Invalid backtest position transition.')
    const quantity = entering ? contract.lotSize * settings.entryLots : reason === 'TARGET_1' ? contract.lotSize * settings.target1Lots : position!.quantity
    const price = round(Math.max(0.01, market + (buy ? config.slippagePoints : -config.slippagePoints)))
    const id = `V2-${data.date}-${side}-${result.fills.length + 1}`
    let cycle = position?.cycle
    if (entering) {
      cycle = { id, date: data.date, side, symbol: contract.symbol, entryAt: at, entryPrice: price, exitAt: null, quantity, remaining: quantity, grossPnl: 0, fees: 0, netPnl: 0 }
      result.cycles.push(cycle); entries[side]++; positions[side] = { average: price, quantity, firstTarget: settings.target1Lots === 0, cycle }
      reentryReady[side] = false
    }
    const grossPnl = entering ? null : round(sign * (price - position!.average) * quantity)
    result.fills.push({ id, cycleId: cycle!.id, at, side, symbol: contract.symbol, transaction, quantity, price, reason, fee: config.feePerOrder, grossPnl, timing })
    cycle!.fees = round(cycle!.fees + config.feePerOrder); cycle!.grossPnl = round(cycle!.grossPnl + (grossPnl ?? 0)); cycle!.netPnl = round(cycle!.grossPnl - cycle!.fees)
    result.grossPnl = round(result.grossPnl + (grossPnl ?? 0)); result.fees = round(result.fees + config.feePerOrder)
    if (!entering) {
      position!.quantity -= quantity; position!.firstTarget = true; cycle!.remaining = position!.quantity
      if (!position!.quantity) { cycle!.exitAt = at; delete positions[side]; lastExitAt[side] = at; reentryReady[side] = false }
    }
  }
  function mark(at: number, prices: Record<Side, number>) {
    result.openPnl = round(sides.reduce((sum, side) => { const p = positions[side]; return sum + (p ? sign * (prices[side] - p.average) * p.quantity : 0) }, 0))
    result.netRealizedPnl = round(result.grossPnl - result.fees); result.markedNetPnl = round(result.netRealizedPnl + result.openPnl)
    peak = Math.max(peak, result.markedNetPnl); result.maxDrawdown = round(Math.max(result.maxDrawdown, peak - result.markedNetPnl))
    if (result.equity.at(-1)?.at === at) result.equity.pop()
    result.equity.push({ at, netPnl: result.markedNetPnl })
  }
  for (const ce of data.candles.CE) {
    if (ce.start < istTime(data.date, RULES.referenceEnd) || ce.start > cutoff) continue
    const pe = maps.PE.get(ce.start)
    if (!pe || ce.end > asOf && ce.start !== cutoff) break
    const bars = { CE: ce, PE: pe }
    if (ce.start === cutoff) {
      if (!complete) break
      for (const side of sides) if (positions[side]) execute(side, 'SESSION_END', bars[side].open, cutoff, 'cutoff-open')
      mark(cutoff, { CE: ce.open, PE: pe.open }); break
    }
    for (const side of sides) {
      const bar = bars[side]
      if (pending[side]) { execute(side, pending[side]!, bar.open, bar.start, 'next-open'); delete pending[side] }
      const openingPosition = positions[side]
      if (openingPosition && (settings.stopLossPoints ?? 0) > 0 && sign * (bar.open - referenceStop(reference[side].close, settings)) <= 0) execute(side, 'STOP_LOSS', bar.open, bar.start, 'gap-open')
      // Known open-price target fills precede unknown intrabar movement.
      for (const target of ['TARGET_1', 'TARGET_2'] as const) {
        const p = positions[side]
        if (!p || target === 'TARGET_1' && p.firstTarget || target === 'TARGET_2' && !p.firstTarget) continue
        const level = targetPrice(settings, target === 'TARGET_1' ? 1 : 2, p.average)
        const deadline = targetDeadline(settings, target === 'TARGET_1' ? 1 : 2, p.cycle.entryAt, data.date)
        if (deadline != null && bar.start >= deadline) execute(side, target, bar.open, bar.start, 'scheduled-open')
        else if (level != null && sign * (bar.open - level) >= 0) execute(side, target, bar.open, bar.start, 'gap-open')
      }
      const remaining = positions[side]
      if (remaining && (settings.stopLossPoints ?? 0) > 0) {
        const stop = referenceStop(reference[side].close, settings)
        if (sign * ((sign > 0 ? bar.low : bar.high) - stop) <= 0) execute(side, 'STOP_LOSS', stop, bar.end, 'intrabar-unknown')
      }
      for (const target of ['TARGET_1', 'TARGET_2'] as const) {
        const p = positions[side]
        if (!p || target === 'TARGET_1' && p.firstTarget || target === 'TARGET_2' && !p.firstTarget) continue
        const level = targetPrice(settings, target === 'TARGET_1' ? 1 : 2, p.average)
        if (level != null && sign * ((sign > 0 ? bar.high : bar.low) - level) >= 0) execute(side, target, (sign > 0 ? Math.max(bar.open, level) : Math.min(bar.open, level)), sign * (bar.open - level) >= 0 ? bar.start : bar.end, sign * (bar.open - level) >= 0 ? 'gap-open' : 'intrabar-unknown')
      }
      if (bar.end < cutoff && bar.end >= istTime(data.date, RULES.firstSignal)) {
        if (!positions[side] && entries[side] > 0 && lastExitAt[side] != null && bar.end > lastExitAt[side]! && sign * (bar.close - (sign > 0 ? reference[side].upper : reference[side].lower)) < 0) reentryReady[side] = true
        if (positions[side] && (sign > 0 ? bar.close < reference[side].lower : bar.close > reference[side].upper)) pending[side] = sign > 0 ? 'LOWER_CLOSE' : 'UPPER_CLOSE'
        else if (!positions[side] && settings.enabledSides.includes(side) && (!settings.maxEntriesPerLeg || entries[side] < settings.maxEntriesPerLeg) && (entries[side] === 0 ? isBeyondEntry(bar.close, reference[side], settings, true) : reentryReady[side] && isBeyondEntry(bar.close, reference[side], settings))) pending[side] = 'BREAKOUT'
      }
    }
    mark(ce.end, { CE: ce.close, PE: pe.close })
  }
  return result
}

export function report(days: BacktestDay[], skipped: BacktestReport['skipped'], config: BacktestOptions, startDate: string, endDate: string, now: number): BacktestReport {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date)), closed = ordered.flatMap(day => day.cycles).filter(cycle => cycle.remaining === 0)
  const wins = closed.filter(cycle => cycle.netPnl > 0), losses = closed.filter(cycle => cycle.netPnl < 0)
  const sum = (key: 'grossPnl' | 'fees' | 'netRealizedPnl' | 'openPnl' | 'markedNetPnl') => round(ordered.reduce((total, day) => total + day[key], 0))
  const equity: EquityPoint[] = []
  let offset = 0, peak = 0, maxDrawdown = 0
  for (const day of ordered) {
    for (const point of day.equity) {
      const netPnl = round(offset + point.netPnl)
      equity.push({ at: point.at, netPnl }); peak = Math.max(peak, netPnl); maxDrawdown = Math.max(maxDrawdown, peak - netPnl)
    }
    offset = round(offset + day.markedNetPnl)
  }
  const losing = Math.abs(losses.reduce((total, cycle) => total + cycle.netPnl, 0))
  return { engine: ENGINE, startDate, endDate, options: config, generatedAt: now, days: ordered, skipped, equity, assumptions: [...ASSUMPTIONS.filter(text => !text.startsWith('The 15:10')), `Square-off uses the ${(config.strategySettings ?? DEFAULT_SETTINGS).cutoff} candle open. Without that candle the session is partial.`],
    summary: { sessions: ordered.length, completeSessions: ordered.filter(day => day.status === 'complete').length, partialSessions: ordered.filter(day => day.status === 'partial').length,
      closedTrades: closed.length, openTrades: ordered.flatMap(day => day.cycles).length - closed.length, wins: wins.length, losses: losses.length,
      winRate: closed.length ? round(wins.length / closed.length * 100) : null, profitFactor: losing ? round(wins.reduce((total, cycle) => total + cycle.netPnl, 0) / losing) : null,
      orderCount: ordered.reduce((total, day) => total + day.fills.length, 0), grossPnl: sum('grossPnl'), fees: sum('fees'), netRealizedPnl: sum('netRealizedPnl'), openPnl: sum('openPnl'), markedNetPnl: sum('markedNetPnl'), maxDrawdown: round(maxDrawdown) } }
}
