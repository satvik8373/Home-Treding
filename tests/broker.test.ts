import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MStock, normalizeCandles, parseReceipt, resolveContracts } from '../server/broker.ts'
import { parsePackets } from '../server/feed.ts'
import { parseBrokerTime, istTime } from '../server/time.ts'
import { Store } from '../server/store.ts'
import { DAY } from './helpers.ts'
import type { OrderIntent } from '../shared/model.ts'

test('official form-based OTP and TOTP flows send the documented fields', async () => {
  const calls: Array<{ url: string; body: string; headers: Headers }> = []
  const broker = new MStock(async (url, options) => {
    calls.push({ url: String(url), body: String(options?.body), headers: new Headers(options?.headers) })
    return new Response(JSON.stringify({ status: 'success', data: String(url).endsWith('/connect/login') ? {} : { access_token: 'mock-token', user_id: '123', user_name: 'Test' } }))
  })
  await broker.login('CLIENT', 'password')
  await broker.verify('key+/@@', '123456', 'otp', 'CLIENT')
  await broker.verify('key+/@@', '654321', 'totp', 'CLIENT')
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].body)), { username: 'CLIENT', password: 'password' })
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[1].body)), { api_key: 'key+/@@', request_token: '123456', checksum: 'L' })
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[2].body)), { api_key: 'key+/@@', totp: '654321' })
  assert.equal(calls[0].headers.get('x-mirae-version'), '1')
  assert.equal(calls[0].headers.get('authorization'), null)
})

test('OTP and TOTP capture only explicitly advertised login capabilities', async () => {
  for (const method of ['otp', 'totp'] as const) {
    const broker = new MStock(async () => new Response(JSON.stringify({ status: 'success', data: {
      access_token: 'mock-token', user_id: '123', exchanges: [' nfo ', 'nse'], products: [' mis '], order_types: [' market '],
    } })));
    const verified = await broker.verify('key', '123456', method, 'CLIENT');
    assert.deepEqual(verified.permissions, { exchanges: ['NFO', 'NSE'], products: ['MIS'], orderTypes: ['MARKET'] });
  }
  const broker = new MStock(async () => new Response(JSON.stringify({ status: 'success', data: { access_token: 'mock-token', user_id: '123' } })));
  assert.equal((await broker.verify('key', '123456', 'totp', 'CLIENT')).permissions, undefined);
});
test('history timestamps normalize the documented truncated IST offset without shifting by 30 minutes', () => {
  assert.equal(parseBrokerTime(`${DAY}T09:15:00+05`), istTime(DAY, '09:15'))
  assert.equal(parseBrokerTime(`${DAY}T03:45:00Z`), istTime(DAY, '09:15'))
  assert.equal(parseBrokerTime(istTime(DAY, '09:15') / 1000), istTime(DAY, '09:15'))
})
test('successful historical response with null candles falls back to current intraday data', async () => {
  const paths: string[] = []
  const broker = new MStock(async url => {
    paths.push(String(url))
    return new Response(JSON.stringify({ status: 'success', data: { candles: String(url).includes('/historical/') ? null
      : [[`${DAY}T09:15:00+05`, 100, 110, 90, 101, 10]] } }))
  })
  broker.credentials = { apiKey: 'test', accessToken: 'test', account: 'test', name: 'Test', expiresAt: Date.now() + 60_000 }
  const bars = await broker.history('26000', 'NSE', DAY, istTime(DAY, '09:21'))
  assert.equal(bars.length, 1)
  assert.match(paths[1], /\/intraday\/1\/26000\/5minute$/)
})
for (const convention of ['open', 'close'] as const) test(`${convention}-labeled candles select the opening bar and exclude incomplete bars`, () => {
  const labels = convention === 'open' ? ['09:15', '09:20'] : ['09:20', '09:25']
  const raw = labels.map((label, i) => [`${DAY}T${label}:00+05`, 100, 110, 90, 100 + i, 10]).reverse()
  const candles = normalizeCandles(raw, DAY, istTime(DAY, '09:23'))
  assert.equal(candles.length, 1)
  assert.equal(candles[0].start, istTime(DAY, '09:15'))
  assert.equal(candles[0].close, 100)
})
test('truncated recent history cannot masquerade as the opening reference', () => {
  assert.throws(() => normalizeCandles([[`${DAY}T11:45:00+05`, 100, 110, 90, 100]], DAY, istTime(DAY, '12:00')), /opening candle is missing/)
  assert.deepEqual(normalizeCandles([[`2026-10-25T09:15:00+05`, 100, 110, 90, 100]], DAY, istTime(DAY, '12:00')), [])
})

test('a broker closing auction row at 15:30 does not create a 76th five-minute session candle', () => {
  const raw = Array.from({ length: 76 }, (_, i) => [istTime(DAY, '09:15') + i * 300_000, 100, 110, 90, 100])
  const candles = normalizeCandles(raw, DAY, istTime(DAY, '16:00'))
  assert.equal(candles.length, 75)
  assert.equal(candles.at(-1)!.end, istTime(DAY, '15:30'))
})
test('contracts use 09:20 spot, nearest unexpired pair and official lot size', () => {
  const rows = [24950, 25000, 25050].flatMap(strike => ['CE', 'PE'].map((side, index) => ({
    name: 'NIFTY', exchange: 'NFO', instrument_type: side, expiry: '2026-10-27', strike: String(strike),
    instrument_token: String(strike + index), tradingsymbol: `NIFTY-${strike}-${side}`, lot_size: '75',
  })))
  const [ce, pe] = resolveContracts(rows, DAY, 25020)
  assert.equal(ce.strike, 25000); assert.equal(pe.strike, 25000); assert.equal(ce.lotSize, 75)
  assert.equal(typeof ce.token, 'string')
  assert.throws(() => resolveContracts(rows.map(row => ({ ...row, expiry: '2026-10-20' })), DAY, 25020), /No current/)
})
const intent: OrderIntent = { id: 'i', tag: 'tag', side: 'CE', symbol: 'TEST-CE', transaction: 'BUY', quantity: 195, reason: 'BREAKOUT', submittedAt: 0, orderId: '1' }
test('broker acknowledgement and open partial orders are not confirmed fills', () => {
  assert.equal(parseReceipt([{ order_id: '1', status: 'OPEN', filled_quantity: 65, average_price: 100 }], intent), null)
  assert.equal(parseReceipt({ order_id: '1' }, intent), null)
  assert.deepEqual(parseReceipt([{ order_id: '1', status: 'CANCELLED', filled_quantity: 65, average_price: 101 }], intent), { orderId: '1', quantity: 65, average: 101, status: 'CANCELLED' })
})
test('order mismatch, invalid fill price and excessive quantity require reconciliation', () => {
  assert.throws(() => parseReceipt([{ order_id: '1', tradingsymbol: 'OTHER', status: 'COMPLETE', filled_quantity: 195, average_price: 101 }], intent), /do not match/)
  assert.throws(() => parseReceipt([{ order_id: '1', status: 'COMPLETE', filled_quantity: 195, average_price: 0 }], intent), /invalid/)
  assert.throws(() => parseReceipt([{ order_id: '1', status: 'COMPLETE', filled_quantity: 196, average_price: 101 }], intent), /invalid/)
})
test('official WebSocket packets use network byte order and safe framing', () => {
  const packet = Buffer.alloc(14)
  packet.writeUInt16BE(1, 0); packet.writeUInt16BE(8, 2); packet.writeUInt32BE(101, 4); packet.writeUInt32BE(12345, 8)
  const ticks = parsePackets(packet.subarray(0, 12), 500)
  assert.equal(ticks[0].token, '101'); assert.equal(ticks[0].price, 123.45)
  assert.equal(ticks[0].receivedAt, 500)
  assert.deepEqual(parsePackets(Buffer.from([0])), [])
  assert.deepEqual(parsePackets(packet.subarray(0, 8)), [])
})
test('saved broker token is encrypted; durable state survives a new Store instance', t => {
  const directory = mkdtempSync(join(tmpdir(), 'n009-store-'))
  let store = new Store(directory)
  store.saveBroker({ apiKey: 'secret-api-key', accessToken: 'secret-access-token', account: 'account', name: 'Trader', expiresAt: Date.now() + 1000 })
  store.put('test-state', { pending: 'UNKNOWN', quantity: 65 })
  store.close()
  const bytes = Buffer.concat(readdirSync(directory).filter(name => name.startsWith('009.sqlite')).map(name => readFileSync(join(directory, name))))
  assert.equal(bytes.includes(Buffer.from('secret-access-token')), false)
  store = new Store(directory)
  assert.equal(store.broker()?.accessToken, 'secret-access-token')
  assert.deepEqual(store.get('test-state'), { pending: 'UNKNOWN', quantity: 65 })
  t.after(() => { store.close(); if (directory.startsWith(join(tmpdir(), 'n009-store-'))) rmSync(directory, { recursive: true }) })
})

test('successful null position and order lists represent an empty mStock account', async () => {
  const broker = new MStock(async url => new Response(JSON.stringify({ status: 'success', data: String(url).endsWith('/portfolio/positions') ? { net: null, day: null } : null })));
  broker.credentials = { apiKey: 'test', accessToken: 'test', account: 'test', name: 'Test', expiresAt: Date.now() + 60_000 };
  assert.deepEqual(await broker.positions(), []);
  assert.equal(await broker.findOrder(intent), null);
});

test('malformed position lists and error responses cannot be treated as flat', async () => {
  for (const data of [{}, { net: 'invalid' }, { net: [{ quantity: 'unknown', tradingsymbol: 'NIFTY', exchange: 'NFO' }] }]) {
    const broker = new MStock(async () => new Response(JSON.stringify({ status: 'success', data })));
    broker.credentials = { apiKey: 'test', accessToken: 'test', account: 'test', name: 'Test', expiresAt: Date.now() + 60_000 };
    await assert.rejects(() => broker.positions(), /invalid|verified/);
  }
  const broker = new MStock(async () => new Response(JSON.stringify({ status: 'error', data: null, message: 'Unavailable' }), { status: 503 }));
  broker.credentials = { apiKey: 'test', accessToken: 'test', account: 'test', name: 'Test', expiresAt: Date.now() + 60_000 };
  await assert.rejects(() => broker.positions(), /Unavailable/);
});
