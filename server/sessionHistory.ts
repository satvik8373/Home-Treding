import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { TradingSession } from '../shared/model.ts'
import { directionOf } from '../shared/strategy.ts'
import { productFor, settingsFor } from '../shared/settings.ts'
import { cycles, summarize } from '../shared/analytics.ts'
import type { AnalyticsFilters } from '../shared/analytics.ts'

export type HistoryKind = 'activity' | 'decision' | 'order' | 'trade'
export interface HistoryEvent { id: string; day: string; sessionId: string; kind: HistoryKind; at: number; data: unknown }
export interface HistoryDay { day: string; revision: number; syncedRevision: number; syncedAt: number | null; coverage: 'recorded' | 'legacy-partial' }

/** Append-only engine journal, separate from credentials and the bounded live UI activity list. */
export class SessionHistory {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS history_events(id TEXT PRIMARY KEY,day TEXT NOT NULL,session_id TEXT NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL,value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS history_events_day ON history_events(day,at,id);
      CREATE INDEX IF NOT EXISTS history_events_session ON history_events(session_id,at,id);
      CREATE TABLE IF NOT EXISTS history_days(day TEXT PRIMARY KEY,revision INTEGER NOT NULL,syncedRevision INTEGER NOT NULL DEFAULT 0,syncedAt INTEGER,coverage TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history_sessions(id TEXT PRIMARY KEY,day TEXT NOT NULL,mode TEXT NOT NULL,account TEXT NOT NULL,direction TEXT NOT NULL,product TEXT NOT NULL,value TEXT NOT NULL,summary TEXT,cycles TEXT);
      CREATE INDEX IF NOT EXISTS history_sessions_day ON history_sessions(day,mode);
      CREATE TABLE IF NOT EXISTS history_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`)
    const columns = this.db.prepare('PRAGMA table_info(history_sessions)').all() as { name: string }[]
    for (const column of ['summary', 'cycles']) if (!columns.some(value => value.name === column)) db.exec(`ALTER TABLE history_sessions ADD COLUMN ${column} TEXT`)
  }
  capture(session: TradingSession, changed: boolean, legacy = false) {
    if (!session.id || !/^\d{4}-\d{2}-\d{2}$/.test(session.date ?? '') || !Array.isArray(session.trades) || !Array.isArray(session.activity)) return
    const summary = summarize(session)
    this.db.prepare('INSERT INTO history_sessions VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,mode=excluded.mode,account=excluded.account,direction=excluded.direction,product=excluded.product,summary=excluded.summary,cycles=excluded.cycles WHERE value<>excluded.value OR summary IS NULL').run(session.id, session.date, session.mode, session.account, directionOf(session.settings), productFor(settingsFor(session)), JSON.stringify(session), JSON.stringify(summary), JSON.stringify(summary.realizedGross == null ? [] : cycles(session)))
    let inserted = false
    const insert = this.db.prepare('INSERT OR IGNORE INTO history_events VALUES(?,?,?,?,?,?)')
    const append = (kind: HistoryKind, at: number, data: unknown) => {
      if (!Number.isFinite(at)) return
      const id = createHash('sha256').update(JSON.stringify([session.id, kind, at, data])).digest('hex')
      const event: HistoryEvent = { id, day: session.date, sessionId: session.id, kind, at, data }
      const result = insert.run(id, session.date, session.id, kind, at, JSON.stringify(event))
      inserted ||= result.changes > 0
    }
    for (const event of session.activity) append('activity', event.at, event)
    for (const event of session.decisionAudit ?? []) append('decision', event.evaluatedAt, event)
    for (const order of session.orderAudit ?? []) {
      for (const event of order.events ?? []) append('order', event.at, { id: order.id, side: order.side, symbol: order.symbol, transaction: order.transaction, quantity: order.quantity, reason: order.reason, ...event })
      append('order', order.updatedAt, order)
    }
    for (const trade of session.trades) append('trade', trade.at, trade)
    if (changed || inserted) this.db.prepare(`INSERT INTO history_days(day,revision,coverage) VALUES(?,1,?) ON CONFLICT(day) DO UPDATE SET revision=revision+1`).run(session.date, legacy ? 'legacy-partial' : 'recorded')
  }
  days(): HistoryDay[] { return this.db.prepare('SELECT * FROM history_days ORDER BY day').all() as unknown as HistoryDay[] }
  metadata(): { earliest: string | null; accounts: string[] } {
    return { earliest: (this.db.prepare('SELECT min(day) AS earliest FROM history_sessions').get() as { earliest: string | null }).earliest, accounts: (this.db.prepare('SELECT DISTINCT account FROM history_sessions ORDER BY account').all() as { account: string }[]).map(row => row.account) }
  }
  sessions(from = '0000-01-01', to = '9999-12-31', compact = false): TradingSession[] { return (this.db.prepare(`SELECT ${compact ? "json_remove(value,'$.activity','$.decisionAudit')" : 'value'} AS value FROM history_sessions WHERE day>=? AND day<=? ORDER BY day,id`).all(from, to) as { value: string }[]).map(row => JSON.parse(row.value)) }
  session(id: string): TradingSession | null { const row = this.db.prepare('SELECT value FROM history_sessions WHERE id=?').get(id) as { value: string } | undefined; return row ? JSON.parse(row.value) : null }
  summaries(filters: AnalyticsFilters) {
    const rows = this.db.prepare(`SELECT summary,cycles FROM history_sessions WHERE day>=? AND day<=? AND mode=? AND (?='' OR account=?) AND (?='all' OR direction=?) AND (?='all' OR product=?) ORDER BY day,id`).all(filters.from, filters.to, filters.mode, filters.account, filters.account, filters.strategy, filters.strategy, filters.product, filters.product) as { summary: string; cycles: string }[]
    return rows.map(row => ({ summary: JSON.parse(row.summary) as ReturnType<typeof summarize>, cycles: JSON.parse(row.cycles) as ReturnType<typeof cycles> }))
  }
  events(sessionId: string, kind: HistoryKind | undefined, offset = 0, limit = 100): { events: HistoryEvent[]; total: number } {
    const args = kind ? [sessionId, kind] : [sessionId], where = kind ? 'session_id=? AND kind=?' : 'session_id=?'
    const total = Number((this.db.prepare(`SELECT count(*) AS n FROM history_events WHERE ${where}`).get(...args) as { n: number }).n)
    const rows = this.db.prepare(`SELECT value FROM history_events WHERE ${where} ORDER BY at,id LIMIT ? OFFSET ?`).all(...args, limit, offset) as { value: string }[]
    return { events: rows.map(row => JSON.parse(row.value)), total }
  }
}
