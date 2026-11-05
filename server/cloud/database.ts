import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import type { AppState } from '../../shared/model.ts'
import { CloudCipher } from './crypto.ts'
import type { Sealed } from './crypto.ts'

export interface CloudRequest { route: string; method: string; query: string; csrf: string; body?: string }
export interface CloudResponse { status: number; headers: Record<string, string>; body: string }
export interface CloudJob { id: string; request: CloudRequest; expiresAt: number }
export class CloudDatabase {
  private pool: Pool
  private cipher: CloudCipher
  private ready: Promise<void> | null = null
  constructor(url: string, secret: string) {
    if (!/^postgres(?:ql)?:\/\//.test(url)) throw new Error('Cloud database is not configured.')
    const connection = new URL(url); connection.searchParams.set('sslmode', 'verify-full')
    this.pool = new Pool({ connectionString: connection.toString(), max: 3, connectionTimeoutMillis: 8000, idleTimeoutMillis: 10_000, statement_timeout: 8000, query_timeout: 9000 })
    this.pool.on('error', () => { /* A new query reconnects; errors never print connection credentials. */ })
    this.cipher = new CloudCipher(secret)
  }
  async initialize() {
    this.ready ??= this.pool.query(`CREATE TABLE IF NOT EXISTS n009_engine (
      id text PRIMARY KEY, owner text, lease_until timestamptz, snapshot jsonb, snapshot_at timestamptz, records jsonb, records_at timestamptz);
      INSERT INTO n009_engine(id) VALUES ('default') ON CONFLICT DO NOTHING;
      CREATE TABLE IF NOT EXISTS n009_cloud_jobs (
      id uuid PRIMARY KEY, request jsonb, response jsonb, status text NOT NULL DEFAULT 'queued', owner text,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL, finished_at timestamptz);
      CREATE INDEX IF NOT EXISTS n009_cloud_jobs_waiting ON n009_cloud_jobs(status,created_at);`).then(() => {}).catch(error => { this.ready = null; throw error })
    await this.ready
  }
  async acquire(owner: string) {
    await this.initialize()
    const result = await this.pool.query("UPDATE n009_engine SET owner=$1,lease_until=clock_timestamp()+interval '20 seconds' WHERE id='default' AND (owner=$1 OR lease_until IS NULL OR lease_until<clock_timestamp()) RETURNING id", [owner])
    return result.rowCount === 1
  }
  async renew(owner: string) {
    const result = await this.pool.query("UPDATE n009_engine SET lease_until=clock_timestamp()+interval '20 seconds' WHERE id='default' AND owner=$1 AND lease_until>clock_timestamp() RETURNING id", [owner])
    return result.rowCount === 1
  }
  async loadRecords(): Promise<Record<string, unknown>> {
    await this.initialize()
    const result = await this.pool.query("SELECT records FROM n009_engine WHERE id='default'")
    return result.rows[0]?.records ? this.cipher.open(result.rows[0].records as Sealed) : {}
  }
  async checkpoint(owner: string, records: Record<string, unknown>) {
    const result = await this.pool.query("UPDATE n009_engine SET records=$2,records_at=clock_timestamp() WHERE id='default' AND owner=$1 AND lease_until>clock_timestamp() RETURNING id", [owner, this.cipher.seal(records)])
    if (result.rowCount !== 1) throw new Error('Cloud engine lease lost. State was not committed.')
  }
  async publish(owner: string, state: AppState) {
    const result = await this.pool.query("UPDATE n009_engine SET snapshot=$2,snapshot_at=clock_timestamp() WHERE id='default' AND owner=$1 AND lease_until>clock_timestamp() RETURNING id", [owner, this.cipher.seal(state)])
    if (result.rowCount !== 1) throw new Error('Cloud engine lease lost.')
  }
  async state(): Promise<AppState | null> {
    await this.initialize()
    const result = await this.pool.query("SELECT snapshot FROM n009_engine WHERE id='default' AND snapshot_at>clock_timestamp()-interval '15 seconds' AND lease_until>clock_timestamp()")
    if (!result.rows[0]?.snapshot) return null
    const state = this.cipher.open<AppState>(result.rows[0].snapshot as Sealed)
    return { ...state, serverTime: Date.now() }
  }
  async enqueue(request: CloudRequest) {
    await this.initialize()
    const id = randomUUID()
    const result = await this.pool.query("INSERT INTO n009_cloud_jobs(id,request,expires_at) SELECT $1,$2,clock_timestamp()+interval '24 seconds' WHERE (SELECT count(*) FROM n009_cloud_jobs WHERE status IN ('queued','processing') AND expires_at>clock_timestamp())<32 RETURNING id", [id, this.cipher.seal(request)])
    if (result.rowCount !== 1) throw new Error('Cloud request queue is busy.')
    return id
  }
  async result(id: string): Promise<CloudResponse | null> {
    const result = await this.pool.query('SELECT response FROM n009_cloud_jobs WHERE id=$1', [id])
    return result.rows[0]?.response ? this.cipher.open(result.rows[0].response as Sealed) : null
  }
  async claim(owner: string, limit = 4): Promise<CloudJob[]> {
    // Move secrets out of queued rows as soon as they are claimed. Claimed requests are never replayed after a crash.
    const result = await this.pool.query(`WITH chosen AS (
      SELECT id,request,expires_at FROM n009_cloud_jobs WHERE status='queued' AND expires_at>clock_timestamp()
      AND EXISTS(SELECT 1 FROM n009_engine WHERE id='default' AND owner=$1 AND lease_until>clock_timestamp())
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $2), updated AS (
      UPDATE n009_cloud_jobs j SET status='processing',owner=$1,request=NULL FROM chosen c WHERE j.id=c.id RETURNING j.id)
      SELECT c.id,c.request,c.expires_at FROM chosen c JOIN updated u USING(id)`, [owner, limit])
    return result.rows.map(row => ({ id: row.id as string, request: this.cipher.open<CloudRequest>(row.request as Sealed), expiresAt: new Date(row.expires_at as string).getTime() }))
  }
  async finish(owner: string, id: string, response: CloudResponse) {
    await this.pool.query("UPDATE n009_cloud_jobs SET response=$3,status='complete',request=NULL,finished_at=clock_timestamp() WHERE id=$1 AND owner=$2 AND status='processing' AND EXISTS(SELECT 1 FROM n009_engine WHERE id='default' AND owner=$2 AND lease_until>clock_timestamp())", [id, owner, this.cipher.seal(response)])
  }
  async cleanup() {
    // TTL cleanup affects only this application's transient encrypted RPC queue, never broker records or history.
    await this.pool.query("UPDATE n009_cloud_jobs SET request=NULL,status='expired' WHERE expires_at<clock_timestamp() AND status IN ('queued','processing')")
    await this.pool.query("DELETE FROM n009_cloud_jobs WHERE expires_at<clock_timestamp()-interval '5 minutes'")
  }
  async release(owner: string) { await this.pool.query("UPDATE n009_engine SET lease_until=clock_timestamp(),snapshot=NULL WHERE id='default' AND owner=$1", [owner]) }
  async close() { await this.pool.end() }
}
