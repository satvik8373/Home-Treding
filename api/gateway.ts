import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { cloudDispatch } from '../cloud-runtime/dispatch.mjs'
import type { CloudRequest, CloudResponse } from '../server/cloud/database.ts'
import { openIdentity, sealIdentity, tenantId, verifyGoogleUser } from '../cloud-runtime/identity.mjs'
import type { VerifiedUser } from '../cloud-runtime/identity.mjs'

const COOKIE = '__Host-n009', TTL = 12 * 60 * 60_000
const equal = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('hex')
const reply = (res: ServerResponse, status: number, body: object) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
async function bodyOf(req: IncomingMessage & { body?: unknown }): Promise<string> {
  if (req.body !== undefined) {
    const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error('too-large')
    return text
  }
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 2 * 1024 * 1024) throw new Error('too-large'); chunks.push(bytes) }
  return Buffer.concat(chunks).toString('utf8')
}

/** Authenticated stateless gateway only. SQLite and the trading loop stay on one persistent engine. */
export function createGateway(environment: () => NodeJS.ProcessEnv = () => process.env, fetcher: typeof fetch = fetch, cloud: (request: CloudRequest, env: NodeJS.ProcessEnv) => Promise<CloudResponse> = cloudDispatch, verifyUser: (token: string, project: string) => Promise<VerifiedUser> = verifyGoogleUser) {
  return async function gateway(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff')
    const env = environment(), secret = env.N009_GATEWAY_SECRET ?? '', password = env.N009_DASHBOARD_PASSWORD ?? ''
    const hosted = env.N009_ENGINE_TRANSPORT === 'cloud'
    let engine: URL | undefined
    try {
      if (secret.length < 32 || password.length < 24) throw new Error()
      if (hosted) {
        if (!/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL ?? '') || !/^[a-f0-9]{64}$/i.test(env.N009_STATE_KEY ?? '')) throw new Error()
      } else {
        engine = new URL(env.N009_ENGINE_ORIGIN ?? '')
        if (engine.protocol !== 'https:' || engine.username || engine.password || engine.pathname !== '/' || engine.search || engine.hash) throw new Error()
      }
    } catch { return reply(res, 503, { configured: false, error: 'Deployment setup required. Configure the engine connection and dashboard access in Vercel.' }) }
    const url = new URL(req.url ?? '/', 'https://dashboard.invalid')
    const route = url.searchParams.get('route') ?? url.pathname.replace(/^\/api\//, '')
    url.searchParams.delete('route')
    if (!/^[a-zA-Z0-9_./-]+$/.test(route) || route.split('/').some(part => part === '.' || part === '..')) return reply(res, 400, { error: 'Invalid API route.' })
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
      const origin = req.headers.origin
      if (req.headers['sec-fetch-site'] === 'cross-site' || origin && origin !== `https://${req.headers.host}`) return reply(res, 403, { error: 'Cross-site requests are blocked.' })
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return reply(res, 415, { error: 'JSON request required.' })
    }
    const token = (req.headers.cookie ?? '').split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? ''
    const [expiry, signature = ''] = token.split('.')
    const legacyAuthenticated = /^\d+$/.test(expiry ?? '') && Number(expiry) > Date.now() && Number(expiry) <= Date.now() + TTL && equal(signature, sign(expiry, secret))
    const googleEnabled = !!env.N009_FIREBASE_PROJECT_ID && env.N009_MULTIUSER === 'true' && !hosted
    const identity = googleEnabled ? openIdentity(token, secret, `dashboard:${env.N009_FIREBASE_PROJECT_ID}`) : null
    const workspace = identity?.expires && identity.expires <= Date.now() + TTL ? identity.tenant : legacyAuthenticated ? 'owner' : null
    const authenticated = workspace !== null
    if (route === 'access') {
      if (req.method === 'GET') return reply(res, 200, { configured: true, authenticated, googleEnabled, user: !authenticated ? null : workspace === 'owner' ? { kind: 'owner', name: 'Workspace owner', email: null, expiresAt: Number(expiry) } : { kind: 'google', name: identity?.profile?.name || 'Google account', email: identity?.profile?.email || null, expiresAt: identity?.expires } })
      if (req.method === 'DELETE') { res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`); return reply(res, 200, { authenticated: false }) }
      if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed.' })
      try {
        const body = JSON.parse(await bodyOf(req)) as { password?: unknown; idToken?: unknown }
        if (body.idToken !== undefined) {
          if (!googleEnabled || typeof body.idToken !== 'string') return reply(res, 401, { error: 'Google sign-in is unavailable.' })
          try {
            const user = await verifyUser(body.idToken, env.N009_FIREBASE_PROJECT_ID!)
            const expires = Math.min(user.expires, Date.now() + 60 * 60_000)
            if (!user.uid || user.uid.length > 128 || expires <= Date.now()) throw new Error()
            const session = sealIdentity({ tenant: tenantId(`${env.N009_FIREBASE_PROJECT_ID}:${user.uid}`), expires, profile: { name: user.name?.slice(0, 100), email: user.email?.slice(0, 254) } }, secret, `dashboard:${env.N009_FIREBASE_PROJECT_ID}`)
            res.setHeader('Set-Cookie', `${COOKIE}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor((expires - Date.now()) / 1000)}`)
            return reply(res, 200, { authenticated: true })
          } catch { return reply(res, 401, { error: 'Google sign-in could not be verified. Sign in again.' }) }
        }
        if (typeof body.password !== 'string' || !equal(body.password, password)) return reply(res, 401, { error: 'Incorrect dashboard password.' })
        const expires = String(Date.now() + TTL)
        res.setHeader('Set-Cookie', `${COOKIE}=${expires}.${sign(expires, secret)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL / 1000}`)
        return reply(res, 200, { authenticated: true })
      } catch { return reply(res, 400, { error: 'Invalid login request.' }) }
    }
    if (!authenticated) return reply(res, 401, { error: 'Unlock the private dashboard to continue.' })
    if (hosted) {
      try {
        const result = await cloud({ route, method: req.method ?? 'GET', query: url.search, csrf: typeof req.headers['x-009-csrf'] === 'string' ? req.headers['x-009-csrf'] : '', body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : await bodyOf(req) }, env)
        res.statusCode = result.status
        for (const name of ['content-type', 'content-disposition']) if (result.headers[name]) res.setHeader(name, result.headers[name])
        res.end(req.method === 'HEAD' ? undefined : result.body)
      } catch { reply(res, 503, { error: 'Hosted engine unavailable. Refresh status before repeating an action.' }) }
      return
    }
    const target = new URL(`/api/${route}`, engine); target.search = url.search
    const headers: Record<string, string> = { 'x-009-gateway-secret': secret }
    headers['x-009-workspace'] = sealIdentity({ tenant: workspace, expires: Date.now() + 60_000 }, secret, 'engine')
    if (typeof req.headers['x-009-csrf'] === 'string') headers['x-009-csrf'] = req.headers['x-009-csrf']
    if (typeof req.headers['content-type'] === 'string') headers['content-type'] = req.headers['content-type']
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000)
    res.on('close', () => controller.abort())
    try {
      if (workspace !== 'owner') {
        // A misconfigured or rolled-back single-user engine must never serve its owner data to Google users.
        const capability = await fetcher(new URL('/api/health', engine), { headers, redirect: 'error', signal: controller.signal })
        const proof = capability.ok ? await capability.json() as { workspaceIsolation?: unknown } : null
        if (proof?.workspaceIsolation !== true) return reply(res, 503, { error: 'Separate user workspaces are not available on this engine.' })
      }
      const body = ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : await bodyOf(req)
      const upstream = await fetcher(target, { method: req.method, headers, body, redirect: 'error', signal: controller.signal })
      res.statusCode = upstream.status
      for (const name of ['content-type', 'content-disposition', 'x-accel-buffering']) { const value = upstream.headers.get(name); if (value) res.setHeader(name, value) }
      if (upstream.body && req.method !== 'HEAD') await pipeline(Readable.fromWeb(upstream.body as never), res)
      else res.end()
    } catch {
      if (!res.headersSent) reply(res, 502, { error: 'Engine connection unavailable. Check that the persistent engine is running.' })
      else res.end()
    } finally { clearTimeout(timer) }
  }
}
export default createGateway()
