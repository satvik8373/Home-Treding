import type { Agent } from 'node:http'
import { isTradingDay, istDate, istTime } from './time.ts'
import WebSocket from 'ws'
import type { Mark } from '../shared/model.ts'
import { freshMark } from '../shared/market.ts'
import type { SavedBroker } from './store.ts'

// The official SDK uses a 1980 base. Live mStock NSE packets count local IST
// seconds from that base, so resolve the epoch in IST rather than Unix UTC.
const EXCHANGE_EPOCH = Date.parse('1980-01-01T00:00:00+05:30')
export const exchangeTime = (seconds: number): number | undefined => seconds ? EXCHANGE_EPOCH + seconds * 1000 : undefined

/** Match the official SDK: its gateway expects literal base64 API-key symbols. */
export function marketSocketUrl(credentials: Pick<SavedBroker, 'apiKey' | 'accessToken'>): URL {
  const apiKey = encodeURIComponent(credentials.apiKey).replace(/%2B/gi, '+').replace(/%2F/gi, '/').replace(/%40/gi, '@').replace(/%3D/gi, '=')
  return new URL(`wss://ws.mstock.trade?ACCESS_TOKEN=${encodeURIComponent(credentials.accessToken)}&API_KEY=${apiKey}`)
}

/** NIFTY index / NFO packets only: price divisor 100, network byte order. */
export function parsePackets(buffer: Buffer, receivedAt = Date.now()): Mark[] {
  if (buffer.length < 2) return [] // one-byte heartbeat
  const count = buffer.readUInt16BE(0), ticks: Mark[] = []
  let offset = 2
  for (let i = 0; i < count; i++) {
    if (offset + 2 > buffer.length) break
    const size = buffer.readUInt16BE(offset); offset += 2
    if (size < 8 || offset + size > buffer.length) break
    const token = String(buffer.readUInt32BE(offset)), price = buffer.readUInt32BE(offset + 4) / 100
    const exchangeAt = size >= 64 ? exchangeTime(buffer.readUInt32BE(offset + 60))
      : size === 32 || size === 48 ? exchangeTime(buffer.readUInt32BE(offset + 28)) : undefined
    if (Number.isFinite(price) && price > 0) ticks.push({ token, price, receivedAt, exchangeAt: exchangeAt || undefined, source: 'websocket' })
    offset += size
  }
  return ticks
}
export const normalMarketSession = (now: number) => isTradingDay(now) && now >= istTime(istDate(now), '09:15') && now < istTime(istDate(now), '15:30')
export class MarketFeed {
  status: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
  lastTickAt: number | null = null
  diagnostics = { binaryFrames: 0, textFrames: 0, parsedTicks: 0, lastFrameBytes: 0, lastDeclaredPackets: 0, lastPacketSize: 0, closeCode: 0, lastError: '' }
  private ws: WebSocket | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private watchdog: ReturnType<typeof setInterval> | null = null
  private credentials: SavedBroker | null = null
  private tokens: string[] = []
  private attempt = 0
  private generation = 0
  private agent?: Agent
  constructor(
    private socketFactory: (url: URL, agent?: Agent) => WebSocket = (url, agent) => new WebSocket(url, { handshakeTimeout: 10_000, maxPayload: 1024 * 1024, ...(agent ? { agent } : {}) }),
    private ticksExpected = normalMarketSession,
  ) {}
  setAgent(agent?: Agent): void {
    this.agent = agent
    if (this.credentials && this.tokens.length && this.status !== 'disconnected') {
      this.connect(this.credentials, this.tokens)
    }
  }
  onMark: (mark: Mark) => void = () => {}
  onChange: () => void = () => {}
  connect(credentials: SavedBroker, tokens: string[]): void {
    this.close()
    this.credentials = credentials
    this.tokens = [...new Set(tokens)]
    this.open(this.generation)
  }
  private open(generation: number): void {
    if (!this.credentials || this.credentials.expiresAt <= Date.now() || generation !== this.generation) return
    this.status = 'connecting'; this.onChange()
    const url = marketSocketUrl(this.credentials)
    const ws = this.socketFactory(url, this.agent)
    this.ws = ws
    let lastMessageAt = Date.now()
    const openedAt = lastMessageAt, tokenTicks = new Map<string, number>()
    ws.on('open', () => {
      if (generation !== this.generation) return ws.close()
      this.diagnostics.lastError = ''; this.diagnostics.closeCode = 0
      // LOGIN must precede subscriptions on every connection, including reconnects.
      ws.send(`LOGIN:${this.credentials!.accessToken}`)
      ws.send(JSON.stringify({ a: 'subscribe', v: this.tokens.map(Number) }))
      ws.send(JSON.stringify({ a: 'mode', v: ['full', this.tokens.map(Number)] }))
      this.status = 'connected'; this.onChange()
    })
    ws.on('message', (data, binary) => {
      if (generation !== this.generation) return
      lastMessageAt = Date.now()
      if (!binary) { this.diagnostics.textFrames++; return }
      const buffer = Buffer.isBuffer(data) ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)])
      this.diagnostics.binaryFrames++; this.diagnostics.lastFrameBytes = buffer.length
      this.diagnostics.lastDeclaredPackets = buffer.length >= 2 ? buffer.readUInt16BE(0) : 0
      this.diagnostics.lastPacketSize = buffer.length >= 4 ? buffer.readUInt16BE(2) : 0
      const parsed = parsePackets(buffer); this.diagnostics.parsedTicks += parsed.length
      for (const tick of parsed) {
        if (!this.tokens.includes(tick.token) || !freshMark(tick, Date.now())) continue
        tokenTicks.set(tick.token, tick.receivedAt)
        if (this.tokens.every(token => tokenTicks.has(token))) this.attempt = 0
        this.lastTickAt = tick.receivedAt; this.onMark(tick)
      }
    })
    ws.on('error', (error: Error & { code?: string }) => {
      if (generation !== this.generation) return
      this.diagnostics.lastError = /Unexpected server response:\s*\d+/.exec(error.message)?.[0]
        || (/^[A-Z_]+$/.test(error.code || '') ? error.code! : 'Connection failed')
    })
    ws.on('close', code => {
      if (generation !== this.generation) return
      this.diagnostics.closeCode = code
      if (this.watchdog) clearInterval(this.watchdog)
      this.watchdog = null; this.ws = null
      this.status = this.credentials && this.credentials.expiresAt > Date.now() ? 'connecting' : 'disconnected'; this.onChange()
      this.retry = setTimeout(() => this.open(generation), Math.min(30_000, 1000 * 2 ** Math.min(this.attempt++, 5)))
    })
    this.watchdog = setInterval(() => {
      if (generation !== this.generation) return
      const now = Date.now()
      // No tick is expected outside normal weekday market hours. A quiet option
      // must not tear down an otherwise flowing stream; REST covers stale legs.
      if (now - lastMessageAt > 20_000 || this.ticksExpected(now) && now - (this.lastTickAt ?? openedAt) > 20_000) ws.terminate()
    }, 5000)
  }
  close(): void {
    this.generation++
    if (this.retry) clearTimeout(this.retry)
    if (this.watchdog) clearInterval(this.watchdog)
    this.retry = null; this.watchdog = null
    this.ws?.terminate(); this.ws = null; this.status = 'disconnected'; this.lastTickAt = null
  }
}
