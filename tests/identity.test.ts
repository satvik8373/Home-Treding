import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { TestContext } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createGateway } from '../api/gateway.ts'
import { openIdentity, sealIdentity, tenantId } from '../shared/identity.ts'
import { Workspaces } from '../server/workspaces.ts'
import type { Workspace } from '../server/workspaces.ts'
import { Store } from '../server/store.ts'
import { Controller } from '../server/controller.ts'
import { MarketFeed } from '../server/feed.ts'
import { createApp } from '../server/http.ts'
import { FakeBroker } from './helpers.ts'
import { generateKeyPair, SignJWT } from 'jose'
import { createGoogleVerifier } from '../server/auth/firebase.ts'

const secret = 'test-gateway-secret-'.repeat(3)
const env = { N009_ENGINE_ORIGIN: 'https://engine.example.test', N009_GATEWAY_SECRET: secret, N009_DASHBOARD_PASSWORD: 'owner-only-password'.repeat(2), N009_MULTIUSER: 'true', N009_FIREBASE_PROJECT_ID: 'test-project' }
async function serve(t: TestContext, handler: Parameters<typeof createServer>[1]) {
  const server = createServer(handler)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
const assertion = (id: string) => ({ 'x-009-gateway-secret': secret, 'x-009-workspace': sealIdentity({ tenant: id, expires: Date.now() + 60_000 }, secret, 'engine') })

test('Firebase verification checks cryptographic signature, project, issuer, expiry, Google provider and recent authentication', async () => {
  const keys = await generateKeyPair('RS256'), attacker = await generateKeyPair('RS256')
  const verify = createGoogleVerifier(async () => keys.publicKey), now = Math.floor(Date.now() / 1000)
  const mint = (changes: Record<string, unknown> = {}, key = keys.privateKey) => new SignJWT({ firebase: { sign_in_provider: 'google.com' }, email_verified: true, auth_time: now, sub: 'alice', iat: now, exp: now + 3600, aud: 'test-project', iss: 'https://securetoken.google.com/test-project', ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key)
  assert.equal((await verify(await mint(), 'test-project')).uid, 'alice')
  for (const changes of [{ aud: 'wrong-project' }, { iss: 'https://attacker.test' }, { exp: now - 1 }, { firebase: { sign_in_provider: 'password' } }, { email_verified: false }, { auth_time: now - 301 }, { auth_time: now + 10 }, { sub: '' }, { iat: now + 10 }]) await assert.rejects(verify(await mint(changes), 'test-project'))
  await assert.rejects(verify(await mint({}, attacker.privateKey), 'test-project'))
})

test('Google tokens are verified server-side and browser-supplied tenant headers never select a workspace', async t => {
  const calls: RequestInit[] = []
  const root = await serve(t, createGateway(() => env, async (url, options) => { if (String(url).endsWith('/api/health')) return Response.json({ workspaceIsolation: true }); calls.push(options!); return Response.json({ ok: true }) }, undefined, async (token, project) => {
    assert.equal(project, 'test-project')
    if (!['user-a-token', 'user-b-token'].includes(token)) throw Error('Invalid signature')
    return { uid: token, expires: Date.now() + 3600_000, name: 'Verified account', email: 'verified@example.test' }
  }))
  const cookies = []
  for (const token of ['user-a-token', 'user-b-token']) {
    const response = await fetch(`${root}/api/access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token, uid: 'owner' }) })
    assert.equal(response.status, 200)
    const cookie = response.headers.get('set-cookie')!.split(';')[0]; cookies.push(cookie)
    const profile = await (await fetch(`${root}/api/access`, { headers: { cookie } })).json() as { user: { name: string; email: string; kind: string } }
    assert.deepEqual({ name: profile.user.name, email: profile.user.email, kind: profile.user.kind }, { name: 'Verified account', email: 'verified@example.test', kind: 'google' })
    assert.equal((await fetch(`${root}/api/state`, { headers: { cookie, 'x-009-workspace': assertion('owner')['x-009-workspace'] } })).status, 200)
  }
  const identities = calls.map(call => openIdentity(new Headers(call.headers).get('x-009-workspace')!, secret, 'engine')!)
  assert.notEqual(identities[0].tenant, identities[1].tenant)
  assert.equal(identities[0].tenant, tenantId('test-project:user-a-token'))
  assert.notEqual(identities[0].tenant, 'owner')
  assert.equal((await fetch(`${root}/api/access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'forged' }) })).status, 401)
  assert.equal((await fetch(`${root}/api/state`, { headers: { cookie: cookies[0] + 'forged' } })).status, 401)
  assert.equal((await fetch(`${root}/api/access`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://attacker.test' }, body: JSON.stringify({ idToken: 'user-a-token' }) })).status, 403)
})

test('Google access fails closed when the transport, project or engine isolation changes', async t => {
  let settings = { ...env }, calledState = false
  const root = await serve(t, createGateway(() => settings, async url => { if (String(url).includes('/state')) calledState = true; return Response.json({ ok: true }) }, undefined, async () => ({ uid: 'alice', expires: Date.now() + 3600_000 })))
  const login = await fetch(`${root}/api/access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'valid-test-token' }) })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  assert.equal((await fetch(`${root}/api/state`, { headers: { cookie } })).status, 503)
  assert.equal(calledState, false)
  settings = { ...settings, N009_MULTIUSER: 'false' }
  assert.equal((await fetch(`${root}/api/state`, { headers: { cookie } })).status, 401)
  settings = { ...env, N009_FIREBASE_PROJECT_ID: 'other-project' }
  assert.equal((await fetch(`${root}/api/state`, { headers: { cookie } })).status, 401)
})

test('workspace signatures reject expired, traversal, wrong-purpose and altered claims', () => {
  for (const token of [sealIdentity({ tenant: '../owner', expires: Date.now() + 1000 }, secret, 'engine'), sealIdentity({ tenant: 'owner', expires: Date.now() - 1 }, secret, 'engine'), sealIdentity({ tenant: 'owner', expires: Date.now() + 1000 }, secret, 'dashboard'), assertion('owner')['x-009-workspace'] + '.extra']) assert.equal(openIdentity(token, secret, 'engine'), null)
})

test('two workspaces isolate settings, CSRF, encrypted broker files, archives, and account ownership across restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-tenants-'))
  const created: Workspace[] = []
  const factory = (directory: string): Workspace => {
    const store = new Store(directory), broker = new FakeBroker(), feed = new MarketFeed()
    broker.credentials = null
    const controller = new Controller(broker, store, feed)
    const workspace = { controller, store, feed, app: createApp(controller, process.cwd(), 4310, store, secret) }
    created.push(workspace); return workspace
  }
  let host = new Workspaces(directory, secret, 2, factory)
  await host.restore()
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  const root = await serve(t, (req, res) => host.app(req, res))
  const a = tenantId('alice'), b = tenantId('bob')
  const read = async (id: string, path: string) => { const response = await fetch(root + path, { headers: assertion(id) }); assert.equal(response.status, 200); return response.json() as Promise<Record<string, any>> }
  const stateA = await read(a, '/api/state'), stateB = await read(b, '/api/state')
  assert.notEqual(stateA.csrf, stateB.csrf)
  const settings = (await read(a, '/api/strategy/settings')).saved
  const headers = { ...assertion(a), 'content-type': 'application/json', 'x-009-csrf': stateB.csrf }
  assert.equal((await fetch(root + '/api/strategy/settings', { method: 'POST', headers, body: JSON.stringify(settings) })).status, 403)
  const next = { ...settings, entryLots: settings.entryLots + 1 }
  assert.equal((await fetch(root + '/api/strategy/settings', { method: 'POST', headers: { ...headers, 'x-009-csrf': stateA.csrf }, body: JSON.stringify(next) })).status, 200)
  assert.deepEqual((await read(b, '/api/strategy/settings')).saved, settings)
  created[1].store.put('backtest:archive:private', { source: 'alice-private' })
  assert.equal(created[2].store.get('backtest:archive:private'), null)
  created[1].controller.authorizeBroker!('same-broker')
  assert.throws(() => created[2].controller.authorizeBroker!('same-broker'), /another workspace/)
  const keyA = await readFile(join(directory, 'tenants', a, 'session.key')), keyB = await readFile(join(directory, 'tenants', b, 'session.key'))
  assert.notDeepEqual(keyA, keyB)
  assert.equal((await fetch(root + '/api/state', { headers: { 'x-009-gateway-secret': secret } })).status, 401)
  assert.equal((await fetch(root + '/api/state', { headers: assertion(tenantId('third')) })).status, 503)
  await host.close(); host = new Workspaces(directory, secret, 2, factory); await host.restore()
  assert.deepEqual((await read(a, '/api/strategy/settings')).saved, next)
  assert.deepEqual((await read(b, '/api/strategy/settings')).saved, settings)
})

test('remembered Google session renews only with a valid same-user grant and logout clears both cookies', async t => {
  const modes: boolean[] = []
  const root = await serve(t, createGateway(() => env, undefined, undefined, async (uid, _project, renewing) => {
    modes.push(renewing === true)
    return { uid, expires: Date.now() + 3600_000 }
  }))
  const post = (body: object, cookie = '') => fetch(root + '/api/access', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) })
  const login = await post({ idToken: 'alice' })
  assert.equal(login.status, 200)
  const cookies = login.headers.getSetCookie()
  assert.equal(cookies.length, 2)
  const grant = cookies.find(cookie => cookie.startsWith('__Host-n009-refresh='))!
  assert.match(grant, /HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=604800/)
  const grantCookie = grant.split(';')[0]
  const refresh = await post({ idToken: 'alice', resume: true }, grantCookie)
  assert.equal(refresh.status, 200)
  assert.equal(refresh.headers.getSetCookie().length, 1, 'renewal never extends the seven-day grant')
  assert.deepEqual(modes, [false, true])
  assert.equal((await post({ idToken: 'bob', resume: true }, grantCookie)).status, 401)
  const count = modes.length
  assert.equal((await post({ idToken: 'alice', resume: true })).status, 401)
  assert.equal(modes.length, count, 'a client resume flag alone cannot bypass recent authentication')
  assert.equal((await post({ idToken: 'alice', resume: true }, grantCookie + 'forged')).status, 401)
  const expired = sealIdentity({ tenant: tenantId('test-project:alice'), expires: Date.now() - 1 }, secret, 'refresh:test-project')
  assert.equal((await post({ idToken: 'alice', resume: true }, `__Host-n009-refresh=${expired}`)).status, 401)
  const logout = await fetch(root + '/api/access', { method: 'DELETE', headers: { 'content-type': 'application/json', cookie: grantCookie }, body: '{}' })
  assert.equal(logout.headers.getSetCookie().length, 2)
  assert.ok(logout.headers.getSetCookie().every(cookie => cookie.includes('Max-Age=0')))
})

test('silent renewal accepts refreshed Google tokens but retains fresh issuance and cryptographic checks', async () => {
  const keys = await generateKeyPair('RS256'), now = Math.floor(Date.now() / 1000)
  const verify = createGoogleVerifier(async () => keys.publicKey)
  const mint = (changes = {}) => new SignJWT({ firebase: { sign_in_provider: 'google.com' }, email_verified: true, auth_time: now - 86400, sub: 'alice', iat: now, exp: now + 3600, aud: 'test-project', iss: 'https://securetoken.google.com/test-project', ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(keys.privateKey)
  await assert.rejects(verify(await mint(), 'test-project'))
  assert.equal((await verify(await mint(), 'test-project', true)).uid, 'alice')
  await assert.rejects(verify(await mint({ iat: now - 301 }), 'test-project', true))
  await assert.rejects(verify(await mint({ auth_time: now + 10 }), 'test-project', true))
  await assert.rejects(verify(await mint({ email_verified: false }), 'test-project', true))
})

test('fresh broker verification moves only a stopped flat connection and preserves private workspace history', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-transfer-')), created: Workspace[] = []
  const factory = (path: string): Workspace => {
    const store = new Store(path), broker = new FakeBroker()
    broker.credentials = null
    const feed = { status: 'disconnected' as 'disconnected' | 'connected', lastTickAt: null, onMark: (_mark: import('../shared/model.ts').Mark) => {}, onChange: () => {}, connect() { this.status = 'connected' }, close() { this.status = 'disconnected' } }
    const controller = new Controller(broker, store, feed)
    const workspace = { controller, store, feed, app: createApp(controller, process.cwd(), 4310, store, secret) }
    created.push(workspace); return workspace
  }
  const host = new Workspaces(directory, secret, 2, factory)
  await host.restore()
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  const root = await serve(t, (req, res) => host.app(req, res))
  await fetch(root + '/api/state', { headers: assertion(tenantId('alice')) })
  const [source, destination] = created
  const credentials = { apiKey: 'private-key', accessToken: 'private-token', name: 'Test', account: 'broker-1', expiresAt: Date.now() + 3600_000 }
  source.store.saveBroker(credentials); source.controller.broker.credentials = credentials
  source.controller.authorizeBroker!(credentials.account)
  source.store.put('private-history', { ownerOnly: true })
  assert.throws(() => destination.controller.authorizeBroker!(credentials.account), /another workspace/)
  source.controller.session = { id: 'original-session', date: '2026-11-06', mode: 'paper', account: credentials.account, status: 'running', message: '', atm: null, expiry: null, legs: {}, pending: null, trades: [], activity: [], pnlVerified: true }
  let verifications = 0
  destination.controller.broker.login = async () => {}
  destination.controller.broker.verify = async () => { verifications++; return credentials }
  const flow = await destination.controller.beginLogin('CLIENT', 'password', 'private-key')
  await assert.rejects(destination.controller.verifyLogin(flow, '123456', 'totp'), /Stop and flatten/)
  assert.ok(source.store.broker(), 'blocked transfer cannot erase the source credentials')
  source.controller.session.status = 'stopped'
  await destination.controller.verifyLogin(flow, '123456', 'totp')
  assert.equal(verifications, 1, 'reuse the verified token rather than consuming the OTP twice')
  assert.equal(source.store.broker(), null)
  assert.equal(source.controller.connected(), false)
  assert.equal(destination.store.broker()!.authMethod, 'totp')
  assert.equal(destination.controller.connected(), true)
  assert.equal(source.controller.session.id, 'original-session')
  assert.equal(destination.store.get('private-history'), null)
  assert.deepEqual(source.store.get('private-history'), { ownerOnly: true })
  assert.throws(() => source.controller.authorizeBroker!(credentials.account), /another workspace/)
  assert.equal((source.controller.broker as FakeBroker).submitted.length, 0)
  assert.equal((destination.controller.broker as FakeBroker).submitted.length, 0)
})
