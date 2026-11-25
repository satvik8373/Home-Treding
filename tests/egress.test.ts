import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestContext } from 'node:test'
import { Workspaces } from '../server/workspaces.ts'
import type { Workspace, WorkspaceContext } from '../server/workspaces.ts'
import { Store } from '../server/store.ts'
import { Controller } from '../server/controller.ts'
import { createApp } from '../server/http.ts'
import { ExecutionNetwork } from '../server/setup.ts'
import { MemoryRepository } from '../server/backtest/service.ts'
import { sealIdentity, tenantId } from '../shared/identity.ts'
import type { ExecutionSetup } from '../shared/setup.ts'
import { executionRouteUnassigned } from '../shared/setup.ts'
import { FakeBroker, fixture } from './helpers.ts'

const secret = 'egress-test-secret-'.repeat(3)
const headers = (user: string) => ({ 'x-009-gateway-secret': secret, 'x-009-workspace': sealIdentity({ tenant: tenantId(user), expires: Date.now() + 60_000 }, secret, 'engine') })
async function serve(t: TestContext, app: Parameters<typeof createServer>[1]) {
  const server = createServer(app)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
async function network(root: string, user: string): Promise<ExecutionSetup> {
  const response = await fetch(root + '/api/setup/network', { headers: headers(user) })
  assert.equal(response.status, 200)
  return response.json()
}
function factoryFor(created: Map<string, { workspace: Workspace; context?: WorkspaceContext }>) {
  return (path: string, context?: WorkspaceContext): Workspace => {
    const store = new Store(path), broker = new FakeBroker()
    broker.credentials = null
    const feed = { status: 'disconnected' as const, lastTickAt: null, connect() {}, close() {}, onMark() {}, onChange() {} }
    const controller = new Controller(broker, store, feed)
    let controls: { setEgressRoute: (route: string | null, ip?: string) => void } | undefined
    const workspace = { controller, store, feed,
      app: createApp(controller, process.cwd(), 4310, store, secret, async () => '98.93.220.83', {
        conflictCheck: context?.conflictCheck,
        dedicatedRouteRequired: context?.dedicatedRouteRequired,
        manageAssignment: context?.manageAssignment,
        applyEgress() {},
        onSetupReady: ready => { controls = ready },
      }),
      setEgressRoute: (route: string | null, ip?: string) => controls?.setEgressRoute(route, ip),
    }
    const saved = store.get<{ url: string; ipv4: string }>('setup:workspace-proxy')
    if (saved) workspace.setEgressRoute(saved.url, saved.ipv4)
    created.set(path, { workspace, context })
    return workspace
  }
}

test('simultaneous first sign-ins reserve distinct public IPs, skip duplicate NAT exits and report pool exhaustion', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-egress-race-'))
  const created = new Map(), routes: Record<string, string> = {
    'http://1.1.1.1:3128': '1.1.1.1', 'http://1.1.1.2:3128': '1.1.1.1', 'bind://172.31.10.20': '8.8.8.8',
  }
  const host = new Workspaces(directory, secret, 3, factoryFor(created), () => ({
    N009_WORKSPACE_PROXIES: 'http://1.1.1.1:3128,http://1.1.1.2:3128', N009_WORKSPACE_INTERFACES: '172.31.10.20',
  }), async route => { await new Promise(resolve => setImmediate(resolve)); return routes[route] })
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  const root = await serve(t, host.app)
  // No explicit restore: inbound requests must wait for persisted reservations.
  const reports = await Promise.all(['alice', 'bob', 'charlie'].map(user => network(root, user)))
  const assigned = reports.filter(report => report.proxyConfigured)
  assert.deepEqual(assigned.map(report => report.observed!.ipv4).sort(), ['1.1.1.1', '8.8.8.8'])
  assert.ok(assigned.every(report => !report.sharedIpConflict && !report.dedicatedRouteRequired))
  const missing = reports.find(report => !report.proxyConfigured)!
  assert.equal(missing.dedicatedRouteRequired, true)
  assert.equal(missing.observed, null, 'do not offer the shared host IP as an assignment')
  assert.equal(missing.current, false)
  assert.match(missing.error!, /No dedicated execution IP is assigned/)
  assert.ok([...created.values()].every(({ workspace }) => workspace.controller.broker.credentials === null))
})

test('reservations survive restart and browser arrival order, even without a broker connection', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-egress-restart-')), created = new Map()
  const environment = () => ({ N009_WORKSPACE_PROXIES: 'http://1.1.1.1:3128,http://8.8.8.8:3128' })
  let probes = 0
  const observe = async (route: string) => { probes++; return new URL(route).hostname }
  let host = new Workspaces(directory, secret, 3, factoryFor(created), environment, observe)
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  let root = await serve(t, host.app)
  assert.equal((await network(root, 'alice')).observed!.ipv4, '1.1.1.1')
  await host.close()
  created.clear()
  host = new Workspaces(directory, secret, 3, factoryFor(created), environment, observe)
  root = await serve(t, host.app)
  assert.equal((await network(root, 'bob')).observed!.ipv4, '8.8.8.8')
  assert.equal((await network(root, 'alice')).observed!.ipv4, '1.1.1.1')
  assert.equal(probes, 2, 'do not reallocate or probe a saved reservation')
  const bob = created.get(join(directory, 'tenants', tenantId('bob')))!
  assert.equal(bob.context!.conflictCheck!('1.1.1.1', 'http://9.9.9.9:3128'), true, 'manual route cannot reuse an unconnected reservation')
  assert.equal(bob.context!.conflictCheck!(null, 'http://1.1.1.1:3128'), true, 'same route is reserved even if its IP is unavailable')
})

test('an unassigned existing workspace gets a newly available route on its next request', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-egress-retry-')), created = new Map()
  let pool = ''
  const host = new Workspaces(directory, secret, 2, factoryFor(created), () => ({ N009_EXECUTION_LOCATION: 'hosted', N009_WORKSPACE_PROXIES: pool }), async route => new URL(route).hostname)
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  const root = await serve(t, host.app)
  assert.equal((await network(root, 'alice')).dedicatedRouteRequired, true)
  pool = 'http://1.1.1.1:3128'
  assert.equal((await network(root, 'alice')).observed!.ipv4, '1.1.1.1')
  assert.equal((await network(root, 'bob')).dedicatedRouteRequired, true)
  pool += ',http://8.8.8.8:3128'
  assert.equal((await network(root, 'bob')).observed!.ipv4, '8.8.8.8')
  assert.equal((await network(root, 'alice')).observed!.ipv4, '1.1.1.1')
})

test('new pool capacity is assigned on demand instead of being consumed by offline saved sign-ins', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-egress-demand-')), created = new Map()
  let pool = ''
  const environment = () => ({ N009_WORKSPACE_PROXIES: pool })
  let host = new Workspaces(directory, secret, 2, factoryFor(created), environment, async () => '1.1.1.1')
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  await network(await serve(t, host.app), 'offline-old-signin')
  await host.close(); created.clear()
  pool = 'http://1.1.1.1:3128'
  host = new Workspaces(directory, secret, 2, factoryFor(created), environment, async () => '1.1.1.1')
  await host.restore()
  assert.equal(created.get(join(directory, 'tenants', tenantId('offline-old-signin')))!.workspace.store.get('setup:workspace-proxy'), null)
  assert.equal((await network(await serve(t, host.app), 'current-user')).observed!.ipv4, '1.1.1.1')
})

test('unavailable, invalid and private pool results never become assigned IPs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-egress-invalid-'))
  const host = new Workspaces(directory, secret, 1, factoryFor(new Map()), () => ({ N009_WORKSPACE_PROXIES: 'http://1.1.1.1:3128,http://8.8.8.8:3128' }), async route => {
    if (route.includes('1.1.1.1')) throw Error('route unavailable')
    return '10.0.0.1'
  })
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  const report = await network(await serve(t, host.app), 'alice')
  assert.equal(report.proxyConfigured, false)
  assert.equal(report.dedicatedRouteRequired, true)
})

test('missing or conflicting routes block login, verification and Live start before any broker call', async t => {
  const f = await fixture()
  let calls = 0, required = true, conflict = false
  f.broker.credentials = null
  f.controller.broker.login = async () => { calls++ }
  f.controller.broker.verify = async () => { calls++; throw Error('must not reach broker') }
  const root = await serve(t, createApp(f.controller, process.cwd(), 4310, undefined, secret, async () => '1.1.1.1', {
    dedicatedRouteRequired: () => required, conflictCheck: () => conflict,
  }))
  const state = await (await fetch(root + '/api/state', { headers: { 'x-009-gateway-secret': secret } })).json() as { csrf: string }
  const requestHeaders = { 'x-009-gateway-secret': secret, 'x-009-csrf': state.csrf, 'content-type': 'application/json' }
  for (const scenario of ['missing', 'conflict']) {
    required = scenario === 'missing'; conflict = !required
    for (const route of ['broker/totp', 'broker/login', 'broker/verify', 'broker/recheck', 'strategy/start']) {
      const response = await fetch(`${root}/api/${route}`, { method: 'POST', headers: requestHeaders, body: JSON.stringify({ mode: 'live', liveAcknowledged: true }) })
      assert.equal(response.status, 409, `${scenario}: ${route}`)
      assert.match((await response.json() as { error: string }).error, required ? /No dedicated/ : /reserved by another/)
    }
  }
  assert.equal(calls, 0)
  assert.equal(f.broker.submitted.length, 0)
})

test('a route whose public IP changed is reported and is not silently re-registered', async () => {
  const repo = new MemoryRepository()
  repo.put('setup:workspace-proxy', { url: 'http://1.1.1.1:3128', ipv4: '1.1.1.1', savedAt: 1 })
  const service = new ExecutionNetwork(repo, () => null, () => ({}), async () => '8.8.8.8')
  const report = await service.read()
  assert.equal(report.observed!.ipv4, '8.8.8.8')
  assert.match(report.error!, /different public IPv4/)
  assert.equal(repo.get<{ ipv4: string }>('setup:workspace-proxy')!.ipv4, '1.1.1.1')
})

test('a late observation of an old route cannot replace the newly assigned IP', async () => {
  const repo = new MemoryRepository()
  let resolveOld!: (ip: string) => void
  const service = new ExecutionNetwork(repo, () => null, () => ({}), () => new Promise(resolve => { resolveOld = resolve }))
  const oldRead = service.read()
  repo.put('setup:workspace-proxy', { url: 'http://8.8.8.8:3128', ipv4: '8.8.8.8', savedAt: Date.now() })
  service.setObserve(async () => '8.8.8.8', '8.8.8.8')
  resolveOld('1.1.1.1')
  assert.equal((await oldRead).observed!.ipv4, '8.8.8.8')
  assert.equal((await service.read()).observed!.ipv4, '8.8.8.8')
  assert.equal(repo.get<{ ipv4: string }>('setup:last-observed-ip'), null, 'old observer must not persist its IP')
})

test('Google workspaces require an assigned IP even when engine metadata is local or missing', async t => {
  for (const location of [undefined, 'local', 'hosted']) {
    const directory = await mkdtemp(join(tmpdir(), 'n009-google-route-'))
    const host = new Workspaces(directory, secret, 1, factoryFor(new Map()), () => ({ N009_EXECUTION_LOCATION: location }))
    t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
    const report = await network(await serve(t, host.app), 'incognito-account')
    assert.equal(report.dedicatedRouteRequired, true, `location=${location}`)
    assert.equal(report.observed, null)
    assert.equal(report.expectedIPv4, null)
    assert.equal(report.current, false)
  }
})

test('older engine responses with a shared host conflict cannot offer that IP as an assignment', () => {
  // Response shape from an engine predating dedicatedRouteRequired.
  const report: ExecutionSetup = {
    location: 'unspecified', observed: { ipv4: '98.93.220.83', checkedAt: 1, changed: false },
    current: true, error: null, expectedIPv4: null, expectedMatch: null, account: null,
    connectionScope: null, profile: null, registeredMatch: null, registrationSource: 'user-entered',
    brokerRegistrationVerified: false, egressMode: 'direct', proxyConfigured: false, sharedIpConflict: true,
  }
  assert.equal(executionRouteUnassigned(report), true)
  assert.equal(executionRouteUnassigned({ ...report, sharedIpConflict: false }), false)
  assert.equal(executionRouteUnassigned({ ...report, egressMode: 'proxy', proxyConfigured: true }), false)
  assert.equal(executionRouteUnassigned({ ...report, egressMode: undefined }), true)
  assert.equal(executionRouteUnassigned(null), false)
})

test('release is CSRF protected and scoped to the signed workspace; another account can Recheck and keep the IP across restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-ip-release-')), created = new Map()
  const environment = () => ({ N009_WORKSPACE_PROXIES: 'http://1.1.1.1:3128' })
  let host = new Workspaces(directory, secret, 2, factoryFor(created), environment, async () => '1.1.1.1')
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  let root = await serve(t, host.app)
  async function post(user: string, action: string, csrfOverride?: string, target?: string) {
    const state = await (await fetch(root + '/api/state', { headers: headers(user) })).json() as { csrf: string }
    return fetch(root + '/api/setup/ip', { method: 'POST', headers: { ...headers(user), 'content-type': 'application/json', 'x-009-csrf': csrfOverride ?? state.csrf }, body: JSON.stringify({ action, target }) })
  }
  assert.equal((await network(root, 'alice-release')).observed!.ipv4, '1.1.1.1')
  assert.equal((await network(root, 'bob-release')).dedicatedRouteRequired, true)
  assert.equal((await post('alice-release', 'release', 'wrong-csrf')).status, 403)
  assert.equal((await post('bob-release', 'release', undefined, tenantId('alice-release'))).status, 200)
  assert.equal((await network(root, 'alice-release')).observed!.ipv4, '1.1.1.1', 'body target cannot release another account')
  const alice = created.get(join(directory, 'tenants', tenantId('alice-release')))!.workspace
  alice.store.put('private-history', { retained: true })
  const released = await post('alice-release', 'release')
  assert.equal(released.status, 200)
  const releaseBody = await released.json() as { network: ExecutionSetup }
  assert.equal(releaseBody.network.assignmentReleased, true)
  assert.equal(releaseBody.network.observed, null)
  for (let i = 0; i < 3; i++) await fetch(root + '/api/state', { headers: headers('alice-release') })
  assert.equal((await network(root, 'alice-release')).proxyConfigured, false, 'polling and GET cannot reclaim a released IP')
  const bob = created.get(join(directory, 'tenants', tenantId('bob-release')))!.workspace
  bob.store.put('setup:ip-released', false)
  await fetch(root + '/api/state', { headers: headers('bob-release') })
  assert.equal(bob.store.get('setup:workspace-proxy'), null, 'background state polling must leave released capacity for an explicit IP check')
  const assigned = await post('bob-release', 'assign')
  assert.equal(assigned.status, 200)
  assert.equal((await assigned.json() as { network: ExecutionSetup }).network.observed!.ipv4, '1.1.1.1')
  assert.deepEqual(alice.store.get('private-history'), { retained: true })
  await host.close(); created.clear()
  host = new Workspaces(directory, secret, 2, factoryFor(created), environment, async () => '1.1.1.1')
  root = await serve(t, host.app)
  assert.equal((await network(root, 'alice-release')).assignmentReleased, true)
  assert.equal((await network(root, 'bob-release')).observed!.ipv4, '1.1.1.1')
  const unavailable = await post('alice-release', 'assign')
  assert.equal(unavailable.status, 200)
  assert.equal((await unavailable.json() as { assigned: boolean }).assigned, false)
})

test('IP release rejects a linked broker, active strategy, saved exposure, pending order or busy request without mutating the route', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-ip-release-guard-')), created = new Map()
  const host = new Workspaces(directory, secret, 1, factoryFor(created), () => ({ N009_WORKSPACE_PROXIES: 'http://1.1.1.1:3128' }), async () => '1.1.1.1')
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }) })
  const root = await serve(t, host.app), user = 'guard-release'
  await network(root, user)
  const workspace = created.get(join(directory, 'tenants', tenantId(user)))!.workspace
  const state = await (await fetch(root + '/api/state', { headers: headers(user) })).json() as { csrf: string }
  const credentials = new FakeBroker().credentials
  for (const scenario of ['credentials', 'saved-broker', 'running', 'position', 'pending', 'busy']) {
    workspace.controller.broker.credentials = scenario === 'credentials' ? credentials : null
    workspace.store.saveBroker(scenario === 'saved-broker' ? credentials : null)
    workspace.controller.busy = scenario === 'busy'
    workspace.controller.session = ['running', 'position', 'pending'].includes(scenario) ? {
      id: 'retained', date: '2026-11-12', mode: 'paper', account: 'account', status: scenario === 'running' ? 'running' : 'stopped', message: '', atm: null, expiry: null,
      legs: scenario === 'position' ? { CE: { position: { quantity: 65 } } } : {}, pending: scenario === 'pending' ? { id: 'pending' } : null, trades: [], activity: [], pnlVerified: true,
    } as unknown as NonNullable<typeof workspace.controller.session> : null
    const response = await fetch(root + '/api/setup/ip', { method: 'POST', headers: { ...headers(user), 'content-type': 'application/json', 'x-009-csrf': state.csrf }, body: JSON.stringify({ action: 'release' }) })
    assert.equal(response.status, 409, scenario)
    assert.ok(workspace.store.get('setup:workspace-proxy'), scenario)
    assert.notEqual(workspace.store.get('setup:ip-released'), true, scenario)
  }
  workspace.controller.busy = false; workspace.controller.session = null
  workspace.controller.broker.credentials = null; workspace.store.saveBroker(null)
})
