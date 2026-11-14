import assert from 'node:assert/strict'
import test from 'node:test'
import { requestDashboardAction, acceptedActionNotice, uncertainActionMessage, DashboardActionError } from '../src/lib/dashboardActions'

test('start uses a single CSRF-protected POST and the chosen mode and strategy', async () => {
  let calls = 0
  const fakeFetch: typeof fetch = async (url, init) => {
    calls++
    assert.equal(url, '/api/strategy/start')
    assert.equal(init?.method, 'POST')
    assert.equal(new Headers(init?.headers).get('X-009-CSRF'), 'test-csrf')
    assert.deepEqual(JSON.parse(String(init?.body)), { mode: 'paper', strategy: 'sell', liveAcknowledged: false })
    return Response.json({ ok: true }, { status: 202 })
  }
  assert.deepEqual(await requestDashboardAction('/api/strategy/start', { mode: 'paper', strategy: 'sell', liveAcknowledged: false }, 'test-csrf', fakeFetch), { ok: true })
  assert.equal(calls, 1)
})
test('missing CSRF prevents sending a mutation', async () => {
  let calls = 0
  await assert.rejects(requestDashboardAction('/api/strategy/start', {}, '', async () => { calls++; return Response.json({ ok: true }) }), /verification is not ready/)
  assert.equal(calls, 0)
})
test('timeout and gateway failures report unknown outcome without retry', async () => {
  for (const fail of ['timeout', 'gateway']) {
    let calls = 0
    await assert.rejects(requestDashboardAction('/api/strategy/start', {}, 'test-csrf', async () => { calls++; if (fail === 'timeout') throw new TypeError('network'); return new Response('<html>502</html>', { status: 502 }) }), { message: uncertainActionMessage })
    assert.equal(calls, 1)
  }
})
test('expired sign-in is detected even when the response is not JSON', async () => {
  await assert.rejects(requestDashboardAction('/api/strategy/start', {}, 'test-csrf', async () => new Response('Sign in', { status: 401 })), error => error instanceof DashboardActionError && error.unauthorized)
})
test('broker or engine rejection remains visible and is never called success', async () => {
  await assert.rejects(requestDashboardAction('/api/strategy/start', {}, 'test-csrf', async () => Response.json({ error: 'Broker verification required.' }, { status: 400 })), /Broker verification required/)
  assert.match(acceptedActionNotice('/api/strategy/stop')!, /only when the engine confirms/)
  assert.equal(acceptedActionNotice('/api/unknown'), null)
})
