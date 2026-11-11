import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react'
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
        if (!controller.signal.aborted) setError('Execution IP check unavailable. Retry; do not use your browser IP.')
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
      setNote('Execution IP copied. Register it in trade.mstock.com API settings.')
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
          ? (result.ipv4 ? `Dedicated route verified (${result.ipv4}). Register this IP on trade.mstock.com.` : 'Dedicated route saved.')
          : (result.ipv4 ? `Restored default host route (${result.ipv4}).` : 'Restored default host route.'))
      }
    } finally {
      setRouteBusy(false)
    }
  }

  const routeLabel = egressMode === 'proxy'
    ? `Workspace proxy${report?.proxyLabel ? ` (${report.proxyLabel})` : ''}`
    : egressMode === 'interface'
      ? `Dedicated interface${report?.proxyLabel ? ` (${report.proxyLabel})` : ''}`
      : report?.sharedIpConflict
        ? 'Shared host IPv4 · Claimed'
        : report?.location === 'hosted'
          ? 'Hosted outbound IPv4'
          : 'Execution outbound IPv4'

  return (
    <div className="setup-stack">
      <section className="setup-card" aria-label="Execution IP">
        <div className="setup-card-head">
          <strong>Outbound IPv4</strong>
          <div className="setup-links">
            <a href="https://trade.mstock.com" target="_blank" rel="noreferrer">
              mStock <ExternalLink size={11} />
            </a>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRevision(value => value + 1)
                setNote('Rechecking outbound IP…')
              }}
            >
              <RefreshCw size={11} />
              Recheck
            </button>
          </div>
        </div>

        <button
          type="button"
          className="broker-ip-card"
          disabled={!ipv4}
          onClick={() => void copy()}
          title="Tap to copy execution IPv4"
        >
          <span className="broker-ip-info">
            <span className={`broker-ip-label${report?.sharedIpConflict ? ' conflict' : ''}`}>
              {routeLabel}
            </span>
            <code className="broker-ip-code">{ipv4 ?? (error || report?.error ? 'Unavailable' : 'Checking…')}</code>
          </span>
          <span className={`broker-ip-copy${copied ? ' copied' : ''}`}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>

        {report?.observed && (
          <p className="setup-meta">
            {isCurrent ? 'Verified' : 'Cached'} {clock(report.observed.checkedAt, true)} IST
          </p>
        )}
        {!report?.observed && report?.expectedIPv4 && (
          <p className="setup-meta">Configured host IP · {report.expectedIPv4}</p>
        )}
        {(error || report?.error) && !ipv4 && <p className="inline-error" role="status">{error || report?.error}</p>}
        {report?.sharedIpConflict && (
          <p className="setup-attention" role="alert">
            Another workspace uses {ipv4 ?? 'this host IP'} in mStock. Reusing it causes &ldquo;IP already used&rdquo;. Add a dedicated route below or run <code>run.bat</code> locally.
          </p>
        )}
        {report?.observed?.changed && (
          <p className="setup-attention">Outbound IP changed since the previous check. Verify mStock API settings before Live orders.</p>
        )}
        {report?.expectedMatch === false && (
          <p className="setup-attention">Observed IP differs from host configuration ({report.expectedIPv4}).</p>
        )}
      </section>

      <section className="setup-card" aria-label="Multi-user outbound route">
        <div className="setup-card-head">
          <strong>Multi-user route isolation</strong>
          <span className="tag">
            {egressMode === 'proxy' ? 'Proxy active' : egressMode === 'interface' ? 'Host interface' : 'Default host'}
          </span>
        </div>
        <p className="setup-desc">
          {egressMode === 'interface'
            ? 'Orders and streams exit through a host-assigned network interface.'
            : 'Route orders and live quotes through your own HTTP/HTTPS proxy URL so each mStock Client ID uses a unique IPv4.'}
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
              HTTP/HTTPS proxy URL
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
              <button className="button primary" type="submit" disabled={!!account || routeBusy || !!working || !proxyInput.trim()}>
                {routeBusy ? 'Testing route…' : 'Verify & apply'}
              </button>
              {report?.proxyConfigured && egressMode === 'proxy' && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={!!account || routeBusy || !!working}
                  onClick={() => void applyProxy('')}
                >
                  Reset to host IP
                </button>
              )}
            </div>
            {account && <p className="setup-meta">Disconnect mStock on the Account tab to edit route.</p>}
          </form>
        )}
      </section>

      {account && (
        <details className="setup-compare">
          <summary>Saved mStock IP reference</summary>
          <p className="setup-desc">
            Local reference only; edit official IPs inside trade.mstock.com.
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
                  setNote('IP reference saved.')
                }
              } finally {
                setBusy(false)
              }
            }}
          >
            <div className="setup-ip-pair">
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
                Secondary (optional)
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={form.secondary}
                  onChange={event => setDraft({ ...form, secondary: event.target.value.trim() })}
                />
              </label>
            </div>
            <button className="button secondary" disabled={busy || !!working || !report?.connectionScope}>
              {busy ? 'Saving…' : 'Save reference'}
            </button>
          </form>
          {registeredMatch != null && (
            <p className={registeredMatch ? 'setup-success' : 'setup-attention'}>
              {registeredMatch
                ? 'Execution IP matches your saved reference.'
                : 'Execution IP differs from saved reference.'}
            </p>
          )}
        </details>
      )}

      {note && (
        <p className="setup-note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}
