import { useState } from 'react'
import type { StrategySettings } from '../../shared/settings'
import { DEFAULT_SETTINGS, sameSettings, validateSettings } from '../../shared/settings'
import type { useDashboard } from '../hooks/useDashboard'

const numeric = [
  ['breakoutPercent', 'Breakout above reference · %', 0.01, 10, 0.01], ['exitPercent', 'Lower exit below reference · %', 0.01, 10, 0.01],
  ['entryLots', 'Entry lots', 1, 20, 1], ['target1Lots', 'Lots sold at target 1 · 0 skips T1', 0, 19, 1],
  ['target1Points', 'Target 1 · premium points', 0.05, 1000, 0.05], ['target2Points', 'Target 2 · premium points', 0.1, 2000, 0.05],
  ['maxEntriesPerLeg', 'Max entries per leg/session · 0 unlimited', 0, 100, 1], ['feePerOrderEstimate', 'Estimated charges · ₹ / filled order', 0, 1000, 0.01],
] as const
const formOf = (s: StrategySettings) => Object.fromEntries(numeric.map(([key]) => [key, String(s[key])])) as Record<typeof numeric[number][0], string>

export function StrategySettingsPanel({ saved, effective, active, online, working, action }: {
  saved: StrategySettings; effective: StrategySettings; active: boolean; online: boolean; working: string; action: ReturnType<typeof useDashboard>['action'];
}) {
  const [form, setForm] = useState(() => formOf(saved)), [cutoff, setCutoff] = useState(saved.cutoff), [sides, setSides] = useState(saved.enabledSides)
  const [dirty, setDirty] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('')
  const shownForm = dirty ? form : formOf(saved), shownCutoff = dirty ? cutoff : saved.cutoff, shownSides = dirty ? sides : saved.enabledSides
  const modified = dirty && (numeric.some(([key]) => Number(shownForm[key]) !== saved[key]) || shownCutoff !== saved.cutoff || [...shownSides].sort().join() !== [...saved.enabledSides].sort().join())
  function edit(change: { form?: typeof form; cutoff?: string; sides?: StrategySettings['enabledSides'] }) { setDirty(true); setForm(change.form ?? shownForm); setCutoff(change.cutoff ?? shownCutoff); setSides(change.sides ?? shownSides); setError(''); setNote('') }
  const changed = !sameSettings(saved, effective)
  function reset() { setDirty(true); setForm(formOf(DEFAULT_SETTINGS)); setCutoff(DEFAULT_SETTINGS.cutoff); setSides([...DEFAULT_SETTINGS.enabledSides]); setError(''); setNote('Defaults loaded into the form. Save to apply to a future session.') }
  async function save() {
    setError(''); setNote('')
    try {
      if (numeric.some(([key]) => !shownForm[key].trim())) throw new Error('Complete every numeric field. Use 0 only where explicitly allowed.')
      const settings = validateSettings({ ...Object.fromEntries(numeric.map(([key]) => [key, Number(shownForm[key])])), cutoff: shownCutoff, enabledSides: shownSides })
      const result = await action('/api/strategy/settings', settings, 'save-settings')
      if (result) setNote('Saved. Current session rules are unchanged; the next fresh session and new backtests use these settings.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save settings.') }
  }
  return <section className="panel settings-panel"><div className="panel-title"><h2>Strategy settings</h2><span className="tag">NIFTY 009</span></div>
    <p className="audit-help">{active ? 'Current session is locked to its own rules. You can save changes for the next session.' : 'Saving does not start trading. A changed configuration creates a fresh session when you next press Start.'}{changed ? ' Saved settings differ from the displayed session.' : ''}</p>
    <form onSubmit={event => { event.preventDefault(); void save() }}><div className="settings-fields">{numeric.map(([key, label, min, max, step]) => <label className="field" key={key}>{label}<input type="number" min={min} max={max} step={step} value={shownForm[key]} disabled={!!working || !online} onChange={event => edit({ form: { ...shownForm, [key]: event.target.value } })} required /></label>)}<label className="field">Square-off cutoff · IST<input type="time" min="09:30" max="15:25" step="300" value={shownCutoff} disabled={!!working || !online} onChange={event => edit({ cutoff: event.target.value })} required /></label><fieldset className="settings-legs"><legend>Allowed entry legs</legend>{(['CE', 'PE'] as const).map(side => <label key={side}><input type="checkbox" checked={shownSides.includes(side)} disabled={!!working || !online} onChange={event => edit({ sides: event.target.checked ? [...shownSides, side] : shownSides.filter(value => value !== side) })} />{side === 'CE' ? 'CALL' : 'PUT'}</label>)}</fieldset></div>
    <div className="audit-actions"><button className="button primary" disabled={!online || !!working || !modified}>{working === 'save-settings' ? 'Saving…' : 'Save for next session'}</button><button type="button" className="button secondary" disabled={!!working} onClick={reset}>Load original 009 defaults</button></div></form>
    <p className="audit-help">Both original ATM references are fetched. Disabled legs cannot enter. Five-minute candles, the 09:15–09:20 reference, NIFTY ATM selection, MIS and MARKET execution remain fixed. Target 2 exits all remaining units. Cost input is an estimate, never a verified broker charge.</p>
    {(error || note) && <p className={`audit-help ${error ? 'inline-error' : ''}`} role="status">{error || note}</p>}
  </section>
}
