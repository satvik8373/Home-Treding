export const uncertainActionMessage = 'The request outcome is not confirmed. Refreshing engine state; check its status before repeating this action.'

export class DashboardActionError extends Error {
  constructor(message: string, public readonly unauthorized = false) { super(message) }
}

/** A mutation is sent once. A timeout or gateway failure must never trigger an automatic resend. */
export async function requestDashboardAction(path: string, body: object, csrf: string, fetcher: typeof fetch = fetch) {
  if (!csrf) throw new DashboardActionError('Dashboard verification is not ready. Wait for the engine connection before trying again.')
  let response: Response
  try {
    response = await fetcher(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-009-CSRF': csrf }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) })
  } catch { throw new DashboardActionError(uncertainActionMessage) }
  let result: Awaited<ReturnType<Response['json']>> = null
  try { result = await response.json() } catch { /* An intermediary may return HTML instead of JSON. */ }
  if (response.status === 401) throw new DashboardActionError('Your dashboard sign-in expired. Sign in again to continue.', true)
  if (response.status >= 500 || response.ok && !result) throw new DashboardActionError(uncertainActionMessage)
  if (!response.ok) throw new DashboardActionError(typeof result?.error === 'string' ? result.error : 'The engine could not accept this request. Check the connection and session status.')
  return result!
}

export function acceptedActionNotice(path: string): string | null {
  if (path === '/api/strategy/start') return 'Start / resume request accepted. Follow the engine status for progress.'
  if (path === '/api/strategy/stop') return 'Stop request accepted. Closing is complete only when the engine confirms both legs are flat.'
  if (path === '/api/strategy/reconcile') return 'Reconciliation request completed. Check the updated session status.'
  return null
}
