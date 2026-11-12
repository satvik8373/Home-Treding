import express from 'express'
import { createHash, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readdirSync } from 'node:fs'
import { isIPv4 } from 'node:net'
import { join } from 'node:path'
import { openIdentity } from '../shared/identity.ts'
import { Store } from './store.ts'
import { MStock } from './broker.ts'
import { MarketFeed } from './feed.ts'
import { Controller } from './controller.ts'
import { createApp } from './http.ts'
import { createAccountSync } from './backup/accountSync.ts'
import type { AccountSync } from './backup/accountSync.ts'
import { observeExecutionIPv4 } from './setup.ts'
import { createEgressAgent, createProxyFetcher, validateEgressRoute } from './proxy.ts'

export interface Workspace {
  sync?: AccountSync
  controller: Controller
  store: Store
  feed: Pick<MarketFeed, 'close'> & Partial<Pick<MarketFeed, 'setAgent'>>
  app: ReturnType<typeof createApp>
  setEgressRoute?: (routeUrl: string | null, ipv4?: string) => void
}

let sharedIpCache: { ip: string; expiresAt: number } | null = null
let sharedIpTask: Promise<string> | null = null

export async function sharedNetworkObserver(): Promise<string> {
  const now = Date.now()
  if (sharedIpCache && now < sharedIpCache.expiresAt) return sharedIpCache.ip
  if (!sharedIpTask) {
    sharedIpTask = observeExecutionIPv4().then(ip => {
      sharedIpCache = { ip, expiresAt: Date.now() + 30_000 }
      return ip
    }).finally(() => { sharedIpTask = null })
  }
  return sharedIpTask
}

export interface WorkspaceContext {
  conflictCheck?: (observedIp: string | null, routeUrl: string | null) => boolean
}

export type WorkspaceFactory = (directory: string, context?: WorkspaceContext) => Workspace

export const createWorkspace: WorkspaceFactory = (directory, context) => {
  const store = new Store(directory), feed = new MarketFeed()
  const sync = createAccountSync(directory)
  if (sync) store.onDurableChange = sync.request
  const broker = new MStock()
  const controller = new Controller(broker, store, feed)
  let controls: { setEgressRoute: (routeUrl: string | null, ipv4?: string) => void } | undefined
  const app = createApp(controller, process.cwd(), 4310, store, undefined, sharedNetworkObserver, {
    conflictCheck: context?.conflictCheck,
    applyEgress: (routeUrl) => {
      broker.setFetcher(routeUrl ? createProxyFetcher(routeUrl) : fetch)
      feed.setAgent(routeUrl ? createEgressAgent(routeUrl) : undefined)
    },
    onSetupReady: (ready) => { controls = ready },
  })
  if (sync) { controller.persistence = () => sync.state; sync.onStatus = () => controller.onChange(); sync.request() }
  return {
    controller,
    store,
    feed,
    app,
    sync,
    setEgressRoute: (routeUrl, ipv4) => controls?.setEgressRoute(routeUrl, ipv4),
  }
}

function configuredEgressPool(env: NodeJS.ProcessEnv = process.env): string[] {
  const proxies = (env.N009_WORKSPACE_PROXIES ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const interfaces = (env.N009_WORKSPACE_INTERFACES ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => isIPv4(s))
    .map(ip => `bind://${ip}`)
  return [...proxies, ...interfaces]
}

/** Only gateway-signed identities select a workspace. Request bodies, paths and browser headers cannot select one. */
export class Workspaces {
  readonly app = express()
  private values = new Map<string, Workspace>()
  private tasks = new Map<string, Promise<Workspace>>()
  private owner: Workspace
  private directory: string
  private closing = false
  constructor(
    private data: string,
    private secret: string,
    private capacity = 4,
    private factory: WorkspaceFactory = createWorkspace,
    private environment: () => NodeJS.ProcessEnv = () => process.env,
    private observeRoute: (routeUrl: string) => Promise<string> = routeUrl => observeExecutionIPv4(createProxyFetcher(routeUrl)),
  ) {
    if (secret.length < 32 || !Number.isInteger(capacity) || capacity < 1 || capacity > 32) throw new Error('Invalid workspace configuration.')
    this.directory = join(data, 'tenants')
    mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    this.owner = this.factory(data, { conflictCheck: (ip, route) => this.hasSharedIpConflict('owner', ip, route) })
    this.values.set('owner', this.owner)
    this.bind('owner', this.owner)
    this.app.disable('x-powered-by')
    this.app.use(async (req, res) => {
      res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      const offered = Buffer.from(req.get('x-009-gateway-secret') ?? ''), expected = Buffer.from(secret)
      const identity = openIdentity(req.get('x-009-workspace') ?? '', secret, 'engine')
      if (offered.length !== expected.length || !timingSafeEqual(offered, expected) || !identity || identity.expires > Date.now() + 65_000)
        return void res.status(401).json({ error: 'Authenticated workspace required.' })
      if (this.closing) return void res.status(503).json({ error: 'Engine maintenance in progress. Retry shortly.' })
      if (req.path === '/api/health' && req.method === 'GET') return void res.json({ ok: true, service: 'nifty-009', workspaceIsolation: true })
      try {
        const workspace = await this.get(identity.tenant)
        workspace.app(req, res)
      } catch { res.status(503).json({ error: 'Workspace unavailable or server capacity reached. Contact the deployment owner.' }) }
    })
  }

  private hasSharedIpConflict(myId: string, observedIp: string | null, myRouteUrl: string | null): boolean {
    for (const [otherId, other] of this.values) {
      if (otherId === myId) continue
      const otherBound = other.controller.connected() || Boolean(other.store.broker())
      if (!otherBound) continue
      const otherProxy = other.store.get<{ url?: string; ipv4?: string } | null>('setup:workspace-proxy')
      if (!myRouteUrl && !otherProxy?.url) return true
      if (observedIp) {
        const otherIp = otherProxy?.url
          ? (otherProxy.ipv4 ?? other.store.get<{ ipv4?: string } | null>('setup:last-observed-ip')?.ipv4 ?? null)
          : (other.store.get<{ ipv4?: string } | null>('setup:last-observed-ip')?.ipv4 ?? sharedIpCache?.ip ?? null)
        if (otherIp && otherIp === observedIp) return true
      }
    }
    return false
  }

  private claimedPoolRoutes(): Set<string> {
    const claimed = new Set<string>()
    for (const workspace of this.values.values()) {
      const saved = workspace.store.get<{ url?: string } | null>('setup:workspace-proxy')
      if (saved?.url) claimed.add(saved.url)
    }
    return claimed
  }

  private claimedObservedIps(excludeId: string): Set<string> {
    const claimed = new Set<string>()
    for (const [otherId, workspace] of this.values) {
      if (otherId === excludeId) continue
      const saved = workspace.store.get<{ url?: string; ipv4?: string } | null>('setup:workspace-proxy')
      if (saved?.url) {
        const routedIp = saved.ipv4 ?? workspace.store.get<{ ipv4?: string } | null>('setup:last-observed-ip')?.ipv4 ?? null
        if (routedIp && isIPv4(routedIp)) claimed.add(routedIp)
        continue
      }
      if (workspace.controller.connected() || Boolean(workspace.store.broker())) {
        const directIp = workspace.store.get<{ ipv4?: string } | null>('setup:last-observed-ip')?.ipv4 ?? sharedIpCache?.ip ?? null
        if (directIp && isIPv4(directIp)) claimed.add(directIp)
      }
    }
    return claimed
  }

  private async maybeAssignPoolEgress(id: string, workspace: Workspace): Promise<void> {
    if (id === 'owner') return
    const currentProxy = workspace.store.get<{ url?: string } | null>('setup:workspace-proxy')
    if (currentProxy?.url) return
    if (workspace.store.broker()) return
    const pool = configuredEgressPool(this.environment())
    if (!pool.length) return
    const claimedRoutes = this.claimedPoolRoutes()
    const claimedIps = this.claimedObservedIps(id)
    for (const candidate of pool) {
      let normalized: string
      try {
        normalized = await validateEgressRoute(candidate, { allowOperatorRoutes: true })
      } catch {
        continue
      }
      if (claimedRoutes.has(normalized)) continue
      try {
        const ipv4 = await this.observeRoute(normalized)
        if (claimedIps.has(ipv4)) continue
        const now = Date.now()
        workspace.store.put('setup:workspace-proxy', { url: normalized, ipv4, savedAt: now })
        workspace.store.put('setup:last-observed-ip', { ipv4, checkedAt: now, changed: false })
        workspace.setEgressRoute?.(normalized, ipv4)
        return
      } catch {
        // Skip unreachable pool routes and try next candidate
      }
    }
  }

  private bind(id: string, workspace: Workspace) {
    workspace.controller.authorizeBroker = (account, freshlyVerified = false) => {
      const key = `auth:broker-owner:${createHash('sha256').update(account).digest('hex')}`
      const owner = this.owner.store.get<string>(key)
      if (owner && owner !== id) {
        if (!freshlyVerified) throw new Error('This broker account is already linked to another workspace.')
        const previous = this.values.get(owner)
        if (!previous) throw new Error('The original workspace is not ready. Retry the verified connection shortly.')
        previous.controller.releaseBrokerForTransfer(account)
      }
      this.owner.store.put(key, id)
    }
    const saved = workspace.store.broker()
    if (saved) workspace.controller.authorizeBroker(saved.account)
  }

  private async loadWorkspace(id: string, assignPool: boolean): Promise<Workspace> {
    const pending = this.tasks.get(id)
    if (pending) return pending
    const loaded = this.values.get(id)
    if (loaded) return loaded
    if (!/^[a-f0-9]{64}$/.test(id) || this.values.size - 1 >= this.capacity) throw new Error('Workspace capacity reached.')
    const workspace = this.factory(join(this.directory, id), { conflictCheck: (ip, route) => this.hasSharedIpConflict(id, ip, route) })
    this.values.set(id, workspace)
    const task = (async () => {
      this.bind(id, workspace)
      if (assignPool) await this.maybeAssignPoolEgress(id, workspace)
      await workspace.controller.restore()
      return workspace
    })()
    this.tasks.set(id, task)
    try { return await task } catch (error) {
      workspace.feed.close(); workspace.store.close(); this.values.delete(id); throw error
    } finally { this.tasks.delete(id) }
  }

  private async get(id: string): Promise<Workspace> {
    return this.loadWorkspace(id, true)
  }

  async restore() {
    await this.owner.controller.restore()
    // Restore saved workspaces even when no browser is open; active sessions keep their own controllers.
    const ids = readdirSync(this.directory, { withFileTypes: true }).filter(entry => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    if (ids.length > this.capacity) throw new Error('Existing workspaces exceed configured capacity. Increase capacity before starting.')
    // First load all persisted workspaces so existing pool claims are registered before assigning unused slots.
    for (const entry of ids) await this.loadWorkspace(entry.name, false)
    for (const entry of ids) {
      const workspace = this.values.get(entry.name)
      if (workspace) await this.maybeAssignPoolEgress(entry.name, workspace)
    }
  }

  async pump() {
    await Promise.allSettled([...this.values.values()].map(workspace => workspace.controller.pump()))
  }

  async close(): Promise<boolean> {
    this.closing = true
    await Promise.allSettled([...this.tasks.values()])
    const workspaces = [...this.values.values()]
    try { for (const { controller } of workspaces) await controller.checkpointForRestart() }
    catch (error) { for (const { controller } of workspaces) controller.resumeAfterAbortedRestart(); this.closing = false; throw error }
    for (const workspace of workspaces) { workspace.sync?.close(); workspace.feed.close(); workspace.store.close() }
    return true
  }
}
