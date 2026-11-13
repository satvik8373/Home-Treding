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
import { sameTradingSymbol, matchesPositionRow, isNiftyDerivativePosition, matchesOrderRow } from '../server/orderIdentity.ts'

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

test('position identity recognizes the Type A NSE option display alias without merging contracts or products', () => {
  const contract = { token: '45391', symbol: 'NIFTY26N1725100PE', expiry: '2026-11-17', strike: 25100, lotSize: 65, side: 'PE' as const }
  const row = { symbol: 'NIFTY-17Nov2026-25100-PE', exchange: 'NSE', product: 'MIS' }
  assert.equal(matchesPositionRow(row, contract), true)
  assert.equal(matchesPositionRow({ ...row, product: 'NRML' }, contract, 'NRML'), true)
  assert.equal(matchesPositionRow(row, contract, 'NRML'), false)
  assert.equal(isNiftyDerivativePosition(row), true)
  for (const mismatch of [{ ...row, symbol: 'NIFTY-17Nov2026-25200-PE' }, { ...row, symbol: 'NIFTY-17Nov2026-25100-CE' }, { ...row, symbol: 'NIFTY-24Nov2026-25100-PE' }, { ...row, exchange: 'BSE' }, { ...row, product: 'NRML' }, { ...row, symbol: 'NIFTYBEES' }]) assert.equal(matchesPositionRow(mismatch, contract), false)
  assert.equal(isNiftyDerivativePosition({ symbol: 'NIFTYBEES', exchange: 'NSE' }), false)
  assert.equal(isNiftyDerivativePosition({ symbol: 'NIFTY26NOV25100PE', exchange: 'NSE' }), true)
  assert.equal(isNiftyDerivativePosition({ symbol: 'NIFTY26XYZ25100PE', exchange: 'NSE' }), false)
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
test('broker order placement and recovery use the saved NRML product and reject a MIS order with the same identity', async () => {
  let body = ''
  const broker = new MStock(async (_url, options) => { body = String(options?.body); return new Response(JSON.stringify({ status: 'success', data: { order_id: '1' } })) })
  broker.credentials = { apiKey: 'test', accessToken: 'test', account: 'test', name: 'Test', expiresAt: Date.now() + 60_000 }
  const nrml = { ...intent, product: 'NRML' as const }
  await broker.place(nrml)
  assert.equal(new URLSearchParams(body).get('product'), 'NRML')
  const row = { tag: 'tag', tradingsymbol: intent.symbol, transaction_type: 'BUY', exchange: 'NFO', quantity: 195, product: 'NRML' }
  assert.equal(matchesOrderRow(row, nrml, true), true)
  assert.equal(matchesOrderRow({ ...row, product: 'MIS' }, nrml, true), false)
  assert.equal(matchesOrderRow(row, intent, true), false, 'old saved orders default to MIS')
  await broker.place(intent)
  assert.equal(new URLSearchParams(body).get('product'), 'MIS')
})
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

const pendingNifty: OrderIntent = { id: 'pending-test', tag: 'unique-tag-test', side: 'CE', symbol: 'NIFTY26N0924350CE', instrumentToken: '39997', expiry: '2026-11-09', transaction: 'BUY', quantity: 195, reason: 'BREAKOUT', submittedAt: 1 }
const reportedNifty = { order_id: 'broker-test-1', exchange: 'NSE', tradingsymbol: 'NIFTY-09Nov2026-24350-CE', instrument_token: 39997, transaction_type: 'BUY', product: 'INTRADAY', quantity: 195, tag: ['unique-tag-test'], status: 'Rejected', filled_quantity: 0, average_price: 0,
  status_message: 'RMS:private-account,FUND LIMIT INSUFFICIENT,AVAILABLE FUND =20,ADDITIONAL REQUIRED FUND=33868,CALCULATED SPAN & EXPOSURE FOR ORDER=33888' }

test('tagged Type A derivative aliases reconcile a rejected order without another placement', async () => {
  const calls: string[] = []
  const broker = new MStock(async (url, options) => {
    calls.push(`${options?.method}:${String(url).split('/typea')[1]}`)
    return new Response(JSON.stringify({ status: 'success', data: String(url).endsWith('/orders') ? [reportedNifty] : [{ ...reportedNifty, tag: 'unique-tag-test', instrument_token: 0 }] }))
  })
  broker.credentials = { apiKey: 'mock', accessToken: 'mock', account: 'mock', name: 'Mock', expiresAt: Date.now() + 60_000 }
  const id = await broker.findOrder(pendingNifty)
  assert.equal(id, 'broker-test-1')
  const result = await broker.order({ ...pendingNifty, orderId: id! })
  assert.equal(result!.quantity, 0)
  assert.equal(result!.status, 'Rejected')
  assert.match(result!.rejectionReason!, /Available ₹20.00; broker requires ₹33888.00/)
  assert.equal(JSON.stringify(result).includes('private-account'), false)
  assert.deepEqual(calls, ['GET:/orders', 'POST:/order/details'])
})

test('order aliases still reject other tags, contracts, tokens, sides, quantities and ambiguous matches', async () => {
  for (const changed of [{ tag: ['wrong-tag'] }, { tradingsymbol: 'NIFTY-09Nov2026-24350-PE' }, { instrument_token: 99999 }, { quantity: 65 }, { exchange: 'BSE' }, { transaction_type: 'SELL' }, { product: 'CNC' }]) {
    const broker = new MStock(async () => new Response(JSON.stringify({ status: 'success', data: [{ ...reportedNifty, ...changed }] })))
    broker.credentials = { apiKey: 'mock', accessToken: 'mock', account: 'mock', name: 'Mock', expiresAt: Date.now() + 60_000 }
    assert.equal(await broker.findOrder(pendingNifty), null)
    assert.throws(() => parseReceipt([{ ...reportedNifty, ...changed }], { ...pendingNifty, orderId: 'broker-test-1' }), /do not match/)
  }
  const broker = new MStock(async () => new Response(JSON.stringify({ status: 'success', data: [reportedNifty, { ...reportedNifty, order_id: 'broker-test-2' }] })))
  broker.credentials = { apiKey: 'mock', accessToken: 'mock', account: 'mock', name: 'Mock', expiresAt: Date.now() + 60_000 }
  await assert.rejects(() => broker.findOrder(pendingNifty), /Multiple orders/)
})

test('monthly aliases require the saved full expiry; invalid dates never normalize', () => {
  assert.equal(sameTradingSymbol('NIFTY26NOV24350CE', 'NIFTY-24Nov2026-24350-CE'), false)
  assert.equal(sameTradingSymbol('NIFTY26NOV24350CE', 'NIFTY-24Nov2026-24350-CE', '2026-11-24'), true)
  assert.equal(sameTradingSymbol('NIFTY26N0924350CE', 'NIFTY-10Nov2026-24350-CE'), false)
  assert.equal(sameTradingSymbol('NIFTY26N3124350CE', 'NIFTY-31Nov2026-24350-CE'), false)
})
