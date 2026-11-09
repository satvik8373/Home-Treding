import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

const MAX_PLAIN = 64 * 1024 * 1024, MAX_ENCRYPTED = 4 * 1024 * 1024, CHUNK = 512 * 1024
const collection = 'n009EngineBackups'
const validWorkspace = (id: string) => id === 'owner' || /^[a-f0-9]{64}$/.test(id)
export interface Snapshot { version: 1; workspace: string; capturedAt: string; key: string; records: { key: string; value: string }[] }
interface Envelope { iv: string; tag: string; ciphertext: Buffer }
type Fields = Record<string, { stringValue?: string; integerValue?: string; bytesValue?: string }>
type Document = { name: string; fields: Fields; updateTime?: string }
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')
function validateScope(project: string, workspace: string) {
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(project) || !validWorkspace(workspace)) throw new Error('Invalid backup scope.')
}
export function captureSnapshot(directory: string, workspace: string): Snapshot {
  if (!validWorkspace(workspace)) throw new Error('Invalid workspace.')
  const key = readFileSync(join(directory, 'session.key'))
  if (key.length !== 32) throw new Error('Invalid workspace encryption key.')
  const db = new DatabaseSync(join(directory, '009.sqlite'), { readOnly: true })
  try {
    db.exec('BEGIN')
    const size = db.prepare('SELECT coalesce(sum(length(CAST(key AS BLOB))+length(CAST(value AS BLOB))),0) AS size FROM records').get() as { size: number }
    if (size.size > MAX_PLAIN / 2) throw new Error('Workspace exceeds the bounded backup size; local state is retained.')
    const records = db.prepare('SELECT key,value FROM records ORDER BY key').all() as { key: string; value: string }[]
    return { version: 1, workspace, capturedAt: new Date().toISOString(), key: key.toString('base64'), records }
  } finally { db.close() }
}
export function fingerprint(snapshot: Snapshot) {
  // Capture time is deliberately excluded: unchanged workspaces cost no new writes.
  return hash(JSON.stringify({ workspace: snapshot.workspace, key: snapshot.key, records: snapshot.records }))
}
export function encryptSnapshot(snapshot: Snapshot, backupKey: Buffer, project: string, revision: string): Envelope {
  validateScope(project, snapshot.workspace)
  if (backupKey.length !== 32 || !/^[a-f0-9]{32}$/.test(revision)) throw new Error('Invalid backup encryption configuration.')
  const plain = Buffer.from(JSON.stringify(snapshot))
  if (plain.length > MAX_PLAIN) throw new Error('Snapshot exceeds the backup size limit.')
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', backupKey, iv)
  cipher.setAAD(Buffer.from(`${project}:${snapshot.workspace}:${revision}:v1`))
  const ciphertext = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()])
  if (ciphertext.length > MAX_ENCRYPTED) throw new Error('Compressed snapshot exceeds the backup size limit; local state is retained.')
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext }
}
export function decryptSnapshot(envelope: Envelope, backupKey: Buffer, project: string, workspace: string, revision: string): Snapshot {
  validateScope(project, workspace)
  if (backupKey.length !== 32 || envelope.ciphertext.length > MAX_ENCRYPTED || !/^[a-f0-9]{32}$/.test(revision)) throw new Error('Invalid backup.')
  const decipher = createDecipheriv('aes-256-gcm', backupKey, Buffer.from(envelope.iv, 'base64'))
  decipher.setAAD(Buffer.from(`${project}:${workspace}:${revision}:v1`)); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const compressed = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()])
  const result = JSON.parse(gunzipSync(compressed, { maxOutputLength: MAX_PLAIN }).toString('utf8')) as Snapshot
  if (result.version !== 1 || result.workspace !== workspace || !Number.isFinite(Date.parse(result.capturedAt)) || Buffer.from(result.key, 'base64').length !== 32 || !Array.isArray(result.records)
    || result.records.some(row => typeof row.key !== 'string' || typeof row.value !== 'string') || new Set(result.records.map(row => row.key)).size !== result.records.length) throw new Error('Invalid backup payload.')
  return result
}

/** A separate worker, never on the trading loop. Server OAuth/IAM only; browsers cannot read backups. */
export class FirestoreBackups {
  private root: string
  constructor(private project: string, private backupKey: Buffer, private accessToken: () => Promise<string>, private fetcher: typeof fetch = fetch) {
    validateScope(project, 'owner')
    if (backupKey.length !== 32) throw new Error('Invalid backup key.')
    this.root = `projects/${project}/databases/(default)/documents`
  }
  private name(workspace: string) { validateScope(this.project, workspace); return `${this.root}/${collection}/${workspace}` }
  private async request(path: string, method = 'GET', body?: object): Promise<Document | { writeResults: { updateTime: string }[] } | null> {
    const token = await this.accessToken()
    const response = await this.fetcher(`https://firestore.googleapis.com/v1/${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (response.status === 404 && method === 'GET') return null
    if (!response.ok) throw new Error(`Firestore backup request failed (HTTP ${response.status}).`)
    return await response.json()
  }
  async save(snapshot: Snapshot): Promise<'saved' | 'unchanged'> {
    const name = this.name(snapshot.workspace), previous = await this.request(name) as Document | null
    const digest = fingerprint(snapshot)
    // Authenticate the remote fingerprint so altered metadata cannot suppress a needed backup.
    if (previous?.fields.fingerprint?.stringValue === digest) {
      const recovered = await this.restore(snapshot.workspace)
      if (fingerprint(recovered) === digest) return 'unchanged'
    }
    const slot = previous?.fields.slot?.integerValue === '0' ? 1 : 0, revision = randomBytes(16).toString('hex')
    const encrypted = encryptSnapshot(snapshot, this.backupKey, this.project, revision), writes: object[] = []
    let count = 0
    for (let offset = 0; offset < encrypted.ciphertext.length; offset += CHUNK) {
      writes.push({ update: { name: `${name}/slots/${slot}/chunks/${count++}`, fields: { encryptedState: { bytesValue: encrypted.ciphertext.subarray(offset, offset + CHUNK).toString('base64') }, revision: { stringValue: revision } } } })
    }
    writes.push({ update: { name, fields: { version: { integerValue: '1' }, slot: { integerValue: String(slot) }, count: { integerValue: String(count) }, revision: { stringValue: revision },
      iv: { stringValue: encrypted.iv }, tag: { stringValue: encrypted.tag }, fingerprint: { stringValue: digest }, capturedAt: { stringValue: snapshot.capturedAt } } },
      currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false } })
    // One atomic commit publishes all chunks and their manifest together. Keep previous slot for recovery.
    await this.request(`${this.root}:commit`, 'POST', { writes })
    return 'saved'
  }
  async restore(workspace: string): Promise<Snapshot> {
    const name = this.name(workspace), doc = await this.request(name) as Document | null
    if (!doc) throw new Error('No Firestore backup exists for this workspace.')
    const f = doc.fields, count = Number(f.count?.integerValue), slot = f.slot?.integerValue, revision = f.revision?.stringValue ?? ''
    if (f.version?.integerValue !== '1' || !Number.isInteger(count) || count < 1 || count > 8 || !['0', '1'].includes(slot ?? '') || !/^[a-f0-9]{32}$/.test(revision)) throw new Error('Invalid backup manifest.')
    const parts: Buffer[] = []
    for (let n = 0; n < count; n++) {
      const chunk = await this.request(`${name}/slots/${slot}/chunks/${n}`) as Document | null
      if (chunk?.fields.revision?.stringValue !== revision || typeof chunk.fields.encryptedState?.bytesValue !== 'string' || chunk.fields.encryptedState.bytesValue.length > CHUNK * 1.4) throw new Error('Incomplete backup; no state restored.')
      const bytes = Buffer.from(chunk.fields.encryptedState.bytesValue, 'base64')
      if (bytes.length > CHUNK) throw new Error('Invalid backup chunk.')
      parts.push(bytes)
    }
    const snapshot = decryptSnapshot({ iv: f.iv?.stringValue ?? '', tag: f.tag?.stringValue ?? '', ciphertext: Buffer.concat(parts) }, this.backupKey, this.project, workspace, revision)
    if (fingerprint(snapshot) !== f.fingerprint?.stringValue) throw new Error('Backup integrity check failed.')
    return snapshot
  }
}
