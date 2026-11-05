import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { accessStatus } from '../../shared/deployment'
import type { DeploymentStatus } from '../../shared/deployment'
import { DeploymentContext } from '../lib/deployment'

/** Configured private deployments stay locked. An unconfigured site exposes only an empty, offline UI. */
export function DeploymentGate({ children }: { children: ReactNode }) {
  const deployed = import.meta.env.VITE_DEPLOY_TARGET === 'vercel'
  const [status, setStatus] = useState<DeploymentStatus>(deployed ? 'checking' : 'open')
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!deployed) return
    const controller = new AbortController()
    void fetch('/api/access', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
      .then(async response => accessStatus(response.status, await response.json()))
      .then(next => { if (!controller.signal.aborted) { setStatus(next); setError(next === 'unavailable' ? 'Could not verify dashboard access. Try again.' : '') } })
      .catch(() => { if (!controller.signal.aborted) { setStatus('unavailable'); setError('Could not verify dashboard access. Try again.') } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [deployed, revision])
  const retry = () => { setBusy(true); setRevision(value => value + 1) }
  if (status === 'open' || status === 'setup' || status === 'unavailable') return <DeploymentContext.Provider value={{ available: status === 'open', reason: status === 'open' ? undefined : status, checking: busy, retry }}>
    {deployed && status === 'open' && <div className="deployment-session">{error && <span role="alert">{error}</span>}<button className="text-button" onClick={async () => {
      try { const response = await fetch('/api/access', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(); window.location.reload() }
      catch { setError('Could not lock the dashboard. Try again.') }
    }}>Lock dashboard</button></div>}
    <Fragment key={status === 'open' ? 'active' : 'offline'}>{children}</Fragment>
  </DeploymentContext.Provider>
  return <main className="deployment-gate"><section><h1>{status === 'checking' ? 'Checking dashboard access…' : 'Private trading dashboard'}</h1>
    {status === 'locked' && <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('')
      try {
        const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(8000) })
        const body = await response.json()
        if (!response.ok || body.authenticated !== true) throw new Error(response.status === 401 ? 'Incorrect dashboard password.' : 'Could not unlock dashboard.')
        setPassword(''); setStatus('open')
      } catch (error) { setError(error instanceof Error ? error.message : 'Connection unavailable.') }
      finally { setBusy(false) }
    }}><p>Enter your dashboard password to access your broker connection.</p><label className="field">Dashboard password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="button primary" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock dashboard'}</button></form>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section></main>
}
