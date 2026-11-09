import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hostedCookies, previewCookies, trustedPreviewRequest } from '../shared/preview.ts'
import { AccountSync } from '../server/backup/accountSync.ts'
import { Store } from '../server/store.ts'
import { fixture } from './helpers.ts'
import { exportPaperHandoff, importPaperHandoff } from '../server/paperHandoff.ts'
import { Controller } from '../server/controller.ts'

test('loopback account proxy isolates signed dashboard cookies and preserves logout, HttpOnly and SameSite protection', () => {
  const translated = previewCookies(['__Host-n009=signed-access; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600', '__Host-n009-refresh=signed-refresh; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000', 'other-app-secret=must-not-forward; Secure'])
  assert.equal(translated.length, 2)
  assert.match(translated[0], /^n009_preview_access=signed-access;/)
  assert.match(translated[0], /HttpOnly/); assert.match(translated[0], /SameSite=Strict/); assert.doesNotMatch(translated[0], /Secure/)
  assert.equal(hostedCookies('other-app=private; n009_preview_access=signed-access; n009_preview_refresh=signed-refresh'), '__Host-n009=signed-access; __Host-n009-refresh=signed-refresh')
  assert.match(previewCookies(['__Host-n009=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'])[0], /Max-Age=0/)
  assert.equal(trustedPreviewRequest('127.0.0.1:5173', 'http://127.0.0.1:5173', 'same-origin'), true)
  assert.equal(trustedPreviewRequest('localhost:5173', 'http://localhost:5173'), true)
  for (const [host, origin, site] of [['evil.example:5173', 'http://evil.example:5173'], ['127.0.0.1:5173', 'https://evil.example'], ['127.0.0.1:5173', undefined, 'cross-site']]) assert.equal(trustedPreviewRequest(host, origin, site), false)
})

test('Firestore sync coalesces durable changes and never repeats an upload for unchanged state', async () => {
  let clock = 100_000, uploads = 0
  const sync = new AccountSync(() => ({ version: 1, workspace: 'owner', capturedAt: new Date().toISOString(), key: '', records: [] }), async () => { uploads++ }, () => clock)
  sync.onStatus = () => { throw Error('Disconnected UI observer') }
  for (let i = 0; i < 20; i++) sync.request()
  await sync.flush(); assert.equal(uploads, 1); assert.equal(sync.state.firestore, 'synced')
  for (let i = 0; i < 20; i++) await sync.flush()
  assert.equal(uploads, 1)
  sync.request(); await sync.flush(); assert.equal(uploads, 1)
  clock += 10_000; await sync.flush(); assert.equal(uploads, 2)
  sync.close()
})

test('Firestore outage does not reject execution persistence and dirty data is retried after recovery', async () => {
  let clock = 100_000, fail = true, uploads = 0
  const sync = new AccountSync(() => ({ version: 1, workspace: 'owner', capturedAt: '', key: '', records: [] }), async () => { uploads++; if (fail) throw Error('Network down') }, () => clock)
  sync.request(); await sync.flush()
  assert.equal(sync.state.firestore, 'unavailable'); assert.equal(uploads, 1)
  fail = false; clock += 30_000; await sync.flush()
  assert.equal(sync.state.firestore, 'synced'); assert.equal(uploads, 2)
  sync.close()
})

test('a durable change during an in-flight sync remains pending for the next checkpoint', async () => {
  let release!: () => void, clock = 100_000
  const delayed = new Promise<void>(resolve => { release = resolve })
  const sync = new AccountSync(() => ({ version: 1, workspace: 'owner', capturedAt: '', key: '', records: [] }), async () => delayed, () => clock)
  sync.request(); const saving = sync.flush(); sync.request(); release(); await saving
  assert.equal(sync.state.firestore, 'pending')
  clock += 10_000; await sync.flush(); assert.equal(sync.state.firestore, 'synced')
  sync.close()
})

test('Paper handoff preserves the running session, references, fills, open leg and preferences without broker orders', async t => {
  const root = await mkdtemp(join(tmpdir(), 'n009-handoff-'))
  const source = new Store(join(root, 'source')), target = new Store(join(root, 'target')), f = await fixture()
  t.after(async () => { source.close(); target.close(); await rm(root, { recursive: true, force: true }) })
  await f.start('paper')
  let durableChanges = 0
  source.onDurableChange = () => { durableChanges++ }
  source.put('unchanged-check', { value: 1 }); source.put('unchanged-check', { value: 1 })
  assert.equal(durableChanges, 1, 'identical values must not trigger another Firestore checkpoint')
  f.controller.session!.legs.CE!.position = { average: 101, quantity: 195, target1Remaining: 65, entryQuantity: 195, entryAt: f.now() }
  f.controller.session!.legs.CE!.entries = 1
  source.saveSession(f.controller.session!); source.put('strategy:settings', f.controller.strategySettings())
  target.saveBroker(f.broker.credentials)
  const originalBroker = target.broker(), pack = exportPaperHandoff(source)
  assert.equal(importPaperHandoff(target, pack, f.now()), 'imported')
  assert.deepEqual(target.session(), source.session())
  assert.deepEqual(target.broker(), originalBroker)
  assert.equal(importPaperHandoff(target, pack, f.now()), 'unchanged')
  const resumed = new Controller(f.broker, target, f.feed, f.now)
  await resumed.restore()
  assert.equal(resumed.session!.id, pack.session.id)
  assert.deepEqual(resumed.session!.legs, pack.session.legs)
  assert.deepEqual(resumed.session!.trades, pack.session.trades)
  assert.equal(resumed.session!.status, 'running')
  assert.equal(f.broker.submitted.length, 0)
})

test('handoff rejects Live, another broker, existing destination activity and conflicting history', async t => {
  const root = await mkdtemp(join(tmpdir(), 'n009-handoff-reject-'))
  const source = new Store(join(root, 'source')), target = new Store(join(root, 'target')), f = await fixture()
  t.after(async () => { source.close(); target.close(); await rm(root, { recursive: true, force: true }) })
  await f.start('paper'); source.saveSession(f.controller.session!)
  const pack = exportPaperHandoff(source)
  target.saveBroker({ ...f.broker.credentials!, account: 'other-account' })
  assert.throws(() => importPaperHandoff(target, pack, f.now()), /match/)
  target.saveBroker(f.broker.credentials)
  assert.throws(() => importPaperHandoff(target, { ...pack, session: { ...pack.session, mode: 'live' } }, f.now()), /match/)
  target.saveSession({ ...pack.session, id: 'different-cloud-session' })
  assert.throws(() => importPaperHandoff(target, pack, f.now()), /cannot be overwritten/)
})
