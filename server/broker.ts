import { parse } from 'csv-parse/sync'
import type { Candle, Contract, Fill, Mark, OrderIntent } from '../shared/model.ts'
import { FIVE_MINUTES, istDate, istTime, parseBrokerTime } from './time.ts'
import { validCandle } from './strategy.ts'
import type { SavedBroker } from './store.ts'
import { matchesOrderRow, rejectionSummary } from './orderIdentity.ts'

const ROOT = 'https://api.mstock.trade/openapi/typea'
export const INDEX_TOKEN = '26000'
type Row = Record<string, unknown>
const record = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {}
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export class BrokerError extends Error {
  constructor(message: string, public definitive = false) { super(message) }
}
export interface PositionRow { symbol: string; exchange: string; product: string; quantity: number }
export interface TradingBroker {
  credentials: SavedBroker | null
  history(token: string, exchange: 'NSE' | 'NFO', day: string, now: number): Promise<Candle[]>
  contracts(day: string, spot: number): Promise<[Contract, Contract]>
  positions(): Promise<PositionRow[]>
  quotes(contracts: Contract[]): Promise<Mark[]>
  place(intent: OrderIntent): Promise<string>
  order(intent: OrderIntent): Promise<Fill | null>
  findOrder(intent: OrderIntent): Promise<string | null>
  cancel(orderId: string): Promise<void>
}

/** Direct Type A endpoints. Trading POSTs are never retried. */
export class MStock implements TradingBroker {
  credentials: SavedBroker | null = null
  private fetcher: typeof fetch
  private dataQueue: Promise<unknown> = Promise.resolve()
  private lastDataAt = 0
  private master: Row[] = []
  private masterDate = ''
  constructor(fetcher: typeof fetch = fetch) { this.fetcher = fetcher }

  async request(path: string, method = 'GET', form?: Record<string, string>, authenticated = true, text = false): Promise<unknown> {
    if (authenticated && (!this.credentials || this.credentials.expiresAt <= Date.now())) throw new BrokerError('mStock session expired. Reconnect your broker.', true)
    const headers: Record<string, string> = { 'X-Mirae-Version': '1' }
    if (authenticated && this.credentials) headers.Authorization = `token ${this.credentials.apiKey}:${this.credentials.accessToken}`
    if (form) headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const response = await this.fetcher(`${ROOT}${path}`, { method, headers,
      body: form ? new URLSearchParams(form) : undefined, signal: AbortSignal.timeout(12_000), redirect: 'error' })
    const raw = await response.text()
    let body: Row = {}
    try { body = record(JSON.parse(raw)) } catch { /* CSV is the only non-JSON endpoint used. */ }
    if (!response.ok || body.status === 'error') {
      // Never include requests, headers, credentials, or full response bodies in errors.
      let message = typeof body.message === 'string' ? body.message.slice(0, 240) : `mStock request failed (HTTP ${response.status}).`
      for (const secret of [this.credentials?.apiKey, this.credentials?.accessToken, ...Object.values(form ?? {})])
        if (secret && secret.length >= 4) message = message.split(secret).join('[redacted]')
      throw new BrokerError(message, response.status < 500 && response.status !== 408)
    }
    if (text) return raw
    if (body.status !== 'success') throw new BrokerError('mStock returned an unexpected response.')
    return body.data
  }
  async login(username: string, password: string): Promise<void> {
    await this.request('/connect/login', 'POST', { username, password }, false)
  }
  async verify(apiKey: string, code: string, method: 'otp' | 'totp', expectedAccount: string): Promise<SavedBroker> {
    const data = record(await this.request(method === 'totp' ? '/session/verifytotp' : '/session/token', 'POST',
      method === 'totp' ? { api_key: apiKey, totp: code } : { api_key: apiKey, request_token: code, checksum: 'L' }, false))
    if (typeof data.access_token !== 'string' || !data.access_token || !data.user_id) throw new BrokerError('mStock did not return a verified session.')
    const account = String(data.user_id)
    // user_id can be an internal numeric ID, different from the login code.
    const now = Date.now(), midnight = istTime(istDate(now + 86_400_000), '00:00')
    return { apiKey, accessToken: data.access_token, account,
      ...(Array.isArray(data.exchanges) && Array.isArray(data.products) && Array.isArray(data.order_types)
        ? { permissions: { exchanges: data.exchanges.map(value => String(value).trim().toUpperCase()), products: data.products.map(value => String(value).trim().toUpperCase()), orderTypes: data.order_types.map(value => String(value).trim().toUpperCase()) } } : {}),
      name: String(data.user_name || expectedAccount), expiresAt: Math.min(now + 12 * 3_600_000, midnight) }
  }
  async verifyAccount(): Promise<void> { await this.request('/user/fundsummary') }
  async logout(): Promise<void> { await this.request('/logout') }
  private async dataCall<T>(work: () => Promise<T>): Promise<T> {
    const result = this.dataQueue.catch(() => {}).then(async () => {
      await pause(Math.max(0, this.lastDataAt + 1100 - Date.now()))
      this.lastDataAt = Date.now()
      return work()
    })
    this.dataQueue = result
    return result
  }
  async history(token: string, exchange: 'NSE' | 'NFO', day: string, now: number, includeForming = false): Promise<Candle[]> {
    const from = `${day} 09:15:00`, to = `${day} 15:30:00`
    const path = `/instruments/historical/${exchange}/${encodeURIComponent(token)}/5minute?${new URLSearchParams({ from, to })}`
    let raw: unknown, usedIntraday = false
    try { raw = await this.dataCall(() => this.request(path)) }
    catch {
      if (day !== istDate(now)) throw new BrokerError('Historical candles are unavailable for this date.')
      usedIntraday = true
      raw = await this.dataCall(() => this.request(`/instruments/intraday/${exchange === 'NFO' ? 2 : 1}/${encodeURIComponent(token)}/5minute`))
    }
    let rows = record(raw).candles
    if ((!Array.isArray(rows) || !rows.length) && day === istDate(now) && !usedIntraday) {
      rows = record(await this.dataCall(() => this.request(`/instruments/intraday/${exchange === 'NFO' ? 2 : 1}/${encodeURIComponent(token)}/5minute`))).candles
    }
    if (!Array.isArray(rows)) throw new BrokerError('mStock returned no candle array from either history endpoint.')
    return normalizeCandles(rows, day, includeForming ? now + FIVE_MINUTES : now)
  }
  private async loadMaster(day: string): Promise<void> {
    if (this.masterDate !== day) {
      const csv = await this.dataCall(() => this.request('/instruments/scriptmaster', 'GET', undefined, true, true))
      this.master = parse(String(csv), { columns: true, skip_empty_lines: true, bom: true, trim: true }) as Row[]
      if (!this.master.length || !('instrument_token' in this.master[0])) throw new BrokerError('Official instrument master has an unexpected format.')
      this.masterDate = day
    }
  }
  async contracts(day: string, spot: number): Promise<[Contract, Contract]> {
    await this.loadMaster(day)
    return resolveContracts(this.master, day, spot)
  }
  async catalog(): Promise<{ date: string; contracts: Contract[] }> {
    const date = istDate()
    await this.loadMaster(date)
    return { date, contracts: parseContractMaster(this.master, date) }
  }
  async positions(): Promise<PositionRow[]> {
    const raw = record(await this.request('/portfolio/positions')).net
    // A verified successful empty account response uses {net:null,day:null}.
    // Missing fields or malformed non-null values still fail closed.
    if (raw === null) return []
    if (!Array.isArray(raw)) throw new BrokerError('Broker positions could not be verified.')
    return raw.map(item => {
      const row = record(item), quantity = Number(row.quantity)
      if (row.quantity == null || row.quantity === '' || typeof row.quantity === 'boolean' || !Number.isInteger(quantity) || !row.tradingsymbol || !row.exchange) throw new BrokerError('Broker returned an invalid position.')
      return { symbol: String(row.tradingsymbol), exchange: String(row.exchange), product: String(row.product || '').toUpperCase(), quantity }
    })
  }
  async quotes(contracts: Contract[]): Promise<Mark[]> {
    const params = new URLSearchParams()
    for (const c of contracts) params.append('i', `NFO:${c.symbol}`)
    const data = record(await this.request(`/instruments/quote/ltp?${params}`))
    return contracts.flatMap(c => {
      const row = record(data[`NFO:${c.symbol}`]), price = Number(row.last_price)
      return Number.isFinite(price) && price > 0 ? [{ token: c.token, price, receivedAt: Date.now(), source: 'rest' as const }] : []
    })
  }
  async place(intent: OrderIntent): Promise<string> {
    const data = record(await this.request('/orders/regular', 'POST', { tradingsymbol: intent.symbol,
      exchange: 'NFO', transaction_type: intent.transaction, order_type: 'MARKET',
      quantity: String(intent.quantity), product: 'MIS', validity: 'DAY', price: '0', trigger_price: '0',
      disclosed_quantity: '0', tag: intent.tag }))
    if (!data.order_id) throw new BrokerError('Broker acknowledgement has no order ID. Reconciliation is required.')
    return String(data.order_id)
  }
  async order(intent: OrderIntent): Promise<Fill | null> {
    if (!intent.orderId) return null
    // Current official Node SDK uses POST here; the prose docs still show GET.
    const rows = await this.request('/order/details', 'POST', { order_no: intent.orderId, segment: 'D' })
    return parseReceipt(rows, intent)
  }
  async findOrder(intent: OrderIntent): Promise<string | null> {
    const data = await this.request('/orders'), raw = data === null ? [] : data
    if (!Array.isArray(raw)) throw new BrokerError('Order book unavailable for reconciliation.')
    const matches = raw.map(record).filter(row => matchesOrderRow(row, intent, true))
    if (matches.length > 1) throw new BrokerError('Multiple orders match the saved intent. Check mStock before continuing.')
    return matches.length === 1 && matches[0].order_id ? String(matches[0].order_id) : null
  }
  async cancel(orderId: string): Promise<void> { await this.request(`/orders/regular/${encodeURIComponent(orderId)}`, 'DELETE') }
}

export function normalizeCandles(raw: unknown, day: string, now: number, convention = process.env.MSTOCK_CANDLE_LABEL || 'auto'): Candle[] {
  if (!Array.isArray(raw)) throw new BrokerError('Candle history is unavailable.')
  const first = istTime(day, '09:15'), last = istTime(day, '15:30')
  const parsed = raw.flatMap(item => {
    if (!Array.isArray(item) || item.length < 5) return []
    try {
      const timestamp = parseBrokerTime(item[0])
      return timestamp >= first && timestamp <= last ? [{ timestamp, values: item.slice(1, 5).map(Number) }] : []
    } catch { return [] }
  }).sort((a, b) => a.timestamp - b.timestamp)
  if (!parsed.length) return []
  // Infer only from the actual opening bar, never from a truncated recent window.
  const opening = parsed[0].timestamp
  if (convention === 'auto' && opening !== first && opening !== first + FIVE_MINUTES) {
    throw new BrokerError('The opening candle is missing. Reference levels cannot be guessed.')
  }
  const closeLabeled = convention === 'close' || convention === 'auto' && opening === first + FIVE_MINUTES
  const byStart = new Map<number, Candle>()
  for (const { timestamp, values } of parsed) {
    const start = timestamp - (closeLabeled ? FIVE_MINUTES : 0)
    const candle = { start, end: start + FIVE_MINUTES, open: values[0], high: values[1], low: values[2], close: values[3] }
    if (start >= first && candle.end <= last && (start - first) % FIVE_MINUTES === 0 && candle.end <= now && validCandle(candle)) byStart.set(start, candle)
  }
  return [...byStart.values()]
}

export function parseContractMaster(rows: Row[], day: string): Contract[] {
  const candidates: Contract[] = []
  for (const row of rows) {
    if (String(row.name).toUpperCase() !== 'NIFTY' || String(row.exchange).toUpperCase() !== 'NFO' || !['CE', 'PE'].includes(String(row.instrument_type))) continue
    const expiryTime = /^\d{4}-\d\d-\d\d/.test(String(row.expiry)) ? Date.parse(String(row.expiry).slice(0, 10)) : Date.parse(String(row.expiry))
    if (!Number.isFinite(expiryTime)) continue
    const expiry = new Date(expiryTime).toISOString().slice(0, 10), lotSize = Number(row.lot_size), strike = Number(row.strike), token = String(row.instrument_token)
    if (expiry < day || !Number.isInteger(lotSize) || lotSize < 1 || !Number.isFinite(strike) || strike <= 0 || !/^\d+$/.test(token)) continue
    candidates.push({ token, symbol: String(row.tradingsymbol), expiry, strike, lotSize, side: row.instrument_type as 'CE' | 'PE' })
  }
  return candidates
}
export function resolveContracts(rows: Row[], day: string, spot: number): [Contract, Contract] {
  const candidates = parseContractMaster(rows, day)
  if (!candidates.length) throw new BrokerError('No current NIFTY options were found in the official instrument master.')
  const expiry = candidates.map(c => c.expiry).sort()[0], chain = candidates.filter(c => c.expiry === expiry)
  const strikes = [...new Set(chain.map(c => c.strike))].sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot) || b - a)
  const atm = strikes[0], ce = chain.find(c => c.strike === atm && c.side === 'CE'), pe = chain.find(c => c.strike === atm && c.side === 'PE')
  if (!ce || !pe || ce.lotSize !== pe.lotSize) throw new BrokerError('The ATM call/put contract pair is incomplete.')
  return [ce, pe]
}

export function parseReceipt(raw: unknown, intent: OrderIntent): Fill | null {
  const rows = (Array.isArray(raw) ? raw : [raw]).map(record).filter(row => String(row.order_id) === intent.orderId)
  if (!rows.length) return null
  for (const row of rows) {
    if (!matchesOrderRow(row, intent)) throw new BrokerError('Broker order details do not match the saved intent.')
  }
  const terminal = (row: Row) => ['COMPLETE', 'COMPLETED', 'TRADED', 'EXECUTED', 'CANCELLED', 'CANCELED', 'REJECTED'].includes(String(row.status).toUpperCase())
  rows.sort((a, b) => Number(b.filled_quantity || 0) - Number(a.filled_quantity || 0) || Number(terminal(b)) - Number(terminal(a)))
  const row = rows[0], quantity = Number(row.filled_quantity || 0), average = Number(row.average_price || 0)
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > intent.quantity || quantity > 0 && (!Number.isFinite(average) || average <= 0)) throw new BrokerError('Broker execution quantities or prices are invalid.')
  if (!terminal(row)) return null
  return { orderId: intent.orderId!, quantity, average, status: String(row.status), ...(String(row.status).toUpperCase() === 'REJECTED' ? { rejectionReason: rejectionSummary(row.status_message) } : {}) }
}
