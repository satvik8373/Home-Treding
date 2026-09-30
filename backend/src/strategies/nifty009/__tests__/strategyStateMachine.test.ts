import assert from 'node:assert/strict';
import { StrategyStateMachine } from '../StrategyStateMachine';
import type { Candle } from '../CandleEngine';

const candle = (startTime: string, endTime: string, close: number): Candle => ({
  startTime, endTime, open: close, high: close, low: close, close, volume: 100,
  isClosed: true
});

const strategy = new StrategyStateMachine();
strategy.start('2026-09-22');
strategy.onAtmResolved({ atmStrike: 25000, expiry: '2026-09-22', ceSecurityId: '12345',
  ceSymbol: 'NIFTY 25000 CE', ceLtp: 100, peSecurityId: '12346', peSymbol: 'NIFTY 25000 PE',
  peLtp: 100, lotSize: 65, spotPriceAtResolution: 25000, resolvedAt: new Date().toISOString() });
strategy.setCeReferenceCandle(candle('2026-09-22T09:15:00+05:30', '2026-09-22T09:20:00+05:30', 100));
strategy.setPeReferenceCandle(candle('2026-09-22T09:15:00+05:30', '2026-09-22T09:20:00+05:30', 100));
assert.equal(strategy.getCeLevels().upperLevel, 100.9);
assert.equal(strategy.getPeLevels().lowerLevel, 99.1);

const ceSignal = strategy.onCeCandleClosed(candle('2026-09-22T09:20:00+05:30', '2026-09-22T09:25:00+05:30', 101));
assert.equal(ceSignal?.type, 'BUY_CE');
assert.equal(ceSignal?.quantity, 195);
strategy.onCePositionOpened({ leg: 'CE', symbol: 'NIFTY 25000 CE', securityId: '12345', strike: 25000,
  entryPrice: 102, quantity: 195, entryTime: '2026-09-22T09:25:00+05:30', currentLtp: 102,
  unrealizedPnl: 0, realizedPnl: 0, target1Price: 122, target2Price: 142, target1Hit: false });
const peSignal = strategy.onPeCandleClosed(candle('2026-09-22T09:20:00+05:30', '2026-09-22T09:25:00+05:30', 101));
assert.equal(peSignal?.type, 'BUY_PE');
assert.equal(strategy.getCeState(), 'LONG');

const lowerExit = strategy.onCeCandleClosed(candle('2026-09-22T09:25:00+05:30', '2026-09-22T09:30:00+05:30', 99));
assert.equal(lowerExit?.type, 'EXIT_CE');
assert.equal(lowerExit?.quantity, 195);
assert.equal(strategy.getPeState(), 'FLAT');
