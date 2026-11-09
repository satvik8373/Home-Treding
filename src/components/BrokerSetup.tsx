import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import type { ExecutionSetup } from '../../shared/setup'
import type { useDashboard } from '../hooks/useDashboard'
import { clock } from '../lib/format'
import './BrokerSetup.css'

export function BrokerSetup({ account, action, working }: { account: string | null; action: ReturnType<typeof useDashboard>['action']; working: string }) {
  const [report, setReport] = useState<ExecutionSetup | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0), [draft, setDraft] = useState<{ primary: string; secondary: string } | null>(null), [note, setNote] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    void fetch('/api/setup/network', {
      cache: 'no-store',
      signal: typeof AbortSignal.any === 'function' ? AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) : controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<ExecutionSetup>
      })
      .then(body => {
        clearTimeout(timer)
        if (!controller.signal.aborted) {
          setReport(body)
          setError('')
        }
      })
      .catch(() => {
        clearTimeout(timer)
        if (!controller.signal.aborted) setError('Execution IP check unavailable. Retry; do not substitute your browser IP.')
      })
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [account, revision])

  const ipv4 = report?.observed?.ipv4 ?? report?.expectedIPv4 ?? null
  const isCurrent = report?.current ?? false

  const isSameAccount = !!(account && report?.account === account)
  const activeProfile = isSameAccount ? report?.profile : null
  const form = draft ?? { primary: activeProfile?.primary ?? '', secondary: activeProfile?.secondary ?? '' }
  const registeredMatch = isSameAccount && ipv4 ? (report?.registeredMatch ?? (activeProfile ? [activeProfile.primary, activeProfile.secondary].includes(ipv4) : null)) : null
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!ipv4) return
    try {
      await navigator.clipboard.writeText(ipv4)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      setNote('Execution IP copied! Paste it in your mStock API key IP settings.')
    } catch {
      setNote('Select and copy the execution IP shown above.')
    }
  }

  return (
    <details className="broker-setup" open={!account}>
      <summary>Broker & execution IP setup</summary>
      <ol className="setup-steps">
        <li>
          <strong>1. Set execution IP in mStock</strong>
          <p>
            Open your mStock Trading API key settings (trade.mstock.com). All users trading through this engine send orders from the outbound IP below:
          </p>
          <div className="setup-address">
            <div>
              <small>{report?.location === 'hosted' ? 'Hosted engine outbound IPv4' : 'Execution engine outbound IPv4'}</small>
              <code>{ipv4 ?? (error || report?.error ? 'Unavailable' : 'Checking…')}</code>
            </div>
            <button className="button secondary" type="button" disabled={!ipv4} onClick={() => void copy()}>
              <Copy size={13} /> {copied ? '✓ Copied' : 'Copy IP'}
            </button>
          </div>
          {report?.observed && (
            <p className="setup-timestamp">
              {isCurrent ? 'Observed' : 'Last observation; currently unverified'} {clock(report.observed.checkedAt, true)} IST
              {!isCurrent ? ` · ${report.observed.ipv4}` : ''}
            </p>
          )}
          {!report?.observed && report?.expectedIPv4 && (
            <p className="setup-timestamp">Configured host execution IP · {report.expectedIPv4}</p>
          )}
          {(error || report?.error) && !ipv4 && <p className="inline-error" role="status">{error || report?.error}</p>}
          {report?.observed?.changed && (
            <p className="setup-attention">The engine IP has changed in its saved observation history. Recheck your API key IP settings.</p>
          )}
          {report?.expectedMatch === false && (
            <p className="setup-attention">
              Observed IP differs from the host's configured execution IP ({report.expectedIPv4}). Ask the host operator to check outbound routing.
            </p>
          )}
          <p>
            An observed IP does not prove a static allocation or broker approval. Each user must register this stable outbound IP in their own mStock API key settings, <strong>not</strong> their personal device IP or website URL.
          </p>
          <div className="setup-links">
            <a href="https://trade.mstock.com" target="_blank" rel="noreferrer">
              Open mStock
            </a>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRevision(value => value + 1)
                setNote('Rechecking the engine IP; observations are cached for up to 30 seconds.')
              }}
            >
              Recheck execution IP
            </button>
          </div>
        </li>
        <li>
          <strong>2. Connect your broker account (Official Type A Flow)</strong>
          <p>
            Every user connects their own mStock account. Use your own Type A API key, client code and password or Authenticator TOTP below. For NIFTY options, ensure NSE F&O is enabled in mStock. After changing an API key or its IP settings in mStock, refresh the broker login.
          </p>
        </li>
        <li>
          <strong>3. Validate connection & official flow</strong>
          <p>
            After connecting, run the read-only account checks below. They verify funds, positions, order-book access and official REST quotes. Successful checks confirm mStock has accepted API calls from this execution IP.
          </p>
        </li>
      </ol>
      {account && (
        <details className="setup-compare">
          <summary>Compare the IPs saved in your mStock API key</summary>
          <p>
            Enter the values displayed in mStock. Saving here keeps a reference for your account to verify against the execution IP; it does not change broker settings directly.
          </p>
          <form
            onSubmit={async event => {
              event.preventDefault()
              setBusy(true)
              setNote('')
              try {
                const result = await action(
                  '/api/setup/network',
                  { ...form, account, connectionScope: report?.connectionScope },
                  'save-broker-ips',
                )
                if (result) {
                  setDraft(null)
                  setRevision(value => value + 1)
                  setNote('Reference saved. Ensure this IP is registered in mStock API settings.')
                }
              } finally {
                setBusy(false)
              }
            }}
          >
            <label className="field">
              Primary IPv4
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.primary}
                required
                onChange={event => setDraft({ ...form, primary: event.target.value.trim() })}
              />
            </label>
            <label className="field">
              Secondary IPv4 · optional
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.secondary}
                onChange={event => setDraft({ ...form, secondary: event.target.value.trim() })}
              />
            </label>
            <button className="button secondary" disabled={busy || !!working || !report?.connectionScope}>
              {busy ? 'Saving…' : 'Save IP reference'}
            </button>
          </form>
          {registeredMatch != null && (
            <p className={registeredMatch ? 'setup-success' : 'setup-attention'}>
              {registeredMatch
                ? '✓ Observed execution IP matches your saved reference. Verify live execution with account checks.'
                : '⚠ Observed execution IP does not match either saved reference. Check trade.mstock.com API key settings before Live use.'}
            </p>
          )}
        </details>
      )}
      {note && (
        <p className="setup-note" role="status">
          {note}
        </p>
      )}
    </details>
  )
}
