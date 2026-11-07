import { SlidersHorizontal, ArrowUpRight, Crosshair, ShieldCheck, RotateCcw, LockKeyhole, Check, Save } from 'lucide-react'
import { targetLabel, targetRule } from '../../shared/targets'
import type { TargetRule } from '../../shared/targets'
import { useState } from 'react'
import type { StrategySettings } from '../../shared/settings'
import { DEFAULT_SETTINGS, sameSettings, validateSettings } from '../../shared/settings'
import type { useDashboard } from '../hooks/useDashboard'

const numeric = [
  ['breakoutPercent', 'Breakout above reference · %', 0.01, 10, 0.01], ['exitPercent', 'Lower exit below reference · %', 0.01, 10, 0.01],
  ['entryLots', 'Entry lots', 1, 20, 1], ['target1Lots', 'Lots sold at target 1 · 0 skips T1', 0, 19, 1],
  ['stopLossPoints', 'Reference stop · points below opening close · 0 disables', 0, 2000, 0.05],
  ['maxEntriesPerLeg', 'Max entries per leg/session · 0 unlimited', 0, 100, 1], ['feePerOrderEstimate', 'Estimated charges · ₹ / filled order', 0, 1000, 0.01],
] as const
const formOf = (s: StrategySettings) => Object.fromEntries(numeric.map(([key]) => [key, String(s[key] ?? 0)])) as Record<typeof numeric[number][0], string>

export function StrategySettingsPanel({ saved, effective, active, hasSession = active, online, working, action }: {
  saved: StrategySettings; effective: StrategySettings; active: boolean; hasSession?: boolean; online: boolean; working: string; action: ReturnType<typeof useDashboard>['action'];
}) {
  const [form, setForm] = useState(() => formOf(saved)), [cutoff, setCutoff] = useState(saved.cutoff), [sides, setSides] = useState(saved.enabledSides)
  const [rules, setRules] = useState<[TargetRule, TargetRule]>(() => [targetRule(saved, 1), targetRule(saved, 2)])
  const [dirty, setDirty] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('')
  const shownRules: [TargetRule, TargetRule] = dirty ? rules : [targetRule(saved, 1), targetRule(saved, 2)]
  const [target2Draft, setTarget2Draft] = useState<string | null>(null)
  const shownForm = dirty ? form : formOf(saved), shownCutoff = dirty ? cutoff : saved.cutoff, shownSides = dirty ? sides : saved.enabledSides
  const modified = dirty && (JSON.stringify(shownRules) !== JSON.stringify([targetRule(saved, 1), targetRule(saved, 2)]) || numeric.some(([key]) => Number(shownForm[key]) !== saved[key]) || shownCutoff !== saved.cutoff || [...shownSides].sort().join() !== [...saved.enabledSides].sort().join())
  function edit(change: { form?: typeof form; cutoff?: string; sides?: StrategySettings['enabledSides']; rules?: [TargetRule, TargetRule] }) { setTarget2Draft(null); setRules(change.rules ?? shownRules); setDirty(true); setForm(change.form ?? shownForm); setCutoff(change.cutoff ?? shownCutoff); setSides(change.sides ?? shownSides); setError(''); setNote('') }
  const target2Lots = target2Draft ?? (shownForm.entryLots.trim() && shownForm.target1Lots.trim() ? String(Number(shownForm.entryLots) - Number(shownForm.target1Lots)) : '')
  const changed = !sameSettings(saved, effective)
  function reset() { setRules([targetRule(DEFAULT_SETTINGS, 1), targetRule(DEFAULT_SETTINGS, 2)]); setTarget2Draft(null); setDirty(true); setForm(formOf(DEFAULT_SETTINGS)); setCutoff(DEFAULT_SETTINGS.cutoff); setSides([...DEFAULT_SETTINGS.enabledSides]); setError(''); setNote('4-lot defaults loaded: target 1 sells 2 lots; target 2 sells the remaining 2. Save to apply.') }
  async function save() {
    setError(''); setNote('')
    try {
      if (numeric.some(([key]) => !shownForm[key].trim())) throw new Error('Complete every numeric field. Use 0 only where explicitly allowed.')
      if (!target2Lots.trim() || !Number.isInteger(Number(target2Lots)) || Number(target2Lots) < 1 || Number(shownForm.target1Lots) + Number(target2Lots) !== Number(shownForm.entryLots)) throw new Error('Target 1 lots + target 2 lots must equal entry lots, with at least 1 lot remaining for target 2.')
      const settings = validateSettings({ target1Points: saved.target1Points, target2Points: saved.target2Points, target1Rule: shownRules[0], target2Rule: shownRules[1], ...Object.fromEntries(numeric.map(([key]) => [key, Number(shownForm[key])])), cutoff: shownCutoff, enabledSides: shownSides })
      const result = await action('/api/strategy/settings', settings, 'save-settings')
      if (result) setNote('Saved. Current session rules are unchanged; new backtests use these settings; the saved day-session keeps its original rules until the next trading day.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save settings.') }
  }
  const disabled = !!working || !online
  function numberField(key: typeof numeric[number][0], label: string, hint: string, unit?: string) {
    const [, , min, max, step] = numeric.find(item => item[0] === key)!
    return <label className="setting-field"><span>{label}</span><div className="setting-input"><input type="number" min={min} max={max} step={step} value={shownForm[key]} disabled={disabled} onChange={event => edit({ form: { ...shownForm, [key]: event.target.value } })} required />{unit && <span>{unit}</span>}</div><small>{hint}</small></label>
  }
  function changeRule(index: number, rule: TargetRule) {
    edit({ rules: shownRules.map((r, i) => i === index ? rule : r) as [TargetRule, TargetRule] })
  }
  const allocationValid = Number(shownForm.target1Lots) >= 0 && Number(target2Lots) >= 1 && Number(shownForm.target1Lots) + Number(target2Lots) === Number(shownForm.entryLots)
  const previewSettings = { ...saved, target1Rule: shownRules[0], target2Rule: shownRules[1] }
  return <section className="strategy-settings" aria-labelledby="strategy-settings-title">
    <header className="settings-heading"><div><span className="settings-kicker">NIFTY 009 / CONFIGURATION</span><h2 id="strategy-settings-title">Strategy settings</h2><p>Set your entries, target exits and protection in one place.</p></div><span className="settings-status"><LockKeyhole size={13} />Applies next trading day</span></header>
    <form onSubmit={event => { event.preventDefault(); void save() }}>
      <div className="settings-layout"><div className="settings-main">
        <section className="settings-section" aria-labelledby="entry-settings-title">
          <div className="settings-section-heading"><span className="settings-section-icon"><ArrowUpRight size={18} /></span><div><h3 id="entry-settings-title">Entry setup</h3><p>Size and conditions for each new position.</p></div><span className="settings-section-number">01</span></div>
          <div className="settings-field-grid">
            {numberField('entryLots', 'Entry size', 'Lots bought per enabled leg.', 'lots')}
            {numberField('breakoutPercent', 'Breakout above reference', 'Uses the fixed opening option close.', '%')}
            <fieldset className="setting-legs"><legend>Trade legs</legend><div>{(['CE', 'PE'] as const).map(side => <label key={side}><input type="checkbox" checked={shownSides.includes(side)} disabled={disabled} onChange={event => edit({ sides: event.target.checked ? [...shownSides, side] : shownSides.filter(value => value !== side) })} /><span>{side === 'CE' ? 'Call' : 'Put'}<small>{side}</small></span></label>)}</div><small>Both legs use their own reference and position.</small></fieldset>
          </div>
        </section>
        <section className="settings-section" aria-labelledby="target-settings-title">
          <div className="settings-section-heading"><span className="settings-section-icon"><Crosshair size={18} /></span><div><h3 id="target-settings-title">Target exits</h3><p>Take the first exit, then close the remaining lots.</p></div><span className="settings-section-number">02</span></div>
          <div className="settings-target-grid">{shownRules.map((rule, index) => <fieldset className="settings-target" key={index}><legend><span>T{index + 1}</span>Target {index + 1}</legend>
            <label className="setting-field"><span>Exit by</span><select value={rule.kind === 'minutes' || rule.kind === 'clock' ? 'time' : 'price'} disabled={disabled} onChange={event => {
              const kind = event.target.value === 'time' ? 'minutes' : 'points'
              changeRule(index, { kind, value: kind === 'minutes' ? (index ? 20 : 10) : (index ? 40 : 20) })
            }}><option value="price">Price</option><option value="time">Time</option></select></label>
            <label className="setting-field"><span>{rule.kind === 'clock' ? 'Exit time · IST' : rule.kind === 'minutes' ? 'Minutes after original entry' : rule.kind === 'percent' ? 'Gain from entry · %' : rule.kind === 'price' ? 'Option premium · ₹' : 'Premium points above entry'}</span><div className="setting-input">{rule.kind === 'clock' ? <input type="time" min="09:20" max={shownCutoff} value={rule.time} disabled={disabled} onChange={event => changeRule(index, { kind: 'clock', time: event.target.value })} required /> : <input type="number" min={rule.kind === 'minutes' ? 1 : 0.01} max={rule.kind === 'minutes' ? 360 : rule.kind === 'percent' ? 1000 : 100000} step={rule.kind === 'minutes' ? 1 : 0.01} value={Number.isFinite(rule.value) ? rule.value : ''} disabled={disabled} onChange={event => changeRule(index, { ...rule, value: event.target.value === '' ? NaN : Number(event.target.value) })} required />}{rule.kind !== 'clock' && <span>{rule.kind === 'minutes' ? 'min' : rule.kind === 'percent' ? '%' : rule.kind === 'price' ? '₹' : 'pts'}</span>}</div></label>
            {index === 0 ? numberField('target1Lots', 'Sell quantity', 'Use 0 to skip the first target.', 'lots') : <label className="setting-field"><span>Sell quantity</span><div className="setting-input"><input type="number" min="1" max="20" step="1" value={target2Lots} disabled={disabled} onChange={event => {
              const value = event.target.value, remaining = Number(value), entry = Number(shownForm.entryLots)
              edit({ form: value.trim() && Number.isInteger(remaining) ? { ...shownForm, target1Lots: String(entry - remaining) } : shownForm }); setTarget2Draft(value)
            }} required /><span>lots</span></div><small>Adjusts T1 to keep your total allocation.</small></label>}
          </fieldset>)}</div>
          <p className="settings-footnote">Time exits count from the original entry and can close at a loss. T2 starts after T1 completes.</p>
        </section>
        <section className="settings-section" aria-labelledby="protection-settings-title">
          <div className="settings-section-heading"><span className="settings-section-icon"><ShieldCheck size={18} /></span><div><h3 id="protection-settings-title">Protection & session</h3><p>Keep exits and the trading window under control.</p></div><span className="settings-section-number">03</span></div>
          <div className="settings-field-grid">
            {numberField('stopLossPoints', 'Reference stop', 'Points below opening close. 0 disables this stop.', 'pts')}
            {numberField('exitPercent', 'Lower candle-close exit', 'Exit below reference after a completed 5-minute candle.', '%')}
            <label className="setting-field"><span>Square-off time</span><div className="setting-input"><input type="time" min="09:30" max="15:25" step="300" value={shownCutoff} disabled={disabled} onChange={event => edit({ cutoff: event.target.value })} required /><span>IST</span></div><small>Close remaining positions and stop new entries.</small></label>
          </div>
        </section>
        <details className="settings-section settings-advanced"><summary><SlidersHorizontal size={16} /><span>Limits & cost estimates</span><small>Optional</small></summary><div className="settings-field-grid">
          {numberField('maxEntriesPerLeg', 'Entry limit per leg', '0 allows unlimited qualifying re-entries.', 'entries')}
          {numberField('feePerOrderEstimate', 'Estimated cost per filled order', 'Planning estimate; actual broker charges may differ.', '₹')}
        </div><button type="button" className="settings-reset" disabled={!!working} onClick={reset}><RotateCcw size={13} />Restore 4-lot defaults</button></details>
      </div>
      <aside className="settings-overview" aria-label="Configuration preview">
        <div className="settings-summary"><span className="settings-kicker">ORDER ALLOCATION</span><div className="settings-total">{shownForm.entryLots || '—'}<span>lots per leg</span></div><div className="settings-allocation"><div><span>Target 1</span><strong>{shownForm.target1Lots || '—'} <small>lots</small></strong></div><div><span>Target 2</span><strong>{target2Lots || '—'} <small>lots</small></strong></div></div>
          {!allocationValid && <p className="settings-allocation-error" role="status">Target lots must equal entry lots, with at least 1 lot for T2.</p>}
          <dl className="settings-preview"><div><dt>Enabled legs</dt><dd>{shownSides.length ? shownSides.join(' + ') : 'None selected'}</dd></div><div><dt>T1 trigger</dt><dd>{Number(shownForm.target1Lots) === 0 ? 'Skipped' : targetLabel(previewSettings, 1)}</dd></div><div><dt>T2 trigger</dt><dd>{targetLabel(previewSettings, 2)}</dd></div><div><dt>Square-off</dt><dd>{shownCutoff || '—'} IST</dd></div></dl>
        </div>
        <div className="settings-session-note"><LockKeyhole size={15} /><div><strong>{hasSession ? 'Your session keeps its rules' : 'Save now, start when ready'}</strong><p>{hasSession ? 'Saving prepares the next trading day. Today’s reference, positions and targets stay locked.' : 'Saving settings does not start trading. New backtests use your saved configuration.'}</p></div></div>
        {hasSession && <details className="settings-snapshot"><summary>View current session rules{changed && <span>Different from saved</span>}</summary><dl><div><dt>Entry</dt><dd>{effective.entryLots} lots</dd></div><div><dt>T1</dt><dd>{effective.target1Lots ? targetLabel(effective, 1) : 'Skipped'}</dd></div><div><dt>T2</dt><dd>{targetLabel(effective, 2)}</dd></div><div><dt>Square-off</dt><dd>{effective.cutoff} IST</dd></div></dl></details>}
      </aside></div>
      <div className="settings-savebar"><div className="settings-save-status">{!online ? <><span>Engine offline</span><small>Reconnect to save settings.</small></> : <><span>{modified ? 'Unsaved changes' : <><Check size={14} />Settings saved</>}</span><small>Applies next trading day · available immediately to new backtests</small></>}</div><div className="settings-save-actions"><button type="button" className="button secondary" disabled={!modified || !!working} onClick={() => { setDirty(false); setTarget2Draft(null); setError(''); setNote('') }}>Discard changes</button><button className="button primary" disabled={disabled || !modified}><Save size={14} />{working === 'save-settings' ? 'Saving…' : 'Save settings'}</button></div>{(error || note) && <p className={error ? 'settings-feedback settings-feedback-error' : 'settings-feedback'} role={error ? 'alert' : 'status'}>{error || note}</p>}</div>
    </form>
  </section>
}
