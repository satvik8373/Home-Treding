import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import type { ExecutionSetup } from '../../shared/setup'
import { executionRouteUnassigned } from '../../shared/setup'
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

  const unassigned = executionRouteUnassigned(report)
  const ipv4 = unassigned ? null : report?.observed?.ipv4 ?? report?.expectedIPv4 ?? null
  const canCopy = !!ipv4 && !!report?.current && !report?.sharedIpConflict && !report?.error
  const isCurrent = report?.current ?? false
  const egressMode = report?.egressMode ?? (report?.proxyConfigured ? 'proxy' : 'direct')

  const isSameAccount = !!(account && report?.account === account)
  const activeProfile = isSameAccount ? report?.profile : null
  const form = draft ?? { primary: activeProfile?.primary ?? '', secondary: activeProfile?.secondary ?? '' }
  const registeredMatch = isSameAccount && ipv4 ? (report?.registeredMatch ?? (activeProfile ? [activeProfile.primary, activeProfile.secondary].includes(ipv4) : null)) : null

  async function copy() {
    if (!ipv4 || !canCopy) return
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

  async function manageIp(actionName: 'release' | 'assign') {
    setRouteBusy(true); setNote('')
    try {
      const result = await action('/api/setup/ip', { action: actionName }, actionName === 'release' ? 'release-ip' : 'assign-ip')
      if (result?.saved) {
        setReport(result.network as ExecutionSetup)
        setRevision(value => value + 1)
        onNetworkChange?.()
        setNote(actionName === 'release' ? 'IP released. This account stays unassigned until you choose Recheck. Another account can now claim the available IP.'
          : result.assigned ? 'Execution IP assigned. Update this account’s mStock IP settings before connecting.' : 'No IP is available. Release one from another account, then Recheck.')
      }
    } finally { setRouteBusy(false) }
  }

  const routeLabel = unassigned ? 'Dedicated execution IP awaiting assignment' : egressMode === 'proxy'
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
              disabled={routeBusy || !!working}
              onClick={() => {
                if (report?.assignmentManaged && !report.proxyConfigured) void manageIp('assign')
                else { setRevision(value => value + 1); setNote('Rechecking outbound IP…') }
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
          disabled={!canCopy}
          onClick={() => void copy()}
          title="Tap to copy execution IPv4"
        >
          <span className="broker-ip-info">
            <span className={`broker-ip-label${report?.sharedIpConflict ? ' conflict' : ''}`}>
              {routeLabel}
            </span>
            <code className="broker-ip-code">{ipv4 ?? (unassigned ? 'Not assigned' : error || report?.error ? 'Unavailable' : 'Checking…')}</code>
          </span>
          <span className={`broker-ip-copy${copied ? ' copied' : ''}`}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>

        {report?.observed && !unassigned && (
          <p className="setup-meta">
            {isCurrent ? 'Observed' : 'Cached'} {clock(report.observed.checkedAt, true)} IST
          </p>
        )}
        {!unassigned && !report?.observed && report?.expectedIPv4 && (
          <p className="setup-meta">Configured host IP · {report.expectedIPv4}</p>
        )}
        {(error || report?.error) && !unassigned && <p className="inline-error" role="status">{error || report?.error}</p>}
        {unassigned ? (
          <p className="setup-attention" role="alert">
            {report?.assignmentReleased ? 'IP released for this account. Choose Recheck when you want to request an available IP again.' : 'No execution IP is available for this account. Release an IP from another account, then choose Recheck.'}
          </p>
        ) : report?.sharedIpConflict && (
          <p className="setup-attention" role="alert">
            Another workspace has reserved {ipv4 ?? 'this host IP'}. Configure a route with a different public IPv4 before connecting mStock.
          </p>
        )}
        {report?.observed?.changed && (
          <p className="setup-attention">Outbound IP changed since the previous check. Verify mStock API settings before Live orders.</p>
        )}
        {report?.expectedMatch === false && (
          <p className="setup-attention">Observed IP differs from host configuration ({report.expectedIPv4}).</p>
        )}
        {report?.assignmentManaged && report.proxyConfigured && (
          <div className="setup-ip-release">
            <button type="button" className="button secondary" disabled={!!account || routeBusy || !!working} onClick={() => void manageIp('release')}>
              {working === 'release-ip' ? 'Releasing…' : 'Release assigned IP'}
            </button>
            <p className="setup-meta">{account ? 'Stop the strategy and disconnect mStock before releasing its IP.' : 'Release frees this IP for another account. Remove its old registration in mStock before another user registers it.'}</p>
          </div>
        )}
      </section>

      <section className="setup-card" aria-label="Multi-user outbound route">
        <div className="setup-card-head">
          <strong>Account execution route</strong>
          <span className="tag">
            {unassigned ? 'Setup required' : egressMode === 'proxy' ? 'Proxy active' : egressMode === 'interface' ? 'Host interface' : 'Default host'}
          </span>
        </div>
        <p className="setup-desc">
          {egressMode === 'interface'
            ? 'Orders and streams exit through a host-assigned network interface.'
            : unassigned ? 'A different Google login or incognito window creates a separate workspace. Both still use the same execution server until a dedicated route is assigned.'
              : 'This account’s orders and live quotes use the assigned execution route.'}
        </p>
        {egressMode !== 'interface' && (
          <details className="setup-route-advanced">
            <summary>Use an existing dedicated route</summary>
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
              {report?.proxyConfigured && egressMode === 'proxy' && !report.assignmentManaged && (
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
          </details>
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
