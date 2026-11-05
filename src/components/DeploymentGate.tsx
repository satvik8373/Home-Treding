import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { accessStatus } from '../../shared/deployment'
import type { DeploymentStatus } from '../../shared/deployment'
import { DeploymentContext } from '../lib/deployment'
import { AccountContext } from '../lib/account'
import type { AccountUser } from '../lib/account'
import './Account.css'

export function DeploymentGate({ children }: { children: ReactNode }) {
  const deployed = import.meta.env.VITE_DEPLOY_TARGET === 'vercel'
  const [status, setStatus] = useState<DeploymentStatus>(deployed ? 'checking' : 'open')
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const [googleEnabled, setGoogleEnabled] = useState(false), [user, setUser] = useState<AccountUser | null>(null)
  useEffect(() => {
    if (!deployed) return
    const controller = new AbortController()
    void fetch('/api/access', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
      .then(async response => { const body = await response.json(); if (!controller.signal.aborted) { setGoogleEnabled(body.googleEnabled === true); setUser(body.authenticated === true ? body.user ?? null : null) }; return accessStatus(response.status, body) })
      .then(next => { if (!controller.signal.aborted) { setStatus(next); setError(next === 'unavailable' ? 'Could not verify your session. Please try again.' : '') } })
      .catch(() => { if (!controller.signal.aborted) { setStatus('unavailable'); setError('Connection unavailable. Please try again.') } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [deployed, revision])
  useEffect(() => {
    if (!deployed) return
    if (status === 'locked') window.history.replaceState(null, '', '/login')
    if (status === 'open' && window.location.pathname === '/login') window.history.replaceState(null, '', '/')
    const expired = () => { setStatus('checking'); setUser(null); setRevision(value => value + 1) }
    window.addEventListener('n009:session-expired', expired)
    const timer = status === 'open' && user?.expiresAt ? setTimeout(expired, Math.max(0, user.expiresAt - Date.now()) + 100) : undefined
    return () => { window.removeEventListener('n009:session-expired', expired); if (timer) clearTimeout(timer) }
  }, [deployed, status, user?.expiresAt])
  const retry = () => { setBusy(true); setRevision(value => value + 1) }
  const signedIn = () => { setPassword(''); setStatus('checking'); setRevision(value => value + 1) }
  const logout = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/access', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('Logout failed')
      // Full navigation clears every cached broker response, chart and workspace component.
      window.location.assign('/login')
    } catch (error) { setBusy(false); throw error }
  }
  if (status === 'open') return <AccountContext.Provider value={deployed ? { user, logout, busy } : null}><DeploymentContext.Provider value={{ available: true }}><Fragment key="active">{children}</Fragment></DeploymentContext.Provider></AccountContext.Provider>
  return <main className="auth-page">
    <a className="auth-brand" href="/login" aria-label="Mavrix Trading sign in"><img src="/mavrix-icon.jpg" alt="" width="38" height="38" /><span>MAVRIX <small>TRADING</small></span></a>
    <section className="auth-card" aria-labelledby="login-title">
      <span className="auth-eyebrow">YOUR TRADING WORKSPACE</span><h1 id="login-title">{status === 'checking' ? 'Checking your session' : 'Welcome to Mavrix'}</h1>
      <p className="auth-description">Sign in to connect your broker, manage strategies and review your trading activity.</p>
      {status === 'locked' && <>
        {googleEnabled && <button className="google-signin" disabled={busy} onClick={async () => {
          setBusy(true); setError('')
          try {
            const { googleSignIn } = await import('../lib/firebase')
            const idToken = await googleSignIn()
            const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(15000) })
            const body = await response.json()
            if (!response.ok || body.authenticated !== true) throw new Error()
            signedIn()
          } catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
            setError(code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled.' : code === 'auth/unauthorized-domain' ? 'This website must be authorized in Firebase Authentication.' : code === 'auth/operation-not-allowed' ? 'Google sign-in must be enabled in Firebase Authentication.' : code === 'auth/popup-blocked' ? 'Allow the Google sign-in popup, then try again.' : 'Google sign-in unavailable. Please try again.')
            setBusy(false)
          }
        }}><span className="google-letter" aria-hidden="true">G</span>{busy ? 'Signing in…' : 'Continue with Google'}<ArrowRight size={17} /></button>}
        <p className="auth-privacy"><ShieldCheck size={16} />Your broker connection and trading data stay in your own workspace.</p>
        <details className="auth-owner" open={!googleEnabled}><summary>Owner sign-in</summary><form onSubmit={async event => {
          event.preventDefault(); setBusy(true); setError('')
          try {
            const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(8000) })
            const body = await response.json()
            if (!response.ok || body.authenticated !== true) throw new Error(response.status === 401 ? 'Incorrect owner password.' : 'Could not sign in.')
            signedIn()
          } catch (error) { setError(error instanceof Error ? error.message : 'Connection unavailable.'); setBusy(false) }
        }}><p>Access the original owner workspace.</p><label className="field">Owner password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in as owner'}</button></form></details>
      </>}
      {(status === 'setup' || status === 'unavailable') && <div className="auth-unavailable"><p>{status === 'setup' ? 'The deployment connection needs to be configured before sign-in.' : 'We could not reach the sign-in service.'}</p><button className="button secondary" disabled={busy} onClick={retry}>{busy ? 'Checking…' : 'Try again'}</button></div>}
      {status === 'checking' && <p className="auth-status" role="status">Verifying secure dashboard access…</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
    <p className="auth-footer">MAVRIX / 009 <span>·</span> Google sign-in connects your profile. Connect mStock after signing in.</p>
  </main>
}
