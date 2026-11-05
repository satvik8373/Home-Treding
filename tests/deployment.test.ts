import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestContext } from 'node:test'
import { createGateway } from '../api/gateway.ts'
import { createApp } from '../server/http.ts'
import { fixture } from './helpers.ts'
import { accessStatus } from '../shared/deployment.ts'

const env = { N009_ENGINE_ORIGIN: 'https://engine.example.test', N009_GATEWAY_SECRET: 'a'.repeat(40), N009_DASHBOARD_PASSWORD: 'b'.repeat(32) }
async function serve(t: TestContext, handler: Parameters<typeof createServer>[1]) {
  const server = createServer(handler)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
async function login(root: string) {
  const response = await fetch(`${root}/api/gateway?route=access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: env.N009_DASHBOARD_PASSWORD }) })
  assert.equal(response.status, 200)
  const cookie = response.headers.get('set-cookie')!
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict; Path=\//)
  return cookie.split(';')[0]
}

test('unconfigured Vercel deployment fails closed with an explicit setup response', async t => {
  const root = await serve(t, createGateway(() => ({}), async () => { throw new Error('must not connect') }))
  const response = await fetch(`${root}/api/gateway?route=state`)
  assert.equal(response.status, 503)
  assert.equal((await response.json() as { configured: boolean }).configured, false)
})

test('dashboard access enables engine requests only for an explicit successful authenticated response', () => {
  assert.equal(accessStatus(503, { configured: false }), 'setup')
  assert.equal(accessStatus(200, { configured: false }), 'setup')
  assert.equal(accessStatus(200, { configured: true, authenticated: false }), 'locked')
  assert.equal(accessStatus(200, { configured: true, authenticated: true }), 'open')
  for (const [status, body] of [[503, { configured: true, authenticated: true }], [401, { configured: true, authenticated: true }], [500, { configured: false }], [200, null], [200, {}], [200, { configured: 'true', authenticated: true }], [200, { configured: true, authenticated: 'true' }], [200, []]] as const) {
    assert.equal(accessStatus(status, body), 'unavailable')
  }
})

test('dashboard login blocks unauthenticated access, wrong passwords, cross-site login and tampered sessions', async t => {
  const root = await serve(t, createGateway(() => env))
  assert.equal((await fetch(`${root}/api/gateway?route=state`)).status, 401)
  const post = (password: string, origin?: string) => fetch(`${root}/api/gateway?route=access`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify({ password }) })
  assert.equal((await post('wrong')).status, 401)
  assert.equal((await post(env.N009_DASHBOARD_PASSWORD, 'https://attacker.example.test')).status, 403)
  const cookie = await login(root)
  const valid = await fetch(`${root}/api/gateway?route=access`, { headers: { cookie } })
  assert.equal((await valid.json() as { authenticated: boolean }).authenticated, true)
  assert.equal((await fetch(`${root}/api/gateway?route=state`, { headers: { cookie: cookie + 'tampered' } })).status, 401)
  const logout = await fetch(`${root}/api/gateway?route=access`, { method: 'DELETE', headers: { cookie, 'content-type': 'application/json' }, body: '{}' })
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/)
})

test('gateway forwards only engine authentication and CSRF, preserving routes, query and JSON body', async t => {
  const calls: { url: string; options?: RequestInit }[] = []
  const root = await serve(t, createGateway(() => env, async (url, options) => { calls.push({ url: String(url), options }); return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }) }))
  const cookie = await login(root)
  const response = await fetch(`${root}/api/gateway?route=backtest/run&symbol=CE`, { method: 'POST', headers: { cookie, 'content-type': 'application/json', 'x-009-csrf': 'csrf-test', authorization: 'never-forward' }, body: '{"startDate":"2026-11-03"}' })
  assert.equal(response.status, 200)
  assert.equal(calls[0].url, 'https://engine.example.test/api/backtest/run?symbol=CE')
  const headers = new Headers(calls[0].options?.headers)
  assert.equal(headers.get('x-009-gateway-secret'), env.N009_GATEWAY_SECRET)
  assert.equal(headers.get('x-009-csrf'), 'csrf-test')
  assert.equal(headers.get('authorization'), null)
  assert.equal(headers.get('cookie'), null)
  assert.equal(calls[0].options?.body, '{"startDate":"2026-11-03"}')
  assert.equal((await fetch(`${root}/api/gateway?route=../state`, { headers: { cookie } })).status, 400)
})

test('gateway connection failures return a sanitized error without environment credentials', async t => {
  const root = await serve(t, createGateway(() => env, async () => { throw new Error(env.N009_GATEWAY_SECRET) }))
  const cookie = await login(root), response = await fetch(`${root}/api/gateway?route=state`, { headers: { cookie } })
  assert.equal(response.status, 502)
  assert.equal((await response.text()).includes(env.N009_GATEWAY_SECRET), false)
})

test('remote engine requires the gateway secret even with a spoofed localhost host; CSRF remains enforced', async t => {
  const f = await fixture(), app = createApp(f.controller, process.cwd(), 4310, undefined, env.N009_GATEWAY_SECRET)
  const root = await serve(t, app)
  assert.equal((await fetch(`${root}/api/state`, { headers: { host: 'localhost:4310' } })).status, 401)
  const headers = { host: 'remote-engine.example.test', 'x-009-gateway-secret': env.N009_GATEWAY_SECRET }
  const response = await fetch(`${root}/api/state`, { headers })
  assert.equal(response.status, 200)
  assert.equal((await response.text()).includes(env.N009_GATEWAY_SECRET), false)
  assert.equal((await fetch(`${root}/api/backtest/run`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })).status, 403)
  assert.equal(f.broker.submitted.length, 0)
})
