import { randomUUID } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CloudDatabase } from './database.ts'
import { CloudStore } from './store.ts'
import { BrokerError, MStock } from '../broker.ts'
import { Controller } from '../controller.ts'
import { MarketFeed } from '../feed.ts'
import { createApp } from '../http.ts'
import type { CloudJob } from './database.ts'

export const CLOUD_LIVE_REASON = 'Hosted Paper execution is available. Live execution needs a verified stable broker-approved outbound IP and a qualified live deployment.'
class PaperBroker extends MStock {
  override async place(): Promise<string> { throw new BrokerError(CLOUD_LIVE_REASON, true) }
  override async cancel(): Promise<void> { throw new BrokerError(CLOUD_LIVE_REASON, true) }
}

async function run() {
  const owner = randomUUID(), env = process.env, secret = env.N009_GATEWAY_SECRET ?? '', key = env.N009_STATE_KEY ?? ''
  if (secret.length < 32 || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('Cloud secrets are not configured.')
  const db = new CloudDatabase(env.DATABASE_URL ?? '', key)
  await db.initialize()
  // New deployments overlap old instances. A database lease elects exactly one publisher/command consumer.
  while (!await db.acquire(owner)) await new Promise(resolve => setTimeout(resolve, 3000))
  const records = await db.loadRecords(), root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
  const store = new CloudStore(mkdtempSync(`${tmpdir()}/n009-`), Buffer.from(key, 'hex'), records, values => db.checkpoint(owner, values))
  if (store.session()?.mode === 'live') throw new Error('A live session cannot be loaded by a hosted Paper worker.')
  const feed = new MarketFeed(), controller = new Controller(new PaperBroker(), store, feed)
  controller.execution = { kind: 'hosted-paper', liveExecution: false, reason: CLOUD_LIVE_REASON }
  const port = Number(env.N009_WORKER_PORT || 4310)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid worker port.')
  const origin = `http://127.0.0.1:${port}`
  const app = createApp(controller, root, port, store, secret)
  const server = app.listen(port, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  await controller.restore(); await store.persist()
  const headers = { 'x-009-gateway-secret': secret }
  const getState = async () => {
    const response = await fetch(`${origin}/api/state`, { headers })
    if (!response.ok) throw new Error('Worker state unavailable.')
    return response.json()
  }
  await db.publish(owner, await getState())
  let ending = false, busy = false, lastPublish = 0, lastLease = 0, lastClean = 0, cycle: Promise<void> | null = null
  const jobs = new Set<Promise<void>>()
  async function dispatch(job: CloudJob) {
    let status = 503, responseHeaders: Record<string, string> = { 'content-type': 'application/json' }, body = JSON.stringify({ error: 'Hosted request could not complete. Refresh status before retrying.' })
    try {
      if (Date.now() >= job.expiresAt) throw new Error('Expired request')
      const target = new URL(`/api/${job.request.route}`, origin); target.search = job.request.query
      const response = await fetch(target, { method: job.request.method, headers: { ...headers, 'content-type': 'application/json', 'x-009-csrf': job.request.csrf }, body: ['GET', 'HEAD'].includes(job.request.method) ? undefined : job.request.body, redirect: 'error', signal: AbortSignal.timeout(Math.max(1, job.expiresAt - Date.now())) })
      status = response.status; body = await response.text()
      responseHeaders = Object.fromEntries(['content-type', 'content-disposition'].flatMap(name => response.headers.has(name) ? [[name, response.headers.get(name)!]] : []))
      await store.persist()
    } catch {
      status = 503; responseHeaders = { 'content-type': 'application/json' }
      body = JSON.stringify({ error: 'Hosted request outcome is not confirmed. Refresh engine state before repeating an action.' })
    }
    await db.finish(owner, job.id, { status, headers: responseHeaders, body })
  }
  async function shutdown() {
    if (ending) return
    ending = true; clearInterval(timer); feed.close()
    const renewal = setInterval(() => void db.renew(owner).catch(() => false), 3000)
    await cycle?.catch(() => {})
    await Promise.allSettled(jobs)
    await store.persist(); clearInterval(renewal); await db.release(owner); server.closeAllConnections(); server.close(); store.close(); await db.close()
    process.exit(0)
  }
  const timer = setInterval(() => {
    if (busy || ending) return
    busy = true
    cycle = (async () => {
      if (Date.now() - lastLease >= 3000) {
        if (!await db.renew(owner)) throw new Error('Lease lost')
        lastLease = Date.now()
      }
      await controller.pump(); await store.persist()
      if (jobs.size < 4) for (const job of await db.claim(owner, 4 - jobs.size)) {
        const task = dispatch(job); jobs.add(task)
        void task.then(() => jobs.delete(task), () => jobs.delete(task))
      }
      if (Date.now() - lastPublish >= 2000) {
        const state = await getState(); await store.persist(); await db.publish(owner, state); lastPublish = Date.now()
      }
      if (Date.now() - lastClean >= 60_000) { await db.cleanup(); lastClean = Date.now() }
    })().catch(() => {
      ending = true; clearInterval(timer); feed.close()
      console.error('Hosted worker lost storage or lease access. Pausing; no real broker orders are enabled.')
      setTimeout(() => process.exit(1), 1000)
    }).finally(() => { busy = false })
  }, 500)
  process.on('SIGTERM', () => void shutdown().catch(() => process.exit(1)))
  process.on('SIGINT', () => void shutdown().catch(() => process.exit(1)))
  console.log('Hosted NIFTY 009 Paper worker ready. Broker account is connected only after user login.')
}

void run().catch(() => { console.error('Hosted worker could not start. Check private cloud configuration and database availability.'); process.exit(1) })
