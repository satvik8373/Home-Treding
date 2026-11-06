import { targetRule } from '../../shared/targets'
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

export function StrategySettingsPanel({ saved, effective, active, online, working, action }: {
  saved: StrategySettings; effective: StrategySettings; active: boolean; online: boolean; working: string; action: ReturnType<typeof useDashboard>['action'];
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
  return <section className="panel settings-panel"><div className="panel-title"><h2>Strategy settings</h2><span className="tag">NIFTY 009</span></div>
    <p className="audit-help">{active ? 'Current session is locked to its own rules. You can save changes for the next trading day.' : 'Saving does not start trading. Restart resumes the saved day-session. Setting changes apply when the next trading day starts.'}{changed ? ' Saved settings differ from the displayed session.' : ''}</p>
    <form onSubmit={event => { event.preventDefault(); void save() }}><div className="settings-fields">{numeric.map(([key, label, min, max, step]) => <label className="field" key={key}>{label}<input type="number" min={min} max={max} step={step} value={shownForm[key]} disabled={!!working || !online} onChange={event => edit({ form: { ...shownForm, [key]: event.target.value } })} required /></label> )}{shownRules.map((rule, index) => <fieldset className="target-settings" key={index}><legend>Target {index + 1} exit</legend><label className="field">Trigger type<select value={rule.kind} disabled={!!working || !online} onChange={event => {
      const kind = event.target.value as TargetRule['kind']
      const next: TargetRule = kind === 'clock' ? { kind, time: index ? '11:00' : '10:00' } : { kind, value: kind === 'minutes' ? (index ? 20 : 10) : kind === 'percent' ? (index ? 20 : 10) : kind === 'price' ? (index ? 140 : 120) : (index ? 40 : 20) }
      edit({ rules: shownRules.map((r, i) => i === index ? next : r) as [TargetRule, TargetRule] })
    }}><option value="points">Price · points above entry</option><option value="percent">Price · percentage above entry</option><option value="price">Price · fixed option premium</option><option value="minutes">Time · minutes after entry</option><option value="clock">Time · fixed IST clock</option></select></label><label className="field">{rule.kind === 'clock' ? 'Exit time · IST' : rule.kind === 'minutes' ? 'Minutes after original entry' : rule.kind === 'percent' ? 'Gain from entry · %' : rule.kind === 'price' ? 'Option premium · ₹' : 'Premium points above entry'}{rule.kind === 'clock' ? <input type="time" min="09:20" max={shownCutoff} value={rule.time} disabled={!!working || !online} onChange={event => edit({ rules: shownRules.map((r, i) => i === index ? { kind: 'clock', time: event.target.value } : r) as [TargetRule, TargetRule] })} required /> : <input type="number" min={rule.kind === 'minutes' ? 1 : 0.01} max={rule.kind === 'minutes' ? 360 : rule.kind === 'percent' ? 1000 : 100000} step={rule.kind === 'minutes' ? 1 : 0.01} value={Number.isFinite(rule.value) ? rule.value : ''} disabled={!!working || !online} onChange={event => edit({ rules: shownRules.map((r, i) => i === index ? { ...rule, value: event.target.value === '' ? NaN : Number(event.target.value) } : r) as [TargetRule, TargetRule] })} required />}</label></fieldset>)}<label className="field">Lots sold at target 2<input type="number" min="1" max="20" step="1" value={target2Lots} disabled={!!working || !online} onChange={event => {
      const value = event.target.value
      const remaining = Number(value), entry = Number(shownForm.entryLots)
      edit({ form: value.trim() && Number.isInteger(remaining) ? { ...shownForm, target1Lots: String(entry - remaining) } : shownForm })
      setTarget2Draft(value)
    }} required /><small>Changing target 2 adjusts target 1 to keep the total equal to entry lots.</small></label><label className="field">Square-off cutoff · IST<input type="time" min="09:30" max="15:25" step="300" value={shownCutoff} disabled={!!working || !online} onChange={event => edit({ cutoff: event.target.value })} required /></label><fieldset className="settings-legs"><legend>Allowed entry legs</legend>{(['CE', 'PE'] as const).map(side => <label key={side}><input type="checkbox" checked={shownSides.includes(side)} disabled={!!working || !online} onChange={event => edit({ sides: event.target.checked ? [...shownSides, side] : shownSides.filter(value => value !== side) })} />{side === 'CE' ? 'CALL' : 'PUT'}</label>)}</fieldset></div>
    <div className="audit-actions"><button className="button primary" disabled={!online || !!working || !modified}>{working === 'save-settings' ? 'Saving…' : 'Save for next trading day'}</button><button type="button" className="button secondary" disabled={!!working} onClick={reset}>Load 4-lot defaults</button></div></form>
    <p className="audit-help">T1 runs before T2; 0 T1 lots skips it. Minutes count from the original entry. Past clock deadlines become due after entry. Time exits can realize a loss and wait for fresh data. Reference stop, lower exit and square-off remain active. Charges are estimates.</p>
    {(error || note) && <p className={`audit-help ${error ? 'inline-error' : ''}`} role="status">{error || note}</p>}
  </section>
}
