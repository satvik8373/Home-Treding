import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestContext } from 'node:test'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { createFirebaseAuthProxy } from '../api/firebase-auth.ts'
import { createRedirectCompletion, needsGoogleRedirect, signInDeadline } from '../src/lib/google-flow.ts'

async function serve(t: TestContext, handler: Parameters<typeof createServer>[1]) {
  const server = createServer(handler)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

test('iPhone Home Screen, iPad desktop mode, mobile and standalone apps use full-page Google redirect', () => {
  const desktop = { userAgent: 'Mozilla/5.0 Windows NT', platform: 'Win32', maxTouchPoints: 0 }
  assert.equal(needsGoogleRedirect(desktop), false)
  assert.equal(needsGoogleRedirect({ ...desktop, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS)' }), true)
  assert.equal(needsGoogleRedirect({ ...desktop, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 }), true)
  assert.equal(needsGoogleRedirect({ ...desktop, standalone: true }), true)
  assert.equal(needsGoogleRedirect({ ...desktop, displayModeStandalone: true }), true)
  assert.equal(needsGoogleRedirect({ ...desktop, userAgent: 'Mozilla/5.0 Android' }), true)
})

test('redirect completion exchanges a fresh identity once without an existing dashboard refresh grant', async () => {
  let reads = 0, exchanges = 0
  const complete = createRedirectCompletion(async () => { reads++; return async () => 'fresh-firebase-id-token' }, async token => { assert.equal(token, 'fresh-firebase-id-token'); exchanges++ })
  assert.deepEqual(await Promise.all([complete(), complete()]), [true, true])
  assert.equal(await complete(), true)
  assert.equal(reads, 1); assert.equal(exchanges, 1)
})

test('temporary cookie-exchange failure preserves the redirect result in memory and refreshes the token on explicit retry', async () => {
  let reads = 0, tokens = 0, attempts = 0
  const complete = createRedirectCompletion(async () => { reads++; return async () => 'fresh-token-' + ++tokens }, async token => { attempts++; if (attempts === 1) throw Error('Temporary network failure'); assert.equal(token, 'fresh-token-2') })
  await assert.rejects(complete(), /Temporary network/)
  assert.equal(await complete(), true)
  assert.equal(reads, 1); assert.equal(attempts, 2)
  let exchanges = 0
  assert.equal(await createRedirectCompletion(async () => null, async () => { exchanges++ })(), false)
  assert.equal(exchanges, 0, 'a normal visit with no redirect must not create a login')
})

test('a stalled auth helper has a bounded wait and its eventual completion remains recoverable', async () => {
  let release!: (value: boolean) => void
  const pending = new Promise<boolean>(resolve => { release = resolve })
  await assert.rejects(signInDeadline(pending, 5), /taking too long/)
  release(true)
  assert.equal(await signInDeadline(pending), true)
})

test('same-origin Firebase proxy uses fixed helpers and never forwards dashboard authentication or accepts upstream cookies', async t => {
  let calls = 0
  const root = await serve(t, createFirebaseAuthProxy(async (input, options) => {
    calls++; const target = new URL(String(input)), headers = new Headers(options?.headers)
    assert.equal(target.origin, 'https://mavrix-trading.firebaseapp.com')
    assert.equal(target.pathname, '/__/auth/iframe')
    assert.equal(target.searchParams.get('apiKey'), 'public-web-id')
    assert.equal(target.searchParams.has('resource'), false)
    for (const name of ['cookie', 'authorization', 'x-009-gateway-secret', 'x-009-workspace']) assert.equal(headers.get(name), null)
    assert.equal(options?.redirect, 'manual')
    return new Response('<html>Firebase helper</html>', { headers: { 'content-type': 'text/html', 'set-cookie': '__Host-n009=must-not-forward; Secure; Path=/' } })
  }))
  const response = await fetch(root + '/api/firebase-auth?resource=iframe&apiKey=public-web-id', { headers: { cookie: '__Host-n009=private-session; __Host-n009-refresh=private-grant', authorization: 'Bearer private-token', 'x-009-gateway-secret': 'private-gateway-secret' } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(await response.text(), /Firebase helper/)
  for (const resource of ['../gateway', '//evil.example', 'https://evil.example', 'unknown.js']) assert.equal((await fetch(root + '/api/firebase-auth?resource=' + encodeURIComponent(resource))).status, 404)
  assert.equal(calls, 1)
})

test('helper proxy preserves bounded POST data and rejects redirects, unsupported methods and excessive bodies', async t => {
  let redirect = false, calls = 0
  const root = await serve(t, createFirebaseAuthProxy(async (input, options) => {
    calls++; assert.equal(new URL(String(input)).pathname, '/__/auth/handler')
    assert.equal(options?.method, 'POST')
    assert.equal(Buffer.from(options!.body as ArrayBuffer).toString(), 'code=test-only&state=test-only')
    return redirect ? new Response(null, { status: 302, headers: { location: 'https://evil.example/' } }) : new Response('helper')
  }))
  const post = (body: string) => fetch(root + '/api/firebase-auth?resource=handler', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  assert.equal((await post('code=test-only&state=test-only')).status, 200)
  redirect = true
  const denied = await post('code=test-only&state=test-only')
  assert.equal(denied.status, 502); assert.equal(denied.headers.get('location'), null)
  assert.equal((await post('x'.repeat(129 * 1024))).status, 413)
  assert.equal((await fetch(root + '/api/firebase-auth?resource=handler', { method: 'DELETE' })).status, 405)
  assert.equal(calls, 2)
})

test('PWA worker never intercepts auth helpers or trading APIs and reports offline navigation without cached trading data', async () => {
  const handlers: Record<string, (event: any) => void> = {}; let fetches = 0, offline = false
  runInNewContext(await readFile('public/sw.js', 'utf8'), { URL, Response, self: { location: { origin: 'https://home-treding.vercel.app' }, addEventListener(name: string, fn: (event: any) => void) { handlers[name] = fn }, skipWaiting() {}, clients: { claim() {} } }, fetch: async () => { fetches++; if (offline) throw Error('Offline'); return new Response('fresh app shell') } })
  const visit = async (path: string): Promise<Response | null> => {
    let response: Promise<Response> | null = null
    handlers.fetch({ request: { url: 'https://home-treding.vercel.app' + path, method: 'GET', mode: 'navigate' }, respondWith(value: Promise<Response>) { response = value } })
    return response ? await response : null
  }
  assert.equal(await visit('/api/state'), null)
  assert.equal(await visit('/__/auth/handler'), null)
  assert.equal(fetches, 0)
  assert.equal(await (await visit('/'))!.text(), 'fresh app shell')
  offline = true
  const result = await visit('/login')
  assert.equal(result!.status, 503); assert.equal(result!.headers.get('cache-control'), 'no-store')
  assert.match(await result!.text(), /current trading status is unavailable/)
})
