import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, sameSettings, validateSettings, productFor } from '../shared/settings.ts'
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
  assert.equal(productFor(DEFAULT_SETTINGS), 'MIS')
  assert.equal(productFor(validateSettings({ ...DEFAULT_SETTINGS, product: 'NRML' })), 'NRML')
  assert.equal(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, product: 'MIS' }), true)
  assert.equal(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, product: 'NRML' }), false)
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, product: 'CNC' }), /NIFTY options/)
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS)
  assert.equal(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, target1Rule: { kind: 'points', value: 20 }, target2Rule: { kind: 'points', value: 40 } }), true)
  assert.equal(targetPrice(DEFAULT_SETTINGS, 1, 200), 220)
  for (const rule of [{ kind: 'percent', value: 0 }, { kind: 'price', value: NaN }, { kind: 'minutes', value: 1.5 }, { kind: 'clock', time: '' }, { kind: 'clock', time: '09:99' }, { kind: 'clock', time: '15:15' }, { kind: 'unknown', value: 5 }]) {
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
  assert.equal((html.match(/<option /g) ?? []).length, 6, 'two broker products and two Price/Time choices per target')
  assert.doesNotMatch(html, /Minutes after original entry/)
  assert.match(html, /Saved duration: 10 min after entry/)
  assert.equal((html.match(/type="time"/g) ?? []).length, 3, 'both targets use clock inputs, plus square-off')
  assert.match(html, /max="15:09"/)
  assert.match(html, /Exit time · IST/)
  assert.match(html, /Day Trade \(MIS\)/)
  assert.match(html, /Carry Forward \(NRML\)/)
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

function replayWith(one: TargetRule, two: TargetRule, overrides: Partial<StrategySettings> = {}) {
  const bars = Array.from({ length: 10 }, (_, i) => ({ start: istTime(DAY, '09:15') + i * 300_000, end: istTime(DAY, '09:20') + i * 300_000, open: i < 2 ? 100 : 105, high: 106, low: 100, close: i === 0 ? 100 : 105 }))
  const data = dataset({ version: 1, date: DAY, spotReferenceClose: 25000, contracts: { CE: contract('CE'), PE: contract('PE') }, candles: { CE: bars, PE: bars } }, istTime(DAY, '16:00'), 'import')
  return replay(data, { slippagePoints: 0, feePerOrder: 0, strategySettings: { ...DEFAULT_SETTINGS, enabledSides: ['CE'], maxEntriesPerLeg: 1, target1Rule: one, target2Rule: two, ...overrides } })
}

test('each target can be disabled independently in execution and backtests', async () => {
  for (const [one, two, expected] of [[false, false, []], [false, true, ['TARGET_2']], [true, false, ['TARGET_1']], [true, true, ['TARGET_1', 'TARGET_2']]] as const) {
    const f = await fixture(); await f.start('paper')
    const s = f.controller.session!
    s.settings = validateSettings({ ...DEFAULT_SETTINGS, target1Enabled: one, target2Enabled: two })
    const entry = { id:'entry', tag:'entry', side:'CE' as const, symbol:contract('CE').symbol, transaction:'BUY' as const, quantity:260, reason:'BREAKOUT' as const, submittedAt:f.now() }
    applyFill(s,entry,{orderId:'test',quantity:260,average:100,status:'COMPLETE'},f.now())
    assert.equal(targetSignal(s.legs.CE!,145,s.settings,f.now()), expected[0] ?? null)
    assert.equal(targetPrice(s.settings,1,100),one ? 120 : null)
    assert.equal(targetPrice(s.settings,2,100),two ? 140 : null)
    const html = renderToStaticMarkup(createElement(StrategySettingsPanel,{saved:s.settings,effective:s.settings,active:false,online:true,working:'',action:async()=>null}))
    assert.match(html,/Enable Target 1/); assert.match(html,/Enable Target 2/)
    assert.equal((html.match(/<fieldset disabled=""/g) ?? []).length,Number(!one)+Number(!two))
    const replayed = replayWith({kind:'clock',time:'09:30'},{kind:'clock',time:'09:35'},{target1Enabled:one,target2Enabled:two})
    assert.deepEqual(replayed.fills.filter(fill=>fill.reason.startsWith('TARGET')).map(fill=>fill.reason),[...expected])
    if (!one && two) assert.equal(replayed.fills.find(fill=>fill.reason==='TARGET_2')!.quantity,260)
  }
})

test('no-target mode preserves regular exits and closes at the configured 15:15 cutoff', async () => {
  const f = await fixture(); await f.start('paper')
  const s = f.controller.session!
  s.settings = validateSettings({...DEFAULT_SETTINGS,target1Enabled:false,target2Enabled:false,cutoff:'15:15'})
  assert.equal(s.settings.cutoff,'15:15')
  applyFill(s,{id:'entry',tag:'entry',side:'CE',symbol:contract('CE').symbol,transaction:'BUY',quantity:260,reason:'BREAKOUT',submittedAt:f.now()},{orderId:'test',quantity:260,average:100,status:'COMPLETE'},f.now())
  f.setTime(istTime(DAY,'15:10'));f.mark('CE',150);await f.controller.pump()
  assert.equal(s.legs.CE!.position!.quantity,260)
  f.setTime(istTime(DAY,'15:15'));f.mark('CE',150);await f.controller.pump()
  assert.equal(s.status,'stopped');assert.equal(s.trades.at(-1)!.reason,'SESSION_END')
  const l = {...s.legs.CE!,position:{average:100,quantity:260,entryQuantity:260,target1Remaining:0}}
  assert.equal(priceExitSignal(l,75,s.settings,f.now()),'STOP_LOSS')
})

test('both targets enabled keep normal exits before square-off, with the original 15:10 default', async () => {
  assert.equal(DEFAULT_SETTINGS.cutoff,'15:10')
  for (const direction of ['buy','sell','both'] as const) {
    const f = await fixture(); await f.start('paper')
    const s = f.controller.session!
    s.settings = {...DEFAULT_SETTINGS,direction,target1Enabled:true,target2Enabled:true}
    const short = direction === 'sell'
    applyFill(s,{id:'entry',tag:'entry',side:'CE',symbol:contract('CE').symbol,transaction:short?'SELL':'BUY',quantity:260,reason:'BREAKOUT',submittedAt:f.now()},{orderId:'test',quantity:260,average:100,status:'COMPLETE'},f.now())
    f.setTime(istTime(DAY,'09:30')); f.mark('CE',short?60:140)
    await f.controller.pump(); await f.controller.pump()
    assert.deepEqual(s.trades.map(trade=>trade.reason),['BREAKOUT','TARGET_1','TARGET_2'])
    assert.equal(s.legs.CE!.position,null)
    assert.equal(f.now(),istTime(DAY,'09:30'))
  }
})
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
