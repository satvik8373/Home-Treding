import { CloudDatabase } from './database.ts'
import type { CloudRequest, CloudResponse } from './database.ts'

let cached: { key: string; db: CloudDatabase } | null = null
export function cloudDatabase(env: NodeJS.ProcessEnv) {
  const key = `${env.DATABASE_URL}:${env.N009_STATE_KEY}`
  if (!cached || cached.key !== key) cached = { key, db: new CloudDatabase(env.DATABASE_URL ?? '', env.N009_STATE_KEY ?? '') }
  return cached.db
}
export const jsonResponse = (status: number, body: object): CloudResponse => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
export async function cloudDispatch(request: CloudRequest, env: NodeJS.ProcessEnv): Promise<CloudResponse> {
  const db = cloudDatabase(env)
  try {
    if (request.route === 'events') return { status: 204, headers: {}, body: '' }
    const state = await db.state()
    if (!state) return jsonResponse(503, { error: 'Hosted engine is starting or unavailable. No order was sent; retry when engine status is online.' })
    if (request.route === 'state' && request.method === 'GET') return jsonResponse(200, state)
    if (request.route === 'health') return jsonResponse(200, { ok: true, service: 'nifty-009-cloud-paper' })
    if (!['GET', 'HEAD'].includes(request.method) && request.csrf !== state.csrf) return jsonResponse(403, { error: 'Refresh the app before continuing.' })
    const id = await db.enqueue(request), deadline = Date.now() + 22_000
    while (Date.now() < deadline) {
      const result = await db.result(id)
      if (result) return result
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    return jsonResponse(504, { error: 'Request outcome is not confirmed. Refresh engine state before repeating an action.' })
  } catch { return jsonResponse(503, { error: 'Hosted engine storage or connection unavailable. Verify status before repeating an action.' }) }
}
