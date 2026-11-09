import { JWT } from 'google-auth-library'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { captureSnapshot, FirestoreBackups } from '../server/backup/firestore.ts'
import { Store } from '../server/store.ts'

/** Independent worker. No broker calls, strategy start, or automatic state rollback. */
async function main() {
  const project = process.env.N009_FIREBASE_PROJECT_ID, credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS, keyFile = process.env.N009_BACKUP_KEY_FILE
  const data = resolve(process.env.N009_DATA_DIR || 'data')
  if (!project || !credentialsFile || !keyFile) throw new Error('Firestore backup is not configured. Set the project, private service-account path and backup-key path.')
  const credentials = JSON.parse(readFileSync(credentialsFile, 'utf8'))
  if (credentials.type !== 'service_account' || credentials.project_id !== project || typeof credentials.private_key !== 'string' || typeof credentials.client_email !== 'string') throw new Error('Use a service-account JSON for this Firebase project, not its public web configuration.')
  const auth = new JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ['https://www.googleapis.com/auth/datastore'] })
  const backups = new FirestoreBackups(project, readFileSync(keyFile), async () => {
    const { token } = await auth.getAccessToken()
    if (!token) throw new Error('Firestore server authentication unavailable.')
    return token
  })
  if (process.argv[2] === 'restore') {
    const workspace = process.argv[3], destinationArg = process.argv[4]
    if (!workspace || !destinationArg) throw new Error('Usage: restore <owner|workspace-id> <new-staging-directory>')
    const destination = resolve(destinationArg)
    if (existsSync(destination)) throw new Error('Recovery requires a new directory. Existing engine data is never overwritten.')
    const snapshot = await backups.restore(workspace)
    mkdirSync(destination, { mode: 0o700 })
    writeFileSync(join(destination, 'session.key'), Buffer.from(snapshot.key, 'base64'), { mode: 0o600, flag: 'wx' })
    const store = new Store(destination)
    try {
      for (const row of snapshot.records) {
        const value = JSON.parse(row.value)
        if (row.key === 'session' && value && typeof value === 'object') {
          value.status = 'blocked'; value.message = 'Recovered from backup. Verify broker positions and pending orders before explicitly resuming.'
        }
        store.put(row.key, value)
      }
    } finally { store.close() }
    console.log(JSON.stringify({ status: 'restored-to-staging', workspace, capturedAt: snapshot.capturedAt, tradingStarted: false }))
    return
  }
  if (process.argv[2] && process.argv[2] !== 'backup') throw new Error('Expected backup or restore command.')
  const lock = join(data, 'firestore-backup.pid')
  try { writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 }) }
  catch {
    const pid = Number(readFileSync(lock, 'utf8'))
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('Backup lock needs operator review.')
    try { process.kill(pid, 0); throw new Error('A backup worker is already running.') }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH')) throw error }
    unlinkSync(lock); writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 })
  }
  const results: { workspace: string; status: string }[] = []
  try {
    const tenants = join(data, 'tenants')
    const ids = existsSync(tenants) ? readdirSync(tenants, { withFileTypes: true }).filter(entry => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name)).map(entry => entry.name) : []
    if (ids.length > 4) throw new Error('Backup free-tier bound is four Google workspaces plus the owner. Review capacity before increasing it.')
    for (const workspace of ['owner', ...ids]) {
      try { results.push({ workspace, status: await backups.save(captureSnapshot(workspace === 'owner' ? data : join(tenants, workspace), workspace)) }) }
      catch { results.push({ workspace, status: 'failed' }) }
    }
    const status = { checkedAt: new Date().toISOString(), results, healthy: results.every(row => row.status !== 'failed') }
    const temporary = join(data, 'firestore-backup-status.json.tmp')
    writeFileSync(temporary, JSON.stringify(status), { mode: 0o600 }); renameSync(temporary, join(data, 'firestore-backup-status.json'))
    // No account identifiers, tokens, keys, or backend response bodies in logs.
    console.log(JSON.stringify({ workspaces: results.length, saved: results.filter(row => row.status === 'saved').length, unchanged: results.filter(row => row.status === 'unchanged').length, healthy: status.healthy }))
    if (!status.healthy) process.exitCode = 1
  } finally { unlinkSync(lock) }
}
main().catch(() => { console.error('Firestore backup/recovery did not complete. Check private configuration, IAM, quota, and backup size. Engine state has not been replaced.'); process.exitCode = 1 })
