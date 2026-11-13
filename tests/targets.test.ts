import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, sameSettings, validateSettings } from '../shared/settings.ts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StrategySettingsPanel } from '../src/components/StrategySettingsPanel.tsx'
import { targetPrice, targetDeadline } from '../shared/targets.ts'
import { applyFill, targetSignal, priceExitSignal } from '../server/strategy.ts'
import { replay } from '../server/backtest/replay.ts'
import { dataset } from '../server/backtest/validation.ts'
import { DAY, fixture, contract } from './helpers.ts'
import { istTime } from '../server/time.ts'
import type { StrategySettings } from '../shared/settings.ts'
import type { TargetRule } from '../shared/targets.ts'

test('target types validate and legacy settings keep point-based defaults', () => {
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS)
  assert.equal(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, target1Rule: { kind: 'points', value: 20 }, target2Rule: { kind: 'points', value: 40 } }), true)
  assert.equal(targetPrice(DEFAULT_SETTINGS, 1, 200), 220)
  for (const rule of [{ kind: 'percent', value: 0 }, { kind: 'price', value: NaN }, { kind: 'minutes', value: 1.5 }, { kind: 'clock', time: '' }, { kind: 'clock', time: '09:99' }, { kind: 'clock', time: '15:10' }, { kind: 'unknown', value: 5 }]) {
    assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, target1Rule: rule }))
  }
  for (const kind of ['minutes', 'percent', 'points', 'price']) assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, target1Rule: { kind, value: 20 }, target2Rule: { kind, value: 10 } }))
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, target1Rule: { kind: 'clock', time: '11:00' }, target2Rule: { kind: 'clock', time: '10:00' } }))
  assert.doesNotThrow(() => validateSettings({ ...DEFAULT_SETTINGS, target1Rule: { kind: 'minutes', value: 10 }, target2Rule: { kind: 'percent', value: 5 } }))
})

test('settings renders only Price and Time choices and saving preferences preserves the locked day snapshot', async () => {
  const f = await fixture(); await f.start('paper')
  const before = JSON.stringify(f.controller.session!.settings)
  const saved = f.controller.saveStrategySettings({ ...DEFAULT_SETTINGS, target1Rule: { kind: 'minutes', value: 10 }, target2Rule: { kind: 'clock', time: '11:00' } })
  assert.equal(JSON.stringify(f.controller.session!.settings), before)
  assert.deepEqual(f.store.get('strategy:settings'), saved)
  const html = renderToStaticMarkup(createElement(StrategySettingsPanel, { saved, effective: DEFAULT_SETTINGS, active: true, online: true, working: '', action: async () => null }))
  for (const kind of ['price', 'time']) assert.equal((html.match(new RegExp(`option value="${kind}"`, 'g')) ?? []).length, 2)
  assert.equal((html.match(/<option /g) ?? []).length, 4)
  assert.doesNotMatch(html, /Minutes after original entry/)
  assert.match(html, /Saved duration: 10 min after entry/)
  assert.equal((html.match(/type="time"/g) ?? []).length, 3, 'both targets use clock inputs, plus square-off')
  assert.match(html, /max="15:09"/)
  assert.match(html, /Exit time · IST/)
  assert.equal(f.broker.submitted.length, 0)
})

test('price targets support points, percentage and fixed premium; T2 cannot skip T1', async () => {
  const f = await fixture(); await f.start('paper')
  const l = f.controller.session!.legs.CE!
  l.position = { average: 200, quantity: 260, entryQuantity: 260, target1Remaining: 130, entryAt: f.now() }
  for (const [kind, value, expected] of [['points', 20, 220], ['percent', 20, 240], ['price', 260, 260]] as const) {
    const s = { ...DEFAULT_SETTINGS, target1Rule: { kind, value } }
    assert.equal(targetPrice(s, 1, 200), expected)
    assert.equal(targetSignal(l, expected - 0.01, s, f.now()), null)
    assert.equal(targetSignal(l, expected, s, f.now()), 'TARGET_1')
  }
  const s: StrategySettings = { ...DEFAULT_SETTINGS, target1Rule: { kind: 'minutes', value: 10 }, target2Rule: { kind: 'price', value: 190 } }
  assert.equal(targetSignal(l, 210, s, f.now()), null)
  l.position.target1Remaining = 0
  assert.equal(targetSignal(l, 210, s, f.now()), 'TARGET_2')
})

test('time exits use original entry, work at a loss, survive persistence and retain stop priority', async () => {
  const f = await fixture(); await f.start('paper')
  const session = f.controller.session!, entryAt = istTime(DAY, '09:25') + 1234
  session.settings = { ...DEFAULT_SETTINGS, target1Rule: { kind: 'minutes', value: 10 }, target2Rule: { kind: 'minutes', value: 20 } }
  applyFill(session, { id: 'buy', tag: 'tag', side: 'CE', symbol: contract('CE').symbol, transaction: 'BUY', quantity: 260, reason: 'BREAKOUT', submittedAt: entryAt - 100 }, { orderId: 'paper', status: 'COMPLETE', quantity: 260, average: 200 }, entryAt)
  const l = session.legs.CE!
  assert.equal(l.position!.entryAt, entryAt)
  assert.equal(targetSignal(l, 190, session.settings, entryAt + 600_000 - 1), null)
  assert.equal(targetSignal(l, 190, session.settings, entryAt + 600_000), 'TARGET_1')
  assert.equal(priceExitSignal(l, 75, session.settings, entryAt + 600_000), 'STOP_LOSS')
  l.position!.target1Remaining = 0
  const restored = JSON.parse(JSON.stringify(l))
  assert.equal(targetSignal(restored, 180, session.settings, entryAt + 1200_000), 'TARGET_2')
  assert.equal(targetPrice(session.settings, 2, 200), null)
  assert.equal(targetDeadline(session.settings, 2, entryAt, DAY), entryAt + 1200_000)
  assert.equal(targetDeadline(session.settings, 2, undefined, DAY), null, 'never invent missing entry time')
  const clock: StrategySettings = { ...DEFAULT_SETTINGS, target1Rule: { kind: 'clock', time: '10:30' } }
  l.position!.target1Remaining = 130
  assert.equal(targetSignal(l, 180, clock, istTime(DAY, '10:29')), null)
  assert.equal(targetSignal(l, 180, clock, istTime(DAY, '10:30')), 'TARGET_1')
})

function replayWith(one: TargetRule, two: TargetRule) {
  const bars = Array.from({ length: 10 }, (_, i) => ({ start: istTime(DAY, '09:15') + i * 300_000, end: istTime(DAY, '09:20') + i * 300_000, open: i < 2 ? 100 : 105, high: 106, low: 100, close: i === 0 ? 100 : 105 }))
  const data = dataset({ version: 1, date: DAY, spotReferenceClose: 25000, contracts: { CE: contract('CE'), PE: contract('PE') }, candles: { CE: bars, PE: bars } }, istTime(DAY, '16:00'), 'import')
  return replay(data, { slippagePoints: 0, feePerOrder: 0, strategySettings: { ...DEFAULT_SETTINGS, enabledSides: ['CE'], maxEntriesPerLeg: 1, target1Rule: one, target2Rule: two } })
}
test('backtest schedules elapsed/IST exits on next available candle open with a 2+2 lot split', () => {
  for (const [one, two] of [[{ kind: 'minutes', value: 7 }, { kind: 'minutes', value: 12 }], [{ kind: 'clock', time: '09:32' }, { kind: 'clock', time: '09:37' }]] as [TargetRule, TargetRule][]) {
    const day = replayWith(one, two)
    assert.deepEqual(day.fills.map(f => [f.reason, f.quantity, f.at]), [['BREAKOUT', 260, istTime(DAY, '09:25')], ['TARGET_1', 130, istTime(DAY, '09:35')], ['TARGET_2', 130, istTime(DAY, '09:40')]])
    assert.equal(day.fills[1].timing, 'scheduled-open')
  }
})

test('controller pump executes due time targets without requiring a new candle or a profitable price', async () => {
  const f = await fixture(); await f.start('paper')
  const s = f.controller.session!, entry = istTime(DAY, '09:25')
  s.settings = { ...DEFAULT_SETTINGS, target1Rule: { kind: 'minutes', value: 10 }, target2Rule: { kind: 'minutes', value: 20 } }
  applyFill(s, { id: 'buy', tag: 'buy', side: 'CE', symbol: contract('CE').symbol, transaction: 'BUY', quantity: 260, reason: 'BREAKOUT', submittedAt: entry }, { orderId: 'PAPER-test', quantity: 260, average: 200, status: 'COMPLETE' }, entry)
  for (const [time, quantity] of [['09:34', 260], ['09:35', 130], ['09:44', 130], ['09:45', 0]] as const) {
    f.setTime(istTime(DAY, time)); f.mark('CE', 190)
    await f.controller.pump()
    assert.equal(s.legs.CE!.position?.quantity ?? 0, quantity)
  }
  assert.deepEqual(s.trades.map(t => t.reason), ['BREAKOUT', 'TARGET_1', 'TARGET_2'])
  assert.equal(s.trades[1].pnl, -1300)
  assert.equal(f.broker.submitted.length, 0, 'Paper scheduling never sends a broker order')
})
