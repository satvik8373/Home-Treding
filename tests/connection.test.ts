import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Controller } from '../server/controller.ts'
import { BrokerError, MStock } from '../server/broker.ts'
import { fixture, DAY } from './helpers.ts'
import { istTime } from '../server/time.ts'

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
