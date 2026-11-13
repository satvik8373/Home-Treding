import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { JWT } from 'google-auth-library'
import { captureSnapshot, FirestoreBackups } from './firestore.ts'
import type { Snapshot } from './firestore.ts'

export interface AccountPersistence { firestore: 'unconfigured' | 'pending' | 'synced' | 'unavailable'; lastSyncedAt: number | null }
/** Coalesces durable mutations only. Market ticks never cause Firestore writes. Trading never waits on this network. */
export class AccountSync<T = Snapshot> {
  state: AccountPersistence = { firestore: 'pending', lastSyncedAt: null }
  onStatus = () => {}
  private generation = 0
  private savedGeneration = -1
  private nextAttempt = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: Promise<void> | null = null
  private closed = false
  constructor(private capture: () => T, private upload: (value: T) => Promise<unknown>, private now = Date.now, private minimumInterval = 10_000) {}
  private notify() { try { this.onStatus() } catch { /* UI notification failures cannot affect durable trading state. */ } }
  request = () => {
    if (this.closed) return
    this.generation++
    this.state = { ...this.state, firestore: 'pending' }; this.notify()
    this.schedule()
  }
  private schedule() {
    if (this.closed || this.timer || this.pending) return
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush() }, Math.max(3000, this.nextAttempt - this.now()))
    this.timer.unref?.()
  }
  async flush(): Promise<void> {
    if (this.pending) return this.pending
    if (this.closed || this.savedGeneration === this.generation) return
    if (this.now() < this.nextAttempt) { this.schedule(); return }
    const version = this.generation
    this.nextAttempt = this.now() + this.minimumInterval
    this.pending = (async () => {
      try {
        await this.upload(this.capture())
        this.savedGeneration = version
        this.state = { firestore: this.generation === version ? 'synced' : 'pending', lastSyncedAt: this.now() }
      } catch {
        this.nextAttempt = this.now() + 30_000
        this.state = { ...this.state, firestore: 'unavailable' }
      }
      this.notify()
    })().finally(() => {
      this.pending = null
      if (this.savedGeneration !== this.generation) this.schedule()
    })
    return this.pending
  }
  close() { this.closed = true; if (this.timer) clearTimeout(this.timer) }
}

let configured: { project: string; key: Buffer; access: () => Promise<string>; backups: FirestoreBackups } | undefined
export function firestoreClient(parentWorkspace?: string): FirestoreBackups {
  const project = process.env.N009_FIREBASE_PROJECT_ID!, keyFile = process.env.N009_BACKUP_KEY_FILE!, serviceFile = process.env.GOOGLE_APPLICATION_CREDENTIALS!
  if (!configured) {
    const credentials = JSON.parse(readFileSync(serviceFile, 'utf8'))
    if (credentials.type !== 'service_account' || credentials.project_id !== project) throw new Error('Invalid Firestore configuration.')
    const auth = new JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ['https://www.googleapis.com/auth/datastore'] })
    const key = readFileSync(keyFile), access = async () => { const result = await auth.getAccessToken(); if (!result.token) throw new Error('Firestore authentication unavailable.'); return result.token }
    configured = { project, key, access, backups: new FirestoreBackups(project, key, access) }
  }
  if (configured.project !== project) throw new Error('Firestore project mismatch.')
  return parentWorkspace ? new FirestoreBackups(project, configured.key, configured.access, fetch, parentWorkspace) : configured.backups
}
export function createAccountSync(directory: string): AccountSync | undefined {
  const project = process.env.N009_FIREBASE_PROJECT_ID, keyFile = process.env.N009_BACKUP_KEY_FILE, serviceFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!project || !keyFile || !serviceFile) return undefined
  try {
  firestoreClient()
  } catch {
    return new AccountSync(() => captureSnapshot(directory, /^[a-f0-9]{64}$/.test(basename(directory)) ? basename(directory) : 'owner'), async () => { throw new Error('Firestore configuration unavailable.') })
  }
  const workspace = /^[a-f0-9]{64}$/.test(basename(directory)) ? basename(directory) : 'owner'
  const backups = configured!.backups
  return new AccountSync(() => captureSnapshot(directory, workspace), snapshot => backups.save(snapshot))
}
