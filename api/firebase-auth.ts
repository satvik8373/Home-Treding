import type { IncomingMessage, ServerResponse } from 'node:http'

const HELPERS: Record<string, string> = {
  handler: '/__/auth/handler', 'handler.js': '/__/auth/handler.js', iframe: '/__/auth/iframe', 'iframe.js': '/__/auth/iframe.js',
  'experiments.js': '/__/auth/experiments.js', links: '/__/auth/links', 'links.js': '/__/auth/links.js', 'init.json': '/__/firebase/init.json',
}
const MAX_REQUEST = 128 * 1024, MAX_RESPONSE = 2 * 1024 * 1024
/** Firebase's same-origin helper proxy. No dashboard cookies, tokens or workspace headers leave this origin. */
export function createFirebaseAuthProxy(fetcher: typeof fetch = fetch) {
  return async (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'")
    let topLevel = false
    const fail = (status: number) => {
      res.statusCode = status
      res.setHeader('Content-Type', topLevel ? 'text/html; charset=utf-8' : 'application/json')
      res.end(topLevel ? '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mavrix sign-in</title><body style="font-family:system-ui;background:#f8fafc;color:#0f172a;padding:32px"><h1>Google sign-in unavailable</h1><p>Return to Mavrix and try again when your connection is available.</p><a href="/login">Return to sign-in</a></body></html>' : JSON.stringify({ error: 'Google sign-in helper unavailable. Retry sign-in.' }))
    }
    if (!['GET', 'HEAD', 'POST'].includes(req.method ?? 'GET')) { res.setHeader('Allow', 'GET, HEAD, POST'); return fail(405) }
    const incoming = new URL(req.url ?? '/', 'https://dashboard.invalid'), resource = incoming.searchParams.get('resource') ?? ''
    if (!Object.hasOwn(HELPERS, resource)) return fail(404)
    topLevel = resource === 'handler' || resource === 'links'
    incoming.searchParams.delete('resource')
    const target = new URL(HELPERS[resource], 'https://mavrix-trading.firebaseapp.com'); target.search = incoming.search
    const headers: Record<string, string> = { Accept: '*/*' }
    let body: Buffer | undefined
    try {
      if (req.method === 'POST') {
        const type = req.headers['content-type'] ?? 'application/x-www-form-urlencoded'
        if (!/^(application\/x-www-form-urlencoded|application\/json|text\/plain)(;|$)/i.test(type)) return fail(415)
        headers['Content-Type'] = type
        if (req.body !== undefined) {
          body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : type.toLowerCase().startsWith('application/x-www-form-urlencoded') ? new URLSearchParams(req.body as Record<string, string>).toString() : JSON.stringify(req.body))
        } else {
          const chunks: Buffer[] = []; let size = 0
          for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > MAX_REQUEST) return fail(413); chunks.push(bytes) }
          body = Buffer.concat(chunks)
        }
        if (body.length > MAX_REQUEST) return fail(413)
      }
      const upstream = await fetcher(target, { method: req.method === 'HEAD' ? 'GET' : req.method ?? 'GET', headers, ...(body ? { body: new Uint8Array(body).buffer } : {}), redirect: 'manual', signal: AbortSignal.timeout(12_000) })
      // These are static Firebase helper endpoints. Never become an arbitrary redirect or cookie proxy.
      if (upstream.status !== 200) return fail(502)
      const chunks: Uint8Array[] = []; let size = 0
      if (upstream.body) for await (const chunk of upstream.body) { size += chunk.byteLength; if (size > MAX_RESPONSE) return fail(502); chunks.push(chunk) }
      res.statusCode = 200
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'text/html; charset=utf-8')
      res.end(req.method === 'HEAD' ? undefined : Buffer.concat(chunks))
    } catch { return fail(503) }
  }
}
export default createFirebaseAuthProxy()
