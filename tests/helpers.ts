import { directionOf } from '../shared/strategy.ts'
import type { Candle, Contract, Fill, OrderIntent, TradingSession } from '../shared/model.ts'
import type { PositionRow, TradingBroker } from '../server/broker.ts'
import type { SavedBroker } from '../server/store.ts'
import { Controller } from '../server/controller.ts'
import { istTime } from '../server/time.ts'
import { LEGACY_SETTINGS } from '../shared/settings.ts'

export const DAY = '2026-10-26'
export const bar = (time: string, close = 100): Candle => ({ start: istTime(DAY, time), end: istTime(DAY, time) + 300_000,
  open: 100, high: Math.max(110, close), low: Math.min(90, close), close })
export const contract = (side: 'CE' | 'PE'): Contract => ({ token: side === 'CE' ? '101' : '102', symbol: `NIFTY-TEST-${side}`,
  expiry: '2026-10-27', strike: 25000, lotSize: 65, side })
export class MemoryStore {
  values = new Map<string, unknown>()
  get<T>(key: string): T | null { return structuredClone(this.values.get(key) as T ?? null) }
  put(key: string, value: unknown) { this.values.set(key, structuredClone(value)) }
  saved: TradingSession | null = null
  savedBroker: SavedBroker | null = null
  writes: TradingSession[] = []
  archives = new Map<string, TradingSession>()
  session() { return this.saved ? structuredClone(this.saved) : null }
  saveSession(value: TradingSession) {
    this.saved = structuredClone(value); this.writes.push(structuredClone(value))
    this.archives.set(`${value.date}:${value.account}:${value.mode}${directionOf(value.settings) === 'sell' ? ':sell' : ''}`, structuredClone(value))
  }
  loadSession(account: string, date: string, mode: string, direction = 'buy') { return structuredClone(this.archives.get(`${date}:${account}:${mode}${direction === 'sell' ? ':sell' : ''}`) ?? null) }
  broker() { return this.savedBroker }
  saveBroker(value: SavedBroker | null) { this.savedBroker = value }
}
export class FakeBroker implements TradingBroker {
  credentials: SavedBroker | null = { apiKey: 'test-key', accessToken: 'test-token', account: 'test-account', name: 'Test', expiresAt: istTime(DAY, '23:59') }
  rows = new Map<string, { intent: OrderIntent; fill: Fill | null }>()
  holdings = new Map<string, number>()
  plans: Array<{ quantity?: number; average?: number; status?: string; pending?: boolean }> = []
  candles = new Map<string, Candle[]>()
  submitted: OrderIntent[] = []
  cancellations: string[] = []
  positionFailure = false
  timeoutSubmission = false
  beforePlace: (() => void) | null = null
  async verifyAccount() {}
  async history(token: string): Promise<Candle[]> { return this.candles.get(token) ?? [bar('09:15')] }
  async contracts(): Promise<[Contract, Contract]> { return [contract('CE'), contract('PE')] }
  async positions(): Promise<PositionRow[]> {
    if (this.positionFailure) throw new Error('Position request timed out.')
    return [...this.holdings].map(([symbol, quantity]) => ({ symbol, quantity, exchange: 'NFO', product: 'MIS' }))
  }
  async quotes() { return [] }
  async place(intent: OrderIntent) {
    this.beforePlace?.()
    this.submitted.push(structuredClone(intent))
    if (this.timeoutSubmission) throw new Error('Acknowledgement timed out.')
    const id = `ORDER-${this.rows.size + 1}`, plan = this.plans.shift() ?? {}
    const fill = plan.pending ? null : { orderId: id, quantity: plan.quantity ?? intent.quantity, average: plan.average ?? 100, status: plan.status ?? 'COMPLETE' }
    this.rows.set(id, { intent, fill })
    return id
  }
  async order(intent: OrderIntent) {
    const row = this.rows.get(intent.orderId!)
    if (!row?.fill) return null
    const fill = row.fill
    // Each confirmed terminal response may be re-read after a crash. The
    // fake exchange applies its fill once, independently of the engine store.
    if (!(row as typeof row & { applied?: boolean }).applied) {
      this.holdings.set(intent.symbol, (this.holdings.get(intent.symbol) ?? 0) + (intent.transaction === 'BUY' ? fill.quantity : -fill.quantity))
      Object.assign(row, { applied: true })
    }
    return fill
  }
  async findOrder(intent: OrderIntent) { return [...this.rows].find(([, row]) => row.intent.tag === intent.tag)?.[0] ?? null }
  async cancel(id: string) { this.cancellations.push(id) }
}
export async function fixture() {
  let time = istTime(DAY, '09:20') + 1000
  const broker = new FakeBroker(), store = new MemoryStore()
  store.savedBroker = broker.credentials
  const feed = { status: 'disconnected' as 'disconnected' | 'connected' | 'connecting', lastTickAt: null as number | null,
    connect() { this.status = 'connected' }, close() { this.status = 'disconnected' }, onMark: (_mark: import('../shared/model.ts').Mark) => {}, onChange() {} }
  // Existing execution fixtures cover saved 3-lot sessions and their 1+2 split.
  store.put('strategy:settings', LEGACY_SETTINGS)
  const controller = new Controller(broker, store, feed, () => time)
  await controller.restore()
  return { controller, broker, store, feed, now: () => time, setTime: (value: number) => { time = value },
    mark: (side: 'CE' | 'PE', price: number, source: 'rest' | 'websocket' = 'websocket') => {
      controller.marks[contract(side).token] = { token: contract(side).token, price, receivedAt: time, source }
    },
    async start(mode: 'paper' | 'live' = 'live') {
      await controller.start(mode)
      // start schedules one non-blocking pump. Wait for its serial work to settle.
      for (let i = 0; i < 30 && (!controller.session?.legs.CE || controller.busy); i++) await new Promise(resolve => setImmediate(resolve))
      if (!controller.session?.legs.CE) throw new Error('Fixture failed to prepare its opening reference.')
    },
  }
}
