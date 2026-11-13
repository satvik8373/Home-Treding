import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { AccountSync, firestoreClient } from './accountSync.ts'
import { fingerprint } from './firestore.ts'
import type { Snapshot } from './firestore.ts'
import type { TradingSession } from '../../shared/model.ts'

interface DailyBatch { day: string; revision: number; snapshot: Snapshot }
export const dailyScope = (workspace: string, day: string) => createHash('sha256').update(`daily:${workspace}:${day}`).digest('hex')
const updated = (session: TradingSession) => Math.max(0, ...session.activity.map(x => x.at), ...session.trades.map(x => x.at), ...(session.orderAudit ?? []).map(x => x.updatedAt), ...(session.decisionAudit ?? []).map(x => x.evaluatedAt))
/** Union immutable journal entries; never overwrite fuller cloud history with a partial recovery seed. */
export function mergeDaily(previous: Snapshot | null, latest: Snapshot): Snapshot {
  if (!previous) return latest
  if (previous.workspace !== latest.workspace) throw new Error('Daily archive scope mismatch.')
  const rows = new Map(previous.records.map(row => [row.key, row]))
  for (const row of latest.records) {
    const old = rows.get(row.key)
    if (old && row.key.startsWith('session:history:') && updated(JSON.parse(old.value)) > updated(JSON.parse(row.value))) continue
    if (old && row.key === 'archive:meta' && JSON.parse(old.value).coverage === 'recorded') { const meta = JSON.parse(row.value); meta.coverage = 'recorded'; rows.set(row.key, { key: row.key, value: JSON.stringify(meta) }); continue }
    rows.set(row.key, row)
  }
  return { ...latest, records: [...rows.values()].sort((a, b) => a.key.localeCompare(b.key)) }
}
export function captureDaily(directory: string, workspace: string, limit = 2): DailyBatch[] {
  const db = new DatabaseSync(join(directory, '009.sqlite'), { readOnly: true })
  try {
    db.exec('BEGIN')
    const days = db.prepare('SELECT * FROM history_days WHERE revision>syncedRevision ORDER BY day DESC LIMIT ?').all(limit) as { day: string; revision: number; coverage: string }[]
    return days.map(day => {
      const sessions = db.prepare('SELECT id,value FROM history_sessions WHERE day=? ORDER BY id').all(day.day) as { id: string; value: string }[]
      const events = db.prepare('SELECT id,value FROM history_events WHERE day=? ORDER BY id').all(day.day) as { id: string; value: string }[]
      return { day: day.day, revision: day.revision, snapshot: { version: 1, workspace: dailyScope(workspace, day.day), capturedAt: new Date().toISOString(), key: readFileSync(join(directory, 'session.key')).toString('base64'), records: [
        { key: 'archive:meta', value: JSON.stringify({ day: day.day, coverage: day.coverage, scope: 'Engine history; not a full broker ledger' }) },
        ...sessions.map(row => ({ key: `session:history:${row.id}`, value: row.value })), ...events.map(row => ({ key: `journal:${row.id}`, value: row.value })),
      ].sort((a, b) => a.key.localeCompare(b.key)) } }
    })
  } finally { db.close() }
}
export function createHistorySync(directory: string): AccountSync<DailyBatch[]> | undefined {
  if (!process.env.N009_FIREBASE_PROJECT_ID || !process.env.N009_BACKUP_KEY_FILE || !process.env.GOOGLE_APPLICATION_CREDENTIALS) return undefined
  const workspace = /^[a-f0-9]{64}$/.test(basename(directory)) ? basename(directory) : 'owner'
  const sync = new AccountSync(() => captureDaily(directory, workspace), async batch => {
    await syncDailyBatch(directory, workspace, batch)
    if (captureDaily(directory, workspace, 1).length) sync.request()
  }, Date.now, 60_000)
  return sync
}
export async function syncDailyBatch(directory: string, workspace: string, batch: ReturnType<typeof captureDaily>) {
  const client = firestoreClient(workspace)
  let failed = false
  for (const day of batch) {
    try {
    const previous = await client.load(day.snapshot.workspace)
    await client.save(mergeDaily(previous, day.snapshot), previous ? fingerprint(previous) : null)
    const db = new DatabaseSync(join(directory, '009.sqlite'))
    try { db.prepare('UPDATE history_days SET syncedRevision=max(syncedRevision,?),syncedAt=? WHERE day=?').run(day.revision, Date.now(), day.day) } finally { db.close() }
    } catch { failed = true }
  }
  if (failed) throw new Error('One or more daily archives are pending. Local history is retained and retries continue.')
}
