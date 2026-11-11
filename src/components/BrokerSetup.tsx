import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ExecutionSetup } from '../../shared/setup'
import type { useDashboard } from '../hooks/useDashboard'
import { clock } from '../lib/format'
import './BrokerSetup.css'

type Props = {
  account: string | null
  action: ReturnType<typeof useDashboard>['action']
  working: string
  onNetworkChange?: () => void
}

export function BrokerSetup({ account, action, working, onNetworkChange }: Props) {
  const [report, setReport] = useState<ExecutionSetup | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [routeBusy, setRouteBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState<{ primary: string; secondary: string } | null>(null)
  const [proxyInput, setProxyInput] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    void fetch('/api/setup/network', { cache: 'no-store', signal: controller.signal })
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
  const egressMode = report?.egressMode ?? (report?.proxyConfigured ? 'proxy' : 'direct')

  const isSameAccount = !!(account && report?.account === account)
  const activeProfile = isSameAccount ? report?.profile : null
  const form = draft ?? { primary: activeProfile?.primary ?? '', secondary: activeProfile?.secondary ?? '' }
  const registeredMatch = isSameAccount && ipv4 ? (report?.registeredMatch ?? (activeProfile ? [activeProfile.primary, activeProfile.secondary].includes(ipv4) : null)) : null

  async function copy() {
    if (!ipv4) return
    try {
      await navigator.clipboard.writeText(ipv4)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      setNote('Execution IP copied. Register it in your mStock Type A API key settings.')
    } catch {
      setNote('Select and copy the execution IP shown above.')
    }
  }

  async function applyProxy(proxyUrl: string) {
    setRouteBusy(true)
    setNote('')
    try {
      const result = await action('/api/setup/proxy', { proxyUrl }, 'save-proxy') as { saved?: boolean; ipv4?: string | null } | null
      if (result?.saved) {
        setProxyInput('')
        setRevision(value => value + 1)
        onNetworkChange?.()
        setNote(proxyUrl
          ? (result.ipv4 ? `Dedicated route verified (${result.ipv4}). Register this IP in trade.mstock.com before connecting.` : 'Dedicated route saved.')
          : (result.ipv4 ? `Restored default host route (${result.ipv4}).` : 'Restored default host route.'))
      }
    } finally {
      setRouteBusy(false)
    }
  }

  const routeBadge = egressMode === 'proxy'
    ? `Workspace proxy route${report?.proxyLabel ? ` (${report.proxyLabel})` : ''}`
    : egressMode === 'interface'
      ? `Dedicated host interface${report?.proxyLabel ? ` (${report.proxyLabel})` : ''}`
      : report?.location === 'hosted'
        ? (report?.sharedIpConflict ? 'Shared host outbound IPv4 · Claimed by another account' : 'Hosted engine outbound IPv4')
        : 'Execution engine outbound IPv4'

  return (
    <details className="broker-setup" open={!account}>
      <summary>Broker & execution IP setup</summary>
      <ol className="setup-steps">
        <li>
          <strong>1. Execution IPv4 address for mStock</strong>
          <p>
            mStock binds each retail Type A API key to a fixed Client ID and IPv4 address. Register this workspace&apos;s exact outbound IP below on trade.mstock.com:
          </p>
          <div className="setup-address">
            <div>
              <small>{routeBadge}</small>
              <code>{ipv4 ?? (error || report?.error ? 'Unavailable' : 'Checking…')}</code>
            </div>
            <button className="button secondary" type="button" disabled={!ipv4} onClick={() => void copy()}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy IP'}
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
          {report?.sharedIpConflict && (
            <p className="setup-attention" role="alert">
              Another workspace on this host already uses {ipv4 ?? 'the host IPv4'} in mStock. Reusing it across separate mStock Client IDs causes &ldquo;IP already used&rdquo;. Configure a dedicated outbound route below or run the local engine (`run.bat` / `npm start`) on your own device/VPS.
            </p>
          )}
          {report?.observed?.changed && (
            <p className="setup-attention">The workspace outbound IP has changed in history. Recheck your mStock API key IP settings before Live execution.</p>
          )}
          {report?.expectedMatch === false && (
            <p className="setup-attention">
              Observed IP differs from the host&apos;s configured execution IP ({report.expectedIPv4}). Ask the host operator to check outbound routing.
            </p>
          )}
          <div className="setup-links">
            <a href="https://trade.mstock.com" target="_blank" rel="noreferrer">
              Open mStock
            </a>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRevision(value => value + 1)
                setNote('Rechecking the execution IP; observations are cached for up to 30 seconds.')
              }}
            >
              Recheck execution IP
            </button>
          </div>
        </li>
        <li>
          <strong>2. Connect your broker account (Type A flow)</strong>
          <p>
            Connect your own mStock account using your Type A API key and Authenticator TOTP or client code/password/SMS OTP. Ensure NSE F&amp;O is enabled on trade.mstock.com.
          </p>
        </li>
        <li>
          <strong>3. Validate account permissions & IP</strong>
          <p>
            Run read-only account checks after connecting to confirm mStock accepts requests from this IPv4 and supplies funds, positions, order book, and market quotes.
          </p>
        </li>
      </ol>
      <details className="setup-compare" open={!!report?.sharedIpConflict}>
        <summary>Workspace outbound route (multi-user IP separation)</summary>
        <p>
          {egressMode === 'interface'
            ? 'This workspace uses a host-assigned outbound network interface configured by the deployment operator.'
            : 'If this server\u2019s default IP is already used by another mStock account, supply your own free-tier micro-VM or static HTTP/HTTPS proxy URL so both REST orders and market streams exit from a distinct IPv4.'}
        </p>
        {egressMode !== 'interface' && (
          <form
            onSubmit={async event => {
              event.preventDefault()
              if (!proxyInput.trim()) return
              await applyProxy(proxyInput.trim())
            }}
          >
            <label className="field">
              HTTP/HTTPS outbound proxy URL
              <input
                type="url"
                autoComplete="off"
                placeholder="http://host:port"
                disabled={!!account || routeBusy || !!working}
                value={proxyInput}
                onChange={event => setProxyInput(event.target.value)}
              />
            </label>
            <div className="setup-route-actions">
              <button className="button secondary" type="submit" disabled={!!account || routeBusy || !!working || !proxyInput.trim()}>
                {routeBusy ? 'Testing route…' : 'Verify & apply route'}
              </button>
              {report?.proxyConfigured && egressMode === 'proxy' && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={!!account || routeBusy || !!working}
                  onClick={() => void applyProxy('')}
                >
                  Use default host route
                </button>
              )}
            </div>
            {account && <p className="form-hint">Disconnect mStock above before changing this workspace&apos;s outbound route.</p>}
          </form>
        )}
      </details>
      {account && (
        <details className="setup-compare">
          <summary>Compare the IPs saved in your mStock API key</summary>
          <p>
            Enter the values saved in mStock. Saving here retains a comparison reference for your account and does not change mStock settings.
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
                  setNote('Reference saved. Ensure this IP matches trade.mstock.com API settings.')
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
                ? 'Observed execution IP matches your saved reference.'
                : 'Observed execution IP does not match either saved reference. Check trade.mstock.com API key settings before Live use.'}
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
