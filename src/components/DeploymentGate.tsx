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
  const [googleEnabled, setGoogleEnabled] = useState(false)
  useEffect(() => {
    if (!deployed) return
    const controller = new AbortController()
    void fetch('/api/access', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
      .then(async response => { const body = await response.json(); if (!controller.signal.aborted) setGoogleEnabled(body.googleEnabled === true); return accessStatus(response.status, body) })
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
  return <main className="deployment-gate"><section><h1>{status === 'checking' ? 'Checking dashboard access…' : 'Sign in to Mavrix Trading'}</h1>
    {status === 'locked' && googleEnabled && <><p>Connect your own broker and manage your strategies in your private workspace.</p><button className="button primary" disabled={busy} onClick={async () => {
      setBusy(true); setError('')
      try {
        const { googleSignIn } = await import('../lib/firebase')
        const idToken = await googleSignIn()
        const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(15000) })
        const body = await response.json()
        if (!response.ok || body.authenticated !== true) throw new Error('Google sign-in could not be verified. Try again.')
        setStatus('open')
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        setError(code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled.' : code === 'auth/unauthorized-domain' ? 'This website must be authorized in Firebase Authentication.' : code === 'auth/operation-not-allowed' ? 'Google sign-in must be enabled in Firebase Authentication.' : code === 'auth/popup-blocked' ? 'Allow the Google sign-in popup, then try again.' : 'Google sign-in unavailable. Please try again.')
      } finally { setBusy(false) }
    }}>{busy ? 'Signing in…' : 'Continue with Google'}</button></>}
    {status === 'locked' && <details open={!googleEnabled}><summary>Owner access</summary><form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('')
      try {
        const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(8000) })
        const body = await response.json()
        if (!response.ok || body.authenticated !== true) throw new Error(response.status === 401 ? 'Incorrect dashboard password.' : 'Could not unlock dashboard.')
        setPassword(''); setStatus('open')
      } catch (error) { setError(error instanceof Error ? error.message : 'Connection unavailable.') }
      finally { setBusy(false) }
    }}><p>Owner password opens the existing private workspace.</p><label className="field">Dashboard password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="button primary" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock dashboard'}</button></form></details>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section></main>
}
