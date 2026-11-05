import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export function DeploymentGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'setup' | 'locked' | 'open'>(import.meta.env.VITE_DEPLOY_TARGET === 'vercel' ? 'checking' : 'open')
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function check() {
    try { const response = await fetch('/api/access', { cache: 'no-store' }); const body = await response.json(); setError(''); setStatus(!body.configured ? 'setup' : body.authenticated ? 'open' : 'locked') }
    catch { setStatus('setup'); setError('Could not check the deployment connection. Try again.') }
  }
  useEffect(() => {
    if (import.meta.env.VITE_DEPLOY_TARGET !== 'vercel') return
    const controller = new AbortController()
    void fetch('/api/access', { cache: 'no-store', signal: controller.signal }).then(response => response.json())
      .then(body => { if (!controller.signal.aborted) setStatus(!body.configured ? 'setup' : body.authenticated ? 'open' : 'locked') })
      .catch(() => { if (!controller.signal.aborted) { setStatus('setup'); setError('Could not check the deployment connection. Try again.') } })
    return () => controller.abort()
  }, [])
  if (status === 'open') return <>{import.meta.env.VITE_DEPLOY_TARGET === 'vercel' && <div className="deployment-session"><button className="text-button" onClick={async () => { await fetch('/api/access', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' }); window.location.reload() }}>Lock dashboard</button></div>}{children}</>
  return <main className="deployment-gate"><section><h1>{status === 'setup' ? 'Connect your trading engine' : status === 'checking' ? 'Checking dashboard access…' : 'Private trading dashboard'}</h1>
    {status === 'setup' ? <><p>The hosted engine connection is not configured. If your trading engine is running on this computer, use the local dashboard.</p><div className="deployment-actions"><a className="button primary" href="http://127.0.0.1:4310">Open local dashboard</a><button className="button secondary" onClick={() => void check()}>Check hosted connection</button></div><p>For access from other devices, <a href="https://github.com/satvik8373/Home-Treding/blob/main/VERCEL_DEPLOYMENT.md" target="_blank" rel="noreferrer">configure a hosted engine</a>.</p></> : status === 'locked' ? <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not unlock dashboard.'); setPassword(''); setStatus('open') } catch (error) { setError(error instanceof Error ? error.message : 'Connection unavailable.') } finally { setBusy(false) } }}><p>Enter your dashboard password to access your broker connection.</p><label className="field">Dashboard password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="button primary" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock dashboard'}</button></form> : null}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section></main>
}
