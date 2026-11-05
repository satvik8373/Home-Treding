import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CloudCipher } from '../server/cloud/crypto.ts'
import { CloudStore } from '../server/cloud/store.ts'
import { fixture } from './helpers.ts'
import { createGateway } from '../api/gateway.ts'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

test('cloud ciphertext authenticates queued credentials and durable records without exposing plaintext', () => {
  const cipher = new CloudCipher('c'.repeat(64)), privateValue = { password: 'private-login-password', apiKey: 'private-broker-key', value: 5 }
  const encrypted = cipher.seal(privateValue)
  assert.equal(JSON.stringify(encrypted).includes(privateValue.password), false)
  assert.deepEqual(cipher.open(encrypted), privateValue)
  assert.throws(() => new CloudCipher('d'.repeat(64)).open(encrypted))
  assert.throws(() => cipher.open({ ...encrypted, data: Buffer.from('tampered').toString('base64') }))
  assert.throws(() => new CloudCipher('short'))
})

test('cloud checkpoint waits for writes during a commit and retries a failed commit without falsely marking it durable', async t => {
  let persisted: Record<string, unknown> = {}, calls = 0, release: () => void = () => {}, fail = false
  const store = new CloudStore(mkdtempSync(join(tmpdir(), 'n009-cloud-test-')), Buffer.alloc(32, 1), {}, async records => {
    calls++
    if (calls === 1) await new Promise<void>(resolve => { release = resolve })
    if (fail) throw new Error('storage unavailable')
    persisted = records
  })
  t.after(() => store.close())
  store.put('one', 1); const first = store.persist(); store.put('two', 2); release(); await first
  assert.equal(calls, 2); assert.deepEqual(persisted, { one: 1, two: 2 })
  fail = true; store.put('three', 3); await assert.rejects(store.persist(), /storage/)
  fail = false; await store.persist(); assert.equal((persisted as Record<string, unknown>).three, 3)
  store.saveBroker({ account: 'test', name: 'Test', apiKey: 'test-key', accessToken: 'test-token', expiresAt: Date.now() + 1000 })
  await store.persist(); assert.equal(JSON.stringify(persisted).includes('test-token'), false)
  store.saveBroker(null); await store.persist(); assert.equal('broker' in persisted, false)
})

test('hosted execution guard rejects Live before any broker submission; local fixtures retain existing behavior', async () => {
  const f = await fixture()
  f.controller.execution = { kind: 'hosted-paper', liveExecution: false, reason: 'Stable egress required.' }
  await assert.rejects(f.controller.start('live'), /Stable egress/)
  assert.equal(f.broker.submitted.length, 0)
  await f.start('paper'); assert.equal(f.controller.session!.mode, 'paper')
  assert.equal(f.controller.snapshot().runtime!.liveExecution, false)
})

test('cloud gateway authenticates requests and preserves command CSRF without requiring an external engine URL', async t => {
  const env = { N009_ENGINE_TRANSPORT: 'cloud', DATABASE_URL: 'postgresql://unit.invalid/test', N009_STATE_KEY: 'e'.repeat(64), N009_GATEWAY_SECRET: 'f'.repeat(40), N009_DASHBOARD_PASSWORD: 'p'.repeat(32) }
  let calls = 0
  const server = createServer(createGateway(() => env, async () => { throw new Error('must not use external relay') }, async request => {
    calls++; assert.equal(request.route, 'strategy/settings'); assert.equal(request.csrf, 'scoped-csrf')
    return { status: 200, headers: { 'content-type': 'application/json' }, body: '{"saved":true}' }
  })).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  assert.equal((await fetch(`${root}/api/gateway?route=state`)).status, 401); assert.equal(calls, 0)
  const login = await fetch(`${root}/api/gateway?route=access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: env.N009_DASHBOARD_PASSWORD }) })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const response = await fetch(`${root}/api/gateway?route=strategy/settings`, { method: 'POST', headers: { cookie, 'content-type': 'application/json', 'x-009-csrf': 'scoped-csrf' }, body: '{}' })
  assert.equal(response.status, 200); assert.equal(calls, 1)
})
