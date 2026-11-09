import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Controller } from '../server/controller.ts'
import { BrokerError, MStock } from '../server/broker.ts'
import { fixture, DAY } from './helpers.ts'
import { istTime } from '../server/time.ts'
import { createApp } from '../server/http.ts'
import type { AddressInfo } from 'node:net'

test('transient startup verification retries without another login, clearing credentials or placing orders', async () => {
  const f = await fixture(); let fail = true, checks = 0
  f.broker.verifyAccount = async () => { checks++; if (fail) throw new Error('Temporary timeout') }
  const controller = new Controller(f.broker, f.store, f.feed, f.now)
  await controller.restore()
  assert.equal(controller.connected(), false)
  assert.equal(controller.snapshot().broker.connection?.phase, 'retrying')
  assert.ok(f.store.savedBroker)
  await controller.pump(); assert.equal(checks, 1)
  fail = false; f.setTime(f.now() + 5000); await controller.pump()
  assert.equal(controller.connected(), true); assert.equal(checks, 2)
  assert.equal(controller.snapshot().broker.connection?.phase, 'connected')
  assert.equal(f.broker.submitted.length, 0)
})

test('accepted verification token survives a temporary funds failure and OTP is not submitted twice', async () => {
  const f = await fixture(); let verifies = 0, fail = true
  f.controller.broker.login = async () => {}
  f.controller.broker.verify = async () => { verifies++; return { ...f.broker.credentials!, accessToken: 'fresh-token' } }
  const id = await f.controller.beginLogin('CLIENT', 'password', 'key')
  f.broker.verifyAccount = async () => { if (fail) throw new Error('502') }
  await f.controller.verifyLogin(id, '123456', 'otp')
  assert.equal(f.store.savedBroker?.accessToken, 'fresh-token')
  assert.equal(f.controller.snapshot().broker.connection?.phase, 'retrying')
  fail = false; f.setTime(f.now() + 5000); await f.controller.pump()
  assert.equal(f.controller.connected(), true); assert.equal(verifies, 1)
  assert.doesNotMatch(JSON.stringify(f.controller.snapshot()), /fresh-token|password|test-key/)
  assert.equal(f.broker.submitted.length, 0)
})

test('expired tokens expose an expiry reason and never attempt automatic login', async () => {
  const f = await fixture(); let checks = 0
  f.setTime(istTime(DAY, '23:59') + 60_000)
  f.broker.verifyAccount = async () => { checks++ }
  const controller = new Controller(f.broker, f.store, f.feed, f.now)
  await controller.restore(); await controller.pump()
  assert.equal(checks, 0)
  assert.equal(controller.snapshot().broker.connection?.phase, 'expired')
  assert.ok(controller.snapshot().broker.expiresAt)
  assert.equal(controller.connected(), false)
})

test('definitive broker rejection does not retry as a transient outage', async () => {
  const f = await fixture(); let checks = 0
  f.broker.verifyAccount = async () => { checks++; throw new BrokerError('Invalid API key', true, true) }
  const controller = new Controller(f.broker, f.store, f.feed, f.now)
  await controller.restore(); f.setTime(f.now() + 120_000); await controller.pump()
  assert.equal(checks, 1)
  assert.equal(controller.snapshot().broker.connection?.phase, 'rejected')
})

test('a late startup check cannot overwrite a newer manually verified login', async () => {
  const f = await fixture(); let release!: () => void, checks = 0
  const delayed = new Promise<void>(resolve => { release = resolve })
  f.broker.verifyAccount = async () => { if (++checks === 1) await delayed }
  const controller = new Controller(f.broker, f.store, f.feed, f.now)
  const restoring = controller.restore()
  controller.broker.login = async () => {}
  controller.broker.verify = async () => ({ ...f.broker.credentials!, account: 'new-account', accessToken: 'new-token' })
  const id = await controller.beginLogin('CLIENT', 'password', 'key')
  await controller.verifyLogin(id, '123456', 'otp'); release(); await restoring
  assert.equal(controller.snapshot().broker.account, 'new-account')
  assert.equal(controller.connected(), true)
})

test('only authentication errors invalidate login; 502/429 do not and POSTs are never retried', async () => {
  for (const [status, type, expected] of [[401, 'TokenException', true], [403, 'APIKeyException', true], [403, 'MiraeException', false], [502, 'GeneralException', false], [429, '', false]] as const) {
    let calls = 0, invalidations = 0
    const b = new MStock(async () => { calls++; return new Response(JSON.stringify({ status: 'error', message: 'Broker failure', error_type: type }), { status }) })
    b.credentials = { account: 'a', name: 'Test', apiKey: 'key', accessToken: 'token', expiresAt: Date.now() + 60_000 }
    b.onAuthFailure = () => { invalidations++ }
    await assert.rejects(b.request('/orders/regular', 'POST', { quantity: '1' }), (e: unknown) => e instanceof BrokerError && e.authentication === expected)
    assert.equal(invalidations, expected ? 1 : 0); assert.equal(calls, 1)
  }
})

test('first Type A Authenticator connection uses the official key and TOTP endpoint without password login', async () => {
  const f = await fixture(); let verifications = 0
  f.controller.broker.login = async () => { throw Error('Password login must not be called') }
  f.controller.broker.verify = async (key, code, method, expected) => {
    verifications++; assert.equal(key, 'new-private-key'); assert.equal(code, '123456'); assert.equal(method, 'totp'); assert.equal(expected, '')
    return { ...f.broker.credentials!, apiKey: key, accessToken: 'new-private-token', account: 'new-account' }
  }
  const flow = await f.controller.beginTotp('new-private-key')
  await assert.rejects(f.controller.verifyLogin(flow, '123456', 'otp'), /Authenticator/)
  assert.equal(verifications, 0)
  await f.controller.verifyLogin(flow, '123456', 'totp')
  assert.equal(verifications, 1)
  assert.equal(f.controller.connected(), true)
  assert.deepEqual(f.controller.snapshot().broker.linked, { account: 'new-account', name: 'Test', totpRenewal: true })
  assert.doesNotMatch(JSON.stringify(f.controller.snapshot()), /new-private-key|new-private-token|123456/)
  assert.equal(f.broker.submitted.length, 0)
})

test('expired Authenticator connection renews with saved server key and retains the exact day-session and history', async () => {
  const f = await fixture()
  f.broker.credentials!.authMethod = 'totp'
  await f.start('paper')
  const before = structuredClone(f.controller.session!)
  f.setTime(istTime(DAY, '23:59') + 60_000)
  await f.controller.pump()
  assert.equal(f.controller.connected(), false)
  assert.equal(f.controller.snapshot().broker.linked?.account, 'test-account')
  const awaitingVerification = structuredClone(f.controller.session!)
  f.controller.broker.login = async () => { throw Error('Saved renewal must not request password') }
  f.controller.broker.verify = async (key, _code, method, expected) => {
    assert.equal(key, 'test-key'); assert.equal(method, 'totp'); assert.equal(expected, 'test-account')
    return { ...f.broker.credentials!, expiresAt: f.now() + 3600_000 }
  }
  const flow = await f.controller.beginTotp()
  await f.controller.verifyLogin(flow, '123456', 'totp')
  assert.deepEqual(f.controller.session, awaitingVerification)
  assert.equal(f.controller.session!.id, before.id)
  assert.deepEqual(f.controller.session!.legs, before.legs)
  assert.deepEqual(f.controller.session!.trades, before.trades)
  assert.deepEqual(f.controller.session!.settings, before.settings)
  assert.equal(f.controller.connected(), true)
  assert.equal(f.broker.submitted.length, 0)
})

test('saved Authenticator renewal rejects a different broker account before credentials or ownership are changed', async () => {
  const f = await fixture()
  f.broker.credentials!.authMethod = 'totp'; f.broker.credentials!.expiresAt = f.now() - 1
  const original = structuredClone(f.store.savedBroker)
  let claims = 0
  f.controller.authorizeBroker = () => { claims++ }
  f.controller.broker.verify = async () => ({ ...f.broker.credentials!, account: 'wrong-account', expiresAt: f.now() + 3600_000 })
  const flow = await f.controller.beginTotp()
  await assert.rejects(f.controller.verifyLogin(flow, '123456', 'totp'), /does not match/)
  assert.equal(claims, 0)
  assert.deepEqual(f.store.savedBroker, original)
  assert.equal(f.broker.submitted.length, 0)
})

test('saved renewal is unavailable without a linked TOTP account or while a valid connection is already active', async () => {
  const f = await fixture()
  await assert.rejects(f.controller.beginTotp(), /No saved Authenticator/)
  f.broker.credentials!.authMethod = 'totp'
  await assert.rejects(f.controller.beginTotp(), /already active/)
  await f.start('paper')
  await assert.rejects(f.controller.beginTotp('replacement-key'), /Stop the strategy/)
  assert.equal(f.broker.submitted.length, 0)
})

test('TOTP connection HTTP requires CSRF, keeps saved key server-side, and shares login rate limits', async t => {
  const f = await fixture()
  f.broker.credentials!.authMethod = 'totp'; f.broker.credentials!.expiresAt = f.now() - 1
  await f.controller.restore()
  f.controller.broker.verify = async (key, _code, method) => {
    assert.equal(key, 'test-key'); assert.equal(method, 'totp')
    return { ...f.broker.credentials!, accessToken: 'renewed-test-token', expiresAt: f.now() + 3600_000 }
  }
  const server = createApp(f.controller, process.cwd()).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const state = await (await fetch(root + '/api/state')).json()
  const post = (path: string, body: object, csrf = state.csrf) => fetch(root + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-009-csrf': csrf }, body: JSON.stringify(body) })
  assert.equal((await post('/api/broker/totp', { useSaved: true }, '')).status, 403)
  const response = await post('/api/broker/totp', { useSaved: true, apiKey: 'injected-browser-key' })
  assert.equal(response.status, 200)
  const flow = await response.json()
  assert.deepEqual(Object.keys(flow), ['flowId'])
  assert.equal((await post('/api/broker/verify', { flowId: flow.flowId, code: '123456', method: 'totp' })).status, 200)
  const snapshot = await (await fetch(root + '/api/state')).text()
  assert.doesNotMatch(snapshot, /test-key|renewed-test-token/)
  for (let i = 0; i < 4; i++) assert.equal((await post('/api/broker/totp', { useSaved: true })).status, 400)
  assert.equal((await post('/api/broker/login', { username: 'a', password: 'b', apiKey: 'c' })).status, 429)
  assert.equal(f.broker.submitted.length, 0)
})
