import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { captureSnapshot, decryptSnapshot, encryptSnapshot, fingerprint, FirestoreBackups } from '../server/backup/firestore.ts'
import type { Snapshot } from '../server/backup/firestore.ts'
import { Store } from '../server/store.ts'

const project = 'test-project', workspace = 'a'.repeat(64), revision = 'b'.repeat(32)
function snapshot(): Snapshot { return { version: 1, workspace, capturedAt: new Date().toISOString(), key: randomBytes(32).toString('base64'), records: [{ key: 'strategy:settings', value: JSON.stringify({ entryLots: 4 }) }, { key: 'private-marker', value: 'not-public-test-data' }] } }

test('encrypted backups authenticate project, workspace, revision and all bytes; workspace keys remain encrypted', () => {
  const original = snapshot(), key = randomBytes(32), envelope = encryptSnapshot(original, key, project, revision)
  assert.deepEqual(decryptSnapshot(envelope, key, project, workspace, revision), original)
  assert.equal(envelope.ciphertext.includes(Buffer.from(original.key)), false)
  assert.equal(envelope.ciphertext.includes(Buffer.from('not-public-test-data')), false)
  assert.throws(() => decryptSnapshot(envelope, randomBytes(32), project, workspace, revision))
  assert.throws(() => decryptSnapshot(envelope, key, 'other-project', workspace, revision))
  assert.throws(() => decryptSnapshot(envelope, key, project, 'c'.repeat(64), revision))
  assert.throws(() => decryptSnapshot(envelope, key, project, workspace, 'd'.repeat(32)))
  const changed = Buffer.from(envelope.ciphertext); changed[0] ^= 1
  assert.throws(() => decryptSnapshot({ ...envelope, ciphertext: changed }, key, project, workspace, revision))
  assert.throws(() => encryptSnapshot({ ...original, workspace: '../owner' }, key, project, revision))
})

test('SQLite capture includes settings, broker ciphertext, history, reference, pending state and ownership in one recoverable snapshot', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'n009-backup-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const store = new Store(directory)
  store.put('strategy:settings', { entryLots: 4 }); store.put('session', { id: 'same-day', status: 'running', reference: 163.55, pending: { id: 'unknown-order' } })
  store.put('session:history:same-day', { trades: [{ id: 'fill-1', at: 1794000000000 }] }); store.put('auth:broker-owner:test-hash', workspace)
  store.saveBroker({ apiKey: 'test-private-key', accessToken: 'test-access-token', account: 'test-account', name: 'test', expiresAt: Date.now() + 60000 })
  const original = captureSnapshot(directory, 'owner')
  assert.equal(original.records.length, 5)
  assert.equal(JSON.stringify(original.records).includes('test-private-key'), false)
  const first = fingerprint(original)
  assert.equal(fingerprint({ ...original, capturedAt: new Date(Date.now() + 60000).toISOString() }), first)
  store.put('strategy:settings', { entryLots: 6 })
  assert.notEqual(fingerprint(captureSnapshot(directory, 'owner')), first)
  store.close()
  const key = randomBytes(32), restored = decryptSnapshot(encryptSnapshot(original, key, project, revision), key, project, 'owner', revision)
  const target = new Store(join(directory, 'new'), Buffer.from(restored.key, 'base64'))
  try {
    restored.records.forEach(row => target.put(row.key, JSON.parse(row.value)))
    assert.equal(target.broker()!.accessToken, 'test-access-token')
    assert.deepEqual(target.get('session'), { id: 'same-day', status: 'running', reference: 163.55, pending: { id: 'unknown-order' } })
    assert.deepEqual(target.get('strategy:settings'), { entryLots: 4 })
  } finally { target.close() }
})

test('Firestore atomic commits, bounded documents and unchanged suppression preserve the previous backup on failure', async () => {
  let fail = false, commits = 0, reads = 0
  const documents = new Map<string, any>(), key = randomBytes(32)
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer server-only-test-token')
    const path = String(url).replace('https://firestore.googleapis.com/v1/', '')
    if (options?.method === 'POST') {
      commits++
      if (fail) return Response.json({}, { status: 503 })
      const body = JSON.parse(String(options.body))
      for (const write of body.writes) {
        assert.ok(Buffer.byteLength(JSON.stringify(write.update)) < 1024 * 1024)
        assert.equal(JSON.stringify(write.update).includes('not-public-test-data'), false)
      }
      for (const write of body.writes) documents.set(write.update.name, { ...write.update, updateTime: String(commits) })
      return Response.json({ writeResults: body.writes.map(() => ({ updateTime: String(commits) })) })
    }
    reads++
    return documents.has(path) ? Response.json(documents.get(path)) : Response.json({}, { status: 404 })
  }
  const backups = new FirestoreBackups(project, key, async () => 'server-only-test-token', fetcher)
  const original = snapshot()
  original.records.push({ key: 'large-value', value: randomBytes(700000).toString('base64') })
  assert.equal(await backups.save(original), 'saved')
  assert.deepEqual(await backups.restore(workspace), original)
  assert.equal(await backups.save({ ...original, capturedAt: new Date().toISOString() }), 'unchanged')
  assert.equal(commits, 1)
  fail = true
  const changed = { ...original, records: [...original.records, { key: 'new-trade', value: '{}' }] }
  await assert.rejects(backups.save(changed), /HTTP 503/)
  assert.deepEqual(await backups.restore(workspace), original)
  fail = false
  assert.equal(await backups.save(changed), 'saved')
  assert.deepEqual(await backups.restore(workspace), changed)
  assert.ok(reads < 30)
  const manifest = [...documents.entries()].find(([name]) => name.endsWith(workspace))![1]
  const chunkName = `${manifest.name}/slots/${manifest.fields.slot.integerValue}/chunks/0`
  documents.delete(chunkName)
  await assert.rejects(backups.restore(workspace), /Incomplete backup/)
})
