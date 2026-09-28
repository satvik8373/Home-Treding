import assert from 'node:assert/strict';
import { AlgoroomsStyleBacktester, AlgoroomsStrategyConfig } from '../AlgoroomsStyleBacktester';
import type { Candle, OptionCandle } from '../DhanHistoricalDataService';

const date = '2026-09-22';
const epoch = (time: string) => Date.parse(`${date}T${time}:00+05:30`) / 1000;
const timeAt = (i: number) => {
  const total = 9 * 60 + 15 + i;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function series(type: 'CE' | 'PE', mode: 'targets' | 'lower' | 'eod' | 'flat') {
  const minutes: OptionCandle[] = Array.from({ length: 356 }, (_, i) => {
    const time = timeAt(i);
    let open = 100, high = 100, low = 100, close = 100;
    if (type === 'CE' && mode !== 'flat') {
      if (i === 9) close = 102; // 09:20 bar closes at 09:25
      if (i === 10) { open = 105; high = 105; low = 100; close = 105; }
      if (mode === 'targets' && i === 11) { open = 110; high = 130; low = 108; close = 120; }
      if (mode === 'targets' && i === 12) { open = 120; high = 150; low = 119; close = 145; }
      if (mode === 'lower' && i === 19) { open = 100; high = 100; low = 90; close = 90; }
      if (mode === 'lower' && i === 20) { open = 88; high = 90; low = 85; close = 87; }
      if (mode === 'eod' && i === 355) { open = 108; high = 110; low = 105; close = 106; }
    }
    // Keep synthetic test OHLC internally consistent; these are fixtures, not production prices.
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);
    return { date, time, timestamp: epoch(time), isoTime: `${date}T${time}:00+05:30`,
      open, high, low, close, volume: 1000, strike: 24000, optionType: type };
  });
  const five: OptionCandle[] = [];
  for (let i = 0; i < 355; i += 5) {
    const slice = minutes.slice(i, i + 5);
    five.push({ ...slice[0], high: Math.max(...slice.map(c => c.high)),
      low: Math.min(...slice.map(c => c.low)), close: slice[4].close });
  }
  return { source: 'DHAN_EXPIRED_OPTIONS' as const, isSynthetic: false,
    candles1m: minutes, candles5m: five };
}

function run(mode: 'targets' | 'lower' | 'eod' | 'flat') {
  const spot: Candle[] = [{ date, time: '09:15', timestamp: epoch('09:15'),
    isoTime: `${date}T09:15:00+05:30`, open: 24000, high: 24000,
    low: 24000, close: 24000, volume: 1000 }];
  const config: AlgoroomsStrategyConfig = { strategyName: 'NIFTY ATM CE/PE', symbol: 'NIFTY 50',
    initialCapital: 100000, startTime: '09:20', endTime: '15:10',
    ceOptionSeries: series('CE', mode), peOptionSeries: series('PE', 'flat') };
  return new AlgoroomsStyleBacktester(spot, config).run();
}

const targets = run('targets');
assert.equal(targets.trades[0].entryTime, '09:25');
assert.equal(targets.trades[0].entryPrice, 105);
assert.equal(targets.trades[0].triggerClosePrice, 102);
assert.equal(targets.trades[0].target1Price, 125);
assert.equal(targets.trades[0].target2Price, 145);
assert.equal(targets.trades[0].target1Qty, 65);
assert.equal(targets.trades[0].target2Qty, 130);
assert.equal(targets.trades[0].grossPnl, 6500);
assert.equal(targets.summary.totalTrades, 1);
assert.equal(targets.summary.tradingDays, 1);
assert.equal(targets.summary.finalBalance, 100000 + targets.trades[0].netPnl);
assert.ok(targets.trades[0].totalCharges > 0);

const lower = run('lower');
assert.equal(lower.trades[0].exitReason, 'LOWER_EXIT');
assert.equal(lower.trades[0].exitTime, '09:35');
assert.equal(lower.trades[0].lowerExitPrice, 88);
assert.ok(lower.summary.maxDrawdown > 0);

const eod = run('eod');
assert.equal(eod.trades[0].exitReason, 'FORCE_EXIT');
assert.equal(eod.trades[0].exitTime, '15:10');
assert.equal(eod.trades[0].eodExitPrice, 108);

const flat = run('flat');
assert.equal(flat.summary.totalTrades, 0);
assert.equal(flat.summary.tradingDays, 1);
assert.equal(flat.daywiseTransactions[0].pnl, 0);

assert.throws(() => new AlgoroomsStyleBacktester([], {
  strategyName: 'bad', symbol: 'NIFTY 50', initialCapital: 100000,
  startTime: '09:20', endTime: '15:10',
  ceOptionSeries: { ...series('CE', 'flat'), isSynthetic: true },
  peOptionSeries: series('PE', 'flat')
}), /REAL_CE_OPTION_DATA_REQUIRED/);

const illiquidCe = series('CE', 'eod');
illiquidCe.candles1m[10].volume = 0;
const spot: Candle[] = [{ date, time: '09:15', timestamp: epoch('09:15'),
  isoTime: `${date}T09:15:00+05:30`, open: 24000, high: 24000,
  low: 24000, close: 24000, volume: 1000 }];
assert.throws(() => new AlgoroomsStyleBacktester(spot, {
  strategyName: 'NIFTY ATM CE/PE', symbol: 'NIFTY 50', initialCapital: 100000,
  startTime: '09:20', endTime: '15:10', ceOptionSeries: illiquidCe,
  peOptionSeries: series('PE', 'flat')
}).run(), /UNEXECUTABLE_OPTION_CANDLE/);

console.log('Backtest deterministic cases passed');
