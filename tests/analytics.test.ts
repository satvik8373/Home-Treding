import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { parse } from 'csv-parse/sync'
import { Store } from '../server/store.ts'
import { Analytics, analyticsFilters } from '../server/analytics.ts'
import { aggregate, periodFor } from '../shared/analytics.ts'
import { captureDaily, dailyScope, mergeDaily } from '../server/backup/dailyArchives.ts'
import { FirestoreBackups, fingerprint } from '../server/backup/firestore.ts'
import { applyFill } from '../server/strategy.ts'
import { createApp } from '../server/http.ts'
import { fixture } from './helpers.ts'
import { DEFAULT_SETTINGS } from '../shared/settings.ts'
import type { TradingSession, OrderIntent } from '../shared/model.ts'

async function session(day = '2026-11-09', mode: 'paper' | 'live' = 'paper') {
  const f = await fixture(); await f.start('paper')
  const value = structuredClone(f.controller.session!)
  Object.assign(value, { id: `${day}-${mode}`, date: day, mode, status: 'stopped', activity: [], trades: [], settings: { ...DEFAULT_SETTINGS, feePerOrderEstimate: 5 } })
  return value
}
function cycle(value: TradingSession, at: number) {
  const intent = (id: string, reason: OrderIntent['reason'], transaction: 'BUY' | 'SELL', quantity: number): OrderIntent => ({ id, tag: id, side: 'CE', symbol: value.legs.CE!.contract.symbol, reason, transaction, quantity, submittedAt: at })
  applyFill(value, intent('entry', 'BREAKOUT', 'BUY', 260), { orderId: 'entry', quantity: 260, average: 100, status: 'COMPLETE' }, at)
  applyFill(value, intent('one', 'TARGET_1', 'SELL', 130), { orderId: 'one', quantity: 130, average: 120, status: 'COMPLETE' }, at + 60_000)
  applyFill(value, intent('two', 'UPPER_CLOSE', 'SELL', 130), { orderId: 'two', quantity: 130, average: 90, status: 'COMPLETE' }, at + 120_000)
}
test('daily/weekly/monthly analytics count complete cycles rather than partial fills, separate modes and keep unknown P&L unknown', async t => {
  const root = await mkdtemp(join(tmpdir(), 'n009-analytics-')), store = new Store(root)
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }) })
  const one = await session(), two = await session('2026-11-10'), live = await session('2026-11-09', 'live')
  for (const value of [one, two, live]) { cycle(value, Date.parse(`${value.date}T09:25:00+05:30`)); store.saveSession(value) }
  const service = new Analytics(store, () => two)
  const report = service.read({ from: '2026-11-01', to: '2026-11-30', mode: 'paper', group: 'week' })
  assert.equal(report.sessions.length, 2); assert.equal(report.buckets.length, 1)
  assert.equal(report.buckets[0].period, '2026-11-09')
  assert.equal(report.totals.closedCycles, 2); assert.equal(report.totals.fills, 6)
  assert.equal(report.totals.wins, 2); assert.equal(report.totals.realizedGross, 2600)
  assert.equal(report.totals.estimatedCosts, 30); assert.equal(report.totals.estimatedNet, 2570)
  live.pnlVerified = false
  const unknown = aggregate([one, live]); assert.equal(unknown.realizedGross, null); assert.equal(unknown.unverifiedSessions, 1); assert.equal(unknown.verifiedSubtotal, 1300)
  assert.equal(aggregate([]).winRate, null); assert.equal(aggregate([]).realizedGross, null)
  const broken = structuredClone(one); broken.trades.pop(); assert.equal(aggregate([broken]).realizedGross, null)
  const csv = parse(service.export({ ...report.filters, format: 'trades' }).body, { bom: true, columns: true }) as Record<string, string>[]
  assert.equal(csv.length, 6); assert.equal(csv.every((row: Record<string, string>) => row.mode === 'paper'), true)
  assert.equal(csv.some(row => row.realized_gross_pnl_inr === '-1300'), true, 'numeric losses must remain numbers rather than formula-escaped text')
  assert.equal(periodFor('2027-01-01', 'week'), '2026-12-28'); assert.equal(periodFor('2027-01-01', 'month'), '2027-01')
  assert.throws(() => analyticsFilters({ mode: 'all' }), /separately/); assert.throws(() => analyticsFilters({ from: '2026-02-30' }), /valid date/)
})

test('permanent journal survives rolling activity trimming, deduplicates saves, and excludes credentials from daily archives', async t => {
  const root = await mkdtemp(join(tmpdir(), 'n009-journal-')); let store = new Store(root)
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }) })
  const value = await session(), at = Date.parse('2026-11-09T09:25:00+05:30')
  value.activity = Array.from({ length: 150 }, (_, i) => ({ at: at + i, message: `event ${i}`, level: 'info' }))
  store.saveSession(value)
  for (let i = 150; i < 163; i++) { value.activity.push({ at: at + i, message: `event ${i}`, level: 'info' }); value.activity = value.activity.slice(-150); store.saveSession(value) }
  const revision = store.history.days()[0].revision; store.saveSession(value)
  assert.equal(store.history.days()[0].revision, revision)
  assert.equal(store.history.events(value.id, 'activity', 0, 1000).total, 163)
  assert.equal(value.activity.length, 150)
  store.saveBroker({ apiKey: 'never-export-this-key', accessToken: 'never-export-this-token', account: value.account, name: 'Test', expiresAt: Date.now() + 1000 })
  const archive = captureDaily(root, 'owner')[0]
  assert.equal(archive.snapshot.workspace, dailyScope('owner', value.date))
  assert.equal(archive.snapshot.records.filter(row => row.key.startsWith('journal:')).length, 163)
  assert.doesNotMatch(JSON.stringify(archive), /never-export-this-key|never-export-this-token|setup:workspace-proxy/)
  store.close(); store = new Store(root)
  assert.equal(store.history.events(value.id, 'activity', 0, 1000).total, 163)
  assert.equal(store.history.days()[0].coverage, 'recorded')
  assert.equal(store.history.events(value.id, 'activity', 160, 2).events.length, 2)
})

test('legacy migration preserves the exact session, marks partial history, and cloud merge never drops older journal entries', async t => {
  const root = await mkdtemp(join(tmpdir(), 'n009-legacy-')); let store = new Store(root)
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }) })
  const value = await session(); value.activity.push({ at: 1000, level: 'info', message: 'available old log' })
  store.put('session', value); store.put(`session:history:${value.id}`, value); store.close(); store = new Store(root)
  assert.deepEqual(store.session(), value); assert.equal(store.history.days()[0].coverage, 'legacy-partial')
  const old = captureDaily(root, 'owner')[0].snapshot
  value.activity = [{ at: 2000, level: 'info', message: 'new log' }]; store.saveSession(value)
  const next = captureDaily(root, 'owner')[0].snapshot
  const partial = { ...next, records: next.records.filter(row => !row.key.startsWith('journal:') || JSON.parse(row.value).at === 2000) }
  const combined = mergeDaily(old, partial)
  assert.equal(combined.records.filter(row => row.key.startsWith('journal:')).length, 2)
  combined.records.push({ key: `journal:${'f'.repeat(64)}`, value: JSON.stringify({ id: 'f'.repeat(64), day: value.date, sessionId: value.id, kind: 'activity', at: 500, data: { at: 500, level: 'info', message: 'Cloud-only retained event' } }) })
  const service = new Analytics(store, () => value, () => undefined, Date.now, async () => combined)
  const detail = await service.detail(value.id, {}); assert.equal(detail.total, 3)
  const page = await service.eventPage(value.id, { from: value.date, to: value.date, mode: 'paper', offset: 0, limit: 2 })
  assert.match(page.body, /Cloud-only retained event/)
  await assert.rejects(service.detail('other-workspace-session', {}), /workspace/)
})

test('encrypted daily archives use workspace-specific paths, validate ciphertext, and recover without browser access', async () => {
  const docs = new Map<string, object>(), requests: string[] = [], key = randomBytes(32), workspace = 'a'.repeat(64)
  const fetcher: typeof fetch = async (url, options) => {
    const path = new URL(String(url)).pathname.slice('/v1/'.length); requests.push(path)
    if (options?.method === 'POST') {
      for (const write of JSON.parse(String(options.body)).writes) docs.set(write.update.name, { ...write.update, updateTime: String(docs.size + 1) })
      return Response.json({ writeResults: [] })
    }
    return docs.has(path) ? Response.json(docs.get(path)) : new Response('{}', { status: 404 })
  }
  const api = new FirestoreBackups('test-project', key, async () => 'server-only-token', fetcher, workspace)
  const data = { version: 1 as const, workspace: dailyScope(workspace, '2026-11-09'), key: randomBytes(32).toString('base64'), capturedAt: new Date().toISOString(), records: [{ key: 'journal:event', value: 'private-journal-marker' }] }
  await api.save(data); assert.deepEqual(await api.restore(data.workspace), data)
  const next = { ...data, records: [...data.records, { key: 'journal:next', value: 'next-marker' }] }
  await api.save(next, fingerprint(data))
  await assert.rejects(api.save(data, fingerprint(data)), /Archive changed/)
  assert.deepEqual(await api.restore(data.workspace), next, 'a stale merge may not overwrite a newer cloud archive')
  assert.ok(requests.every(path => path.endsWith(':commit') || path.includes(`/n009EngineBackups/${workspace}/dailyArchives/`)))
  assert.equal(JSON.stringify([...docs.values()]).includes('private-journal-marker'), false)
  const other = new FirestoreBackups('test-project', key, async () => 'token', fetcher, 'b'.repeat(64))
  assert.equal(await other.load(data.workspace), null)
})

test('history HTTP and CSV are read-only and cannot select another workspace or merge Live/Paper', async t => {
  const root = await mkdtemp(join(tmpdir(), 'n009-history-http-')), store = new Store(root), f = await fixture(), value = await session()
  cycle(value, Date.now()); store.saveSession(value)
  const server = createApp(f.controller, '.', 4310, store).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await rm(root, { recursive: true, force: true }) })
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const report = await (await fetch(`${origin}/api/analytics?from=2026-11-01&to=2026-11-30&mode=paper`)).json()
  assert.equal(report.sessions.length, 1)
  assert.equal((await fetch(`${origin}/api/analytics/session/not-yours`)).status, 400)
  assert.equal((await fetch(`${origin}/api/analytics?mode=all`)).status, 400)
  assert.equal((await fetch(`${origin}/api/analytics?from=2026-11-01&to=2026-11-30&mode=paper&account=other-account`)).status, 200)
  const exportResponse = await fetch(`${origin}/api/analytics/export?from=2026-11-01&to=2026-11-30&mode=paper&format=events`)
  assert.equal(exportResponse.status, 200); assert.match(exportResponse.headers.get('content-type')!, /text\/csv/)
  assert.equal(f.broker.submitted.length, 0); assert.equal(f.broker.cancellations.length, 0)
})
