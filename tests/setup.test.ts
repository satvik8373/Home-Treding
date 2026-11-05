import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { ExecutionNetwork, observeExecutionIPv4, publicIPv4 } from '../server/setup.ts'
import { MemoryRepository } from '../server/backtest/service.ts'
import { createApp } from '../server/http.ts'
import { fixture } from './helpers.ts'

test('execution IP lookup uses a fixed credential-free endpoint and rejects private, malformed or oversized data', async () => {
  let received: RequestInit | undefined
  assert.equal(await observeExecutionIPv4(async (url, options) => {
    assert.equal(url, 'https://api.ipify.org'); received = options
    return new Response('1.1.1.1\n')
  }), '1.1.1.1')
  assert.equal(received!.redirect, 'error')
  assert.deepEqual(received!.headers, { accept: 'text/plain' })
  for (const value of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '100.64.0.1', '169.254.1.1', '172.16.1.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '::1', '<html>error</html>', '1.1.1.1/' ]) {
    assert.equal(publicIPv4(value), false)
    await assert.rejects(observeExecutionIPv4(async () => new Response(value)))
  }
  await assert.rejects(observeExecutionIPv4(async () => new Response('x'.repeat(1024))))
  await assert.rejects(observeExecutionIPv4(async () => new Response('error', { status: 503 })))
})

test('IP references are scoped to both broker account and API key and never assert broker approval', async () => {
  const repo = new MemoryRepository()
  let owner: { account: string; apiKey: string } | null = { account: 'one', apiKey: 'private-key-one' }
  const service = new ExecutionNetwork(repo, () => owner, () => ({ N009_EXECUTION_LOCATION: 'hosted', N009_EXECUTION_IPV4: '1.1.1.1' }), async () => '1.1.1.1')
  const identity = await service.read()
  service.save({ primary: '1.1.1.1', secondary: '8.8.8.8', account: identity.account, connectionScope: identity.connectionScope })
  const report = await service.read()
  assert.equal(report.location, 'hosted'); assert.equal(report.registeredMatch, true); assert.equal(report.expectedMatch, true)
  assert.equal(report.brokerRegistrationVerified, false); assert.equal(report.registrationSource, 'user-entered')
  assert.equal(JSON.stringify(report).includes('private-key'), false)
  assert.equal(repo.keys('setup:').join().includes('private-key'), false)
  owner = { account: 'one', apiKey: 'different-key' }; assert.equal((await service.read()).profile, null)
  assert.throws(() => service.save({ primary: '1.1.1.1', account: identity.account, connectionScope: identity.connectionScope }), /connection changed/)
  owner = { account: 'two', apiKey: 'private-key-one' }; assert.equal((await service.read()).profile, null)
  owner = null; assert.throws(() => service.save({ primary: '1.1.1.1' }), /Connect/)
  owner = { account: 'one', apiKey: 'private-key-one' }
  assert.throws(() => service.save({ primary: '127.0.0.1', account: identity.account, connectionScope: identity.connectionScope }), /public IPv4/)
  assert.throws(() => service.save({ primary: '1.1.1.1', secondary: '1.1.1.1', account: identity.account, connectionScope: identity.connectionScope }), /differ/)
})

test('concurrent reads share cached engine observation; IP changes and failed refreshes cannot look verified', async () => {
  const repo = new MemoryRepository(); let now = 1, calls = 0, ip = '1.1.1.1'
  const service = new ExecutionNetwork(repo, () => ({ account: 'one', apiKey: 'key' }), () => ({ N009_EXECUTION_IPV4: '8.8.8.8' }), async () => { calls++; if (ip === 'fail') throw new Error('private-error'); return ip }, () => now)
  const identity = await service.read()
  service.save({ primary: '1.1.1.1', account: identity.account, connectionScope: identity.connectionScope })
  const results = await Promise.all([service.read(), service.read(), service.read()])
  assert.equal(calls, 1); assert.equal(results[0].expectedMatch, false)
  ip = '8.8.8.8'; now += 30_001
  const changed = await service.read()
  assert.equal(changed.observed!.changed, true); assert.equal(changed.registeredMatch, false); assert.equal(changed.expectedMatch, true)
  ip = 'fail'; now += 30_001
  const failed = await service.read()
  assert.equal(failed.current, false); assert.equal(failed.registeredMatch, null); assert.equal(failed.expectedMatch, null)
  assert.equal(failed.observed!.ipv4, '8.8.8.8'); assert.equal(failed.error!.includes('private-error'), false)
  await service.read(); assert.equal(calls, 3)
})

test('network setup HTTP requires gateway authentication and CSRF; checking and saving cannot place broker orders', async t => {
  const f = await fixture(), repo = new MemoryRepository(), secret = 'x'.repeat(40)
  const app = createApp(f.controller, process.cwd(), 4310, repo, secret, async () => '1.1.1.1')
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`, headers = { 'x-009-gateway-secret': secret }
  assert.equal((await fetch(`${root}/api/setup/network`)).status, 401)
  const state = await (await fetch(`${root}/api/state`, { headers })).json() as { csrf: string }
  const identity = await (await fetch(`${root}/api/setup/network`, { headers })).json()
  const post = (csrf: string) => fetch(`${root}/api/setup/network`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'x-009-csrf': csrf }, body: JSON.stringify({ primary: '1.1.1.1', account: identity.account, connectionScope: identity.connectionScope }) })
  assert.equal((await post('')).status, 403); assert.equal((await post(state.csrf)).status, 200)
  const report = await (await fetch(`${root}/api/setup/network`, { headers })).json()
  assert.equal(report.registeredMatch, true)
  assert.equal(JSON.stringify(report).includes(secret), false)
  assert.equal(JSON.stringify(report).includes('test-key'), false)
  assert.equal(f.broker.submitted.length, 0); assert.equal(f.broker.cancellations.length, 0)
})
