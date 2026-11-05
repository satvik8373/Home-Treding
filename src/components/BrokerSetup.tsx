import { useEffect, useState } from 'react'
import type { ExecutionSetup } from '../../shared/setup'
import type { useDashboard } from '../hooks/useDashboard'
import { clock } from '../lib/format'
import './BrokerSetup.css'

export function BrokerSetup({ account, action, working }: { account: string | null; action: ReturnType<typeof useDashboard>['action']; working: string }) {
  const [report, setReport] = useState<ExecutionSetup | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0), [draft, setDraft] = useState<{ primary: string; secondary: string } | null>(null), [note, setNote] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/setup/network', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<ExecutionSetup> })
      .then(body => { if (!controller.signal.aborted) { setReport(body); setError('') } })
      .catch(() => { if (!controller.signal.aborted) setError('Execution IP check unavailable. Retry; do not substitute your browser IP.') })
    return () => controller.abort()
  }, [account, revision])
  const current = report?.account === account ? report : null
  const form = draft ?? { primary: current?.profile?.primary ?? '', secondary: current?.profile?.secondary ?? '' }
  const ipv4 = current?.current ? current.observed?.ipv4 : null
  async function copy() {
    if (!ipv4) return
    try { await navigator.clipboard.writeText(ipv4); setNote('Execution IP copied. Paste it in your mStock API key IP settings.') }
    catch { setNote('Select and copy the execution IP shown above.') }
  }
  return <details className="broker-setup" open={!account}><summary>Broker & execution IP setup</summary>
    <ol className="setup-steps">
      <li><strong>1. Set the execution IP in mStock</strong><p>Open your mStock Trading API key settings. The address below belongs to the engine that sends orders, including when you use this dashboard from another device.</p>
        <div className="setup-address"><div><small>{current?.location === 'hosted' ? 'Hosted engine outbound IPv4' : 'Execution engine outbound IPv4'}</small><code>{ipv4 ?? (error || current?.error ? 'Unavailable' : 'Checking…')}</code></div><button className="button secondary" type="button" disabled={!ipv4} onClick={() => void copy()}>Copy IP</button></div>
        {current?.observed && <p className="setup-timestamp">{current.current ? 'Observed' : 'Last observation; currently unverified'} {clock(current.observed.checkedAt, true)} IST{!current.current ? ` · ${current.observed.ipv4}` : ''}</p>}
        {(error || current?.error) && <p className="inline-error" role="status">{error || current?.error}</p>}
        {current?.observed?.changed && <p className="setup-attention">The engine IP has changed in its saved observation history. Recheck your API key IP settings.</p>}
        {current?.expectedMatch === false && <p className="setup-attention">Observed IP differs from the host's configured execution IP ({current.expectedIPv4}). Ask the host operator to check outbound routing.</p>}
        <p>An observed IP does not prove a static allocation or broker approval. Register the engine's stable outbound IP, not your device IP or the website/tunnel address.</p>
        <div className="setup-links"><a href="https://trade.mstock.com" target="_blank" rel="noreferrer">Open mStock</a><button type="button" className="text-button" onClick={() => { setRevision(value => value + 1); setNote('Rechecking the engine IP; observations are cached for up to 30 seconds.') }}>Recheck execution IP</button></div>
      </li>
      <li><strong>2. Connect your broker account</strong><p>Use your own Type A API key, client code and password below, then complete OTP/TOTP. For NIFTY options, enable NSE F&O. After changing an API key or its IP settings, refresh the broker login.</p></li>
      <li><strong>3. Validate the connection</strong><p>After connecting, run the read-only account checks below. They verify funds, permissions and data access. Paper tests simulate fills; real execution remains untested until a broker-confirmed Live fill exists.</p></li>
    </ol>
    {account && <details className="setup-compare"><summary>Compare the IPs saved in your mStock API key</summary><p>Enter the values displayed in mStock. Saving here only keeps a reference for this account and API key; it does not change or verify broker settings.</p>
      <form onSubmit={async event => { event.preventDefault(); setBusy(true); setNote(''); try { const result = await action('/api/setup/network', { ...form, account, connectionScope: current?.connectionScope }, 'save-broker-ips'); if (result) { setDraft(null); setRevision(value => value + 1); setNote('Reference saved. Broker registration must be checked in mStock.') } } finally { setBusy(false) } }}>
        <label className="field">Primary IPv4<input type="text" inputMode="decimal" autoComplete="off" value={form.primary} required onChange={event => setDraft({ ...form, primary: event.target.value.trim() })} /></label>
        <label className="field">Secondary IPv4 · optional<input type="text" inputMode="decimal" autoComplete="off" value={form.secondary} onChange={event => setDraft({ ...form, secondary: event.target.value.trim() })} /></label>
        <button className="button secondary" disabled={busy || !!working || !current?.connectionScope}>{busy ? 'Saving…' : 'Save IP reference'}</button>
      </form>
      {current?.registeredMatch != null && <p className={current.registeredMatch ? '' : 'setup-attention'}>{current.registeredMatch ? 'Observed execution IP matches your saved reference. Broker acceptance remains unverified.' : 'Observed execution IP does not match either saved reference. Check the mStock API key settings before Live use.'}</p>}
    </details>}
    {note && <p className="setup-note" role="status">{note}</p>}
  </details>
}
