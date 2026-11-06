import express from 'express'
import { createHash, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { openIdentity } from '../shared/identity.ts'
import { Store } from './store.ts'
import { MStock } from './broker.ts'
import { MarketFeed } from './feed.ts'
import { Controller } from './controller.ts'
import { createApp } from './http.ts'

export interface Workspace {
  controller: Controller
  store: Store
  feed: Pick<MarketFeed, 'close'>
  app: ReturnType<typeof createApp>
}
export type WorkspaceFactory = (directory: string) => Workspace
export const createWorkspace: WorkspaceFactory = directory => {
  const store = new Store(directory), feed = new MarketFeed()
  const controller = new Controller(new MStock(), store, feed)
  return { controller, store, feed, app: createApp(controller, process.cwd(), 4310, store) }
}

/** Only gateway-signed identities select a workspace. Request bodies, paths and browser headers cannot select one. */
export class Workspaces {
  readonly app = express()
  private values = new Map<string, Workspace>()
  private tasks = new Map<string, Promise<Workspace>>()
  private owner: Workspace
  private directory: string
  private closing = false
  constructor(private data: string, private secret: string, private capacity = 4, private factory = createWorkspace) {
    if (secret.length < 32 || !Number.isInteger(capacity) || capacity < 1 || capacity > 32) throw new Error('Invalid workspace configuration.')
    this.directory = join(data, 'tenants')
    mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    this.owner = this.factory(data)
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
  private bind(id: string, workspace: Workspace) {
    workspace.controller.authorizeBroker = account => {
      const key = `auth:broker-owner:${createHash('sha256').update(account).digest('hex')}`
      const owner = this.owner.store.get<string>(key)
      if (owner && owner !== id) throw new Error('This broker account is already linked to another workspace.')
      this.owner.store.put(key, id)
    }
    const saved = workspace.store.broker()
    if (saved) workspace.controller.authorizeBroker(saved.account)
  }
  private async get(id: string): Promise<Workspace> {
    const pending = this.tasks.get(id)
    if (pending) return pending
    const loaded = this.values.get(id)
    if (loaded) return loaded
    if (!/^[a-f0-9]{64}$/.test(id) || this.values.size - 1 >= this.capacity) throw new Error('Workspace capacity reached.')
    const workspace = this.factory(join(this.directory, id))
    this.values.set(id, workspace)
    const task = (async () => {
      this.bind(id, workspace)
      await workspace.controller.restore()
      return workspace
    })()
    this.tasks.set(id, task)
    try { return await task } catch (error) {
      workspace.feed.close(); workspace.store.close(); this.values.delete(id); throw error
    } finally { this.tasks.delete(id) }
  }
  async restore() {
    await this.owner.controller.restore()
    // Restore saved workspaces even when no browser is open; active sessions keep their own controllers.
    const ids = readdirSync(this.directory, { withFileTypes: true }).filter(entry => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    if (ids.length > this.capacity) throw new Error('Existing workspaces exceed configured capacity. Increase capacity before starting.')
    for (const entry of ids) await this.get(entry.name)
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
    for (const workspace of workspaces) { workspace.feed.close(); workspace.store.close() }
    return true
  }
}
