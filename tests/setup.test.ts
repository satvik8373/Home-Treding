import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ExecutionNetwork, observeExecutionIPv4, publicIPv4 } from '../server/setup.ts'
import { createProxyFetcher, formatEgressLabel, validateEgressRoute } from '../server/proxy.ts'
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

test('proxy route validator blocks loopback, metadata, internal DNS and interface routes unless operator-authorized', async () => {
  for (const blocked of [
    'http://127.0.0.1:8080',
    'http://localhost:3128',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5:3128',
    'http://192.168.1.10:3128',
    'http://[::1]:3128',
    'ftp://1.1.1.1:21',
    'bind://172.31.10.20',
  ]) {
    await assert.rejects(() => validateEgressRoute(blocked))
  }
  await assert.rejects(() => validateEgressRoute('http://rebind.example.test:3128', {
    resolveHost: async () => [{ address: '169.254.169.254' }],
  }))
  assert.equal(await validateEgressRoute('bind://172.31.10.20', { allowOperatorRoutes: true }), 'bind://172.31.10.20')
  const valid = await validateEgressRoute('http://user:secret@1.1.1.1:3128/', { resolveHost: async () => [{ address: '1.1.1.1' }] })
  assert.equal(valid, 'http://user:secret@1.1.1.1:3128')
  assert.equal(formatEgressLabel(valid), 'http://1.1.1.1:3128')
  assert.equal(formatEgressLabel('bind://172.31.10.20'), 'Interface 172.31.10.20')
})

test('proxy fetcher forwards URLSearchParams POST bodies, credentials and honors redirect errors', async t => {
  let seenAuth = '', seenBody = '', seenContentType = ''
  const target = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      seenBody = Buffer.concat(chunks).toString('utf8')
      seenContentType = String(req.headers['content-type'] ?? '')
      if (req.url === '/redirect') {
        res.writeHead(302, { location: 'https://example.com' }).end()
        return
      }
      if (req.url === '/empty') {
        res.writeHead(204).end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, echo: seenBody }))
    })
  })
  const proxy = createServer((req, res) => {
    seenAuth = String(req.headers['proxy-authorization'] ?? '')
    const dest = new URL(req.url!)
    const upstream = httpRequest({
      host: dest.hostname,
      port: dest.port,
      path: dest.pathname + dest.search,
      method: req.method,
      headers: req.headers,
    }, upstreamRes => {
      res.writeHead(upstreamRes.statusCode ?? 200, upstreamRes.headers)
      upstreamRes.pipe(res)
    })
    req.pipe(upstream)
  })
  await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve))
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve))
  t.after(() => { target.closeAllConnections(); target.close(); proxy.closeAllConnections(); proxy.close() })

  const targetPort = (target.address() as AddressInfo).port
  const proxyPort = (proxy.address() as AddressInfo).port
  const proxyFetcher = createProxyFetcher(`http://alice:pass123@127.0.0.1:${proxyPort}`)

  const res = await proxyFetcher(`http://127.0.0.1:${targetPort}/verify`, {
    method: 'POST',
    body: new URLSearchParams({ api_key: 'my-key', totp: '123456' }),
  })
  assert.equal(res.status, 200)
  assert.equal(seenBody, 'api_key=my-key&totp=123456')
  assert.match(seenContentType, /^application\/x-www-form-urlencoded/)
  assert.equal(seenAuth, `Basic ${Buffer.from('alice:pass123').toString('base64')}`)

  const empty = await proxyFetcher(`http://127.0.0.1:${targetPort}/empty`)
  assert.equal(empty.status, 204)

  await assert.rejects(proxyFetcher(`http://127.0.0.1:${targetPort}/redirect`, { redirect: 'error' }), /redirect/)
})

test('proxy configuration endpoint rejects SSRF and connected broker changes and clears back to host observer', async t => {
  const f = await fixture(), repo = new MemoryRepository(), secret = 'x'.repeat(40)
  repo.put('setup:workspace-proxy', { url: 'bind://127.0.0.1', ipv4: '8.8.8.8', savedAt: 100 })
  let egressRoute: string | null | undefined
  const app = createApp(f.controller, process.cwd(), 4310, repo, secret, async () => '1.1.1.1', {
    applyEgress: routeUrl => { egressRoute = routeUrl },
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const state = await (await fetch(`${root}/api/state`, { headers: { 'x-009-gateway-secret': secret } })).json() as { csrf: string }
  const headers = { 'x-009-gateway-secret': secret, 'content-type': 'application/json', 'x-009-csrf': state.csrf }

  // Blocked while broker is connected
  assert.equal((await fetch(`${root}/api/setup/proxy`, { method: 'POST', headers, body: JSON.stringify({ proxyUrl: '' }) })).status, 409)

  // Disconnect broker to test validation & clearing
  f.controller.broker.credentials = null
  const ssrf = await fetch(`${root}/api/setup/proxy`, { method: 'POST', headers, body: JSON.stringify({ proxyUrl: 'http://169.254.169.254:80' }) })
  assert.equal(ssrf.status, 400)

  const cleared = await fetch(`${root}/api/setup/proxy`, { method: 'POST', headers, body: JSON.stringify({ proxyUrl: '' }) })
  assert.equal(cleared.status, 200)
  const body = await cleared.json() as { saved: boolean; ipv4: string | null }
  assert.equal(body.saved, true)
  assert.equal(body.ipv4, '1.1.1.1')
  assert.equal(egressRoute, null)
  const network = await (await fetch(`${root}/api/setup/network`, { headers: { 'x-009-gateway-secret': secret } })).json()
  assert.equal(network.egressMode, 'direct')
  assert.equal(network.proxyConfigured, false)
  assert.equal(network.observed.ipv4, '1.1.1.1')
})
