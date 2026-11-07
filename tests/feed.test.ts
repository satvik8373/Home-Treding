import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import type WebSocket from 'ws'
import { MarketFeed, exchangeTime, marketSocketUrl, parsePackets } from '../server/feed.ts'
import { freshMark } from '../shared/market.ts'

class Socket extends EventEmitter {
  sent: string[] = []
  terminated = false
  send(message: string) { this.sent.push(message) }
  terminate() { if (!this.terminated) { this.terminated = true; this.emit('close', 1006) } }
}
const credentials = () => ({ apiKey: 'test', accessToken: 'test-token', account: 'test', name: 'Test', expiresAt: Date.now() + 3600_000 })
function packet(token: number, size = 64, at = Date.now()) {
  const buffer = Buffer.alloc(size + 4)
  buffer.writeUInt16BE(1, 0); buffer.writeUInt16BE(size, 2)
  buffer.writeUInt32BE(token, 4); buffer.writeUInt32BE(12345, 8)
  buffer.writeUInt32BE(Math.floor((at - Date.parse('1980-01-01T00:00:00+05:30')) / 1000), 4 + (size === 48 ? 28 : 60))
  return buffer
}
function setup(ticksExpected = () => true) {
  const sockets: Socket[] = []
  const feed = new MarketFeed(() => {
    const socket = new Socket(); sockets.push(socket)
    return socket as unknown as WebSocket
  }, ticksExpected)
  feed.connect(credentials(), ['101', '102'])
  sockets[0].emit('open')
  return { feed, sockets }
}

test('full option and index packets retain official exchange timestamps', () => {
  const now = Math.floor(Date.now() / 1000) * 1000
  for (const size of [48, 64, 200]) assert.equal(parsePackets(packet(101, size, now), now)[0].exchangeAt, now)
  assert.equal(freshMark({ token: '101', price: 100, receivedAt: now, exchangeAt: now - 6000, source: 'websocket' }, now), false)
})

test('NSE 1980 IST timestamps normalize without reviving stale or future ticks', () => {
  const now = Date.parse('2026-11-04T13:30:00+05:30')
  const raw = (now - Date.parse('1980-01-01T00:00:00+05:30')) / 1000
  assert.equal(exchangeTime(raw), now)
  assert.equal(exchangeTime(0), undefined)
  for (const [at, expected] of [[now, true], [now - 6000, false], [now + 2000, false]] as const) {
    assert.equal(freshMark(parsePackets(packet(101, 200, at), now)[0], now), expected)
  }
})

test('WebSocket authentication preserves the official SDK raw base64 API-key format', () => {
  const url = marketSocketUrl({ apiKey: 'test+/@@=', accessToken: 'jwt.token-value' })
  assert.equal(url.href, 'wss://ws.mstock.trade/?ACCESS_TOKEN=jwt.token-value&API_KEY=test+/@@=')
  const escaped = marketSocketUrl({ apiKey: 'test&extra=value#fragment', accessToken: 'token&other=value' })
  assert.equal(escaped.hash, '')
  assert.equal(escaped.searchParams.has('extra'), false)
  assert.equal(escaped.searchParams.has('other'), false)
  assert.equal(escaped.searchParams.get('API_KEY'), 'test&extra=value#fragment')
})

test('successful reconnection clears a stale handshake failure', t => {
  const { feed, sockets } = setup(); t.after(() => feed.close())
  feed.diagnostics.lastError = 'Unexpected server response: 502'
  sockets[0].emit('open')
  assert.equal(feed.diagnostics.lastError, '')
})

test('heartbeat-only connections reconnect and repeat authentication and subscriptions', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1_800_000_000_000 })
  const { feed, sockets } = setup(); t.after(() => feed.close())
  for (let i = 0; i < 5; i++) {
    sockets[0].emit('message', Buffer.from([0]), true)
    t.mock.timers.tick(5000)
  }
  assert.equal(sockets[0].terminated, true)
  t.mock.timers.tick(1000); sockets[1].emit('open')
  assert.equal(sockets[1].sent[0], 'LOGIN:test-token')
  assert.deepEqual(JSON.parse(sockets[1].sent[1]), { a: 'subscribe', v: [101, 102] })
})

test('one quiet subscribed token does not interrupt other flowing instruments', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1_800_000_000_000 })
  const { feed, sockets } = setup(); t.after(() => feed.close())
  for (let i = 0; i < 5; i++) {
    sockets[0].emit('message', packet(101), true)
    t.mock.timers.tick(5000)
  }
  assert.equal(sockets[0].terminated, false)
})

test('fresh ticks keep the feed alive; stale exchange ticks are not delivered', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1_800_000_000_000 })
  const { feed, sockets } = setup(); t.after(() => feed.close())
  const prices: number[] = []
  feed.onMark = mark => { prices.push(mark.price) }
  sockets[0].emit('message', packet(101, 64, Date.now() - 30_000), true)
  assert.equal(prices.length, 0)
  for (let i = 0; i < 8; i++) {
    for (const token of [101, 102]) sockets[0].emit('message', packet(token), true)
    t.mock.timers.tick(5000)
  }
  assert.equal(sockets[0].terminated, false)
  assert.equal(prices.length, 16)
  feed.close(); t.mock.timers.tick(60_000)
  assert.equal(sockets.length, 1)
})

test('quiet market hours keep a heartbeat-only stream stable without inventing fresh ticks', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: Date.parse('2026-11-07T11:00:00+05:30') })
  const { feed, sockets } = setup(() => false); t.after(() => feed.close())
  for (let i = 0; i < 30; i++) { sockets[0].emit('message', Buffer.from([0]), true); t.mock.timers.tick(5000) }
  assert.equal(sockets[0].terminated, false)
  assert.equal(feed.lastTickAt, null)
})
