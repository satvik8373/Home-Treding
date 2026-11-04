import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AccountDiagnostics } from '../server/diagnostics.ts'
import { createApp } from '../server/http.ts'
import { fixture } from './helpers.ts'
import type { AddressInfo } from 'node:net'
import { istDate } from '../server/time.ts'
import type { Trade } from '../shared/model.ts'
import type { SavedBroker } from '../server/store.ts'

function setup() {
  let time = Date.now(), failOrders = false
  const calls: string[] = []
  const broker = {
    credentials: { apiKey: 'secret-key', accessToken: 'secret-token', account: 'account-a', name: 'Test', expiresAt: time + 60_000 },
    async request(path: string): Promise<unknown> {
      calls.push(path)
      if (path === '/user/fundsummary') return [{ SEG: 'A', AVAILABLE_BALANCE: '0', AMOUNT_UTILIZED: '12.5', access_token: 'must-not-escape' }]
      if (path === '/orders') {
        if (failOrders) throw new Error('secret-token')
        return [{ order_id: 'broker-123', tradingsymbol: 'NIFTY-CE', quantity: 65, filled_quantity: 0, average_price: 0, status: 'REJECTED', status_message: 'private data', transaction_type: 'BUY' }]
      }
      if (path.startsWith('/instruments/quote/ltp?')) return { 'NSE:NIFTY 50': { last_price: 25000 } }
      throw new Error(`Forbidden endpoint: ${path}`)
    },
    async positions() { calls.push('/portfolio/positions'); return [] },
  }
  const stream = { status: 'disconnected', lastTickAt: null as number | null, diagnostics: { lastError: 'Unexpected server response: 502' } }
  const service = new AccountDiagnostics(broker, stream, () => time)
  return { broker, service, stream, calls, advance: () => { time += 11_000 }, failOrders: () => { failOrders = true } }
}

test('account checks use only read endpoints and distinguish order-book access from live execution', async () => {
  const f = setup(), report = await f.service.read()
  assert.equal(report.checks.find(item => item.name === 'Real order placement')!.status, 'untested')
  assert.equal(report.checks.find(item => item.name === 'Order-book access')!.status, 'pass')
  assert.equal(report.checks.find(item => item.name === 'WebSocket ticks')!.status, 'warning')
  assert.equal(report.funds[0].available, 0)
  assert.equal(report.orders[0].status, 'REJECTED')
  assert.equal(report.orders[0].filled, 0)
  assert.equal(JSON.stringify(report).includes('secret'), false)
  assert.equal(JSON.stringify(report).includes('must-not-escape'), false)
  assert.equal(JSON.stringify(report).includes('private data'), false)
  assert.equal(f.calls.length, 4)
  assert.ok(f.calls.every(path => !path.includes('/orders/regular')))
})

test('concurrent diagnostics share reads; cached reports cannot be mutated by callers', async () => {
  const f = setup(), [first, second] = await Promise.all([f.service.read(), f.service.read()])
  first.funds[0].available = 999
  assert.equal(second.funds[0].available, 0)
  assert.equal((await f.service.read()).funds[0].available, 0)
  assert.equal(f.calls.length, 4)
  f.advance(); await f.service.read()
  assert.equal(f.calls.length, 8)
})

test('one failed broker read does not invent data or hide successful checks', async () => {
  const f = setup(); f.failOrders()
  const report = await f.service.read()
  assert.equal(report.checks.find(item => item.name === 'Order-book access')!.status, 'failed')
  assert.equal(report.checks.find(item => item.name === 'Authentication & funds')!.status, 'pass')
  assert.deepEqual(report.orders, [])
  assert.equal(JSON.stringify(report).includes('secret-token'), false)
})

test('expired and changed broker sessions cannot return cached account reports', async () => {
  const f = setup()
  const pending = f.service.read()
  f.broker.credentials = { ...f.broker.credentials, account: 'account-b' }
  await assert.rejects(pending, /changed/)
  assert.equal((await f.service.read()).account, 'account-b')
  f.broker.credentials.expiresAt = 0
  await assert.rejects(() => f.service.read(), /Reconnect/)
})

test('diagnostics HTTP reports an unconnected account without invoking broker reads', async t => {
  const f = await fixture(); f.broker.credentials = null
  const server = createApp(f.controller, process.cwd()).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/broker/diagnostics`)
  assert.equal(response.status, 409)
  assert.equal(f.broker.submitted.length, 0)
})

test('successful null order book passes the empty-account diagnostic', async () => {
  const f = setup(), previous = f.broker.request.bind(f.broker);
  f.broker.request = async path => path === '/orders' ? null : previous(path);
  const report = await f.service.read();
  assert.equal(report.orderCount, 0);
  assert.deepEqual(report.orders, []);
  assert.equal(report.checks.find(check => check.name === 'Order-book access')!.status, 'pass');
});

test('only a matching actual broker fill can verify existing live engine execution', async () => {
  const f = setup(), previous = f.broker.request.bind(f.broker);
  const trade: Trade = { id: 'engine-fill', orderId: 'broker-123', at: Date.now(), side: 'CE', symbol: 'NIFTY-CE', transaction: 'BUY', quantity: 65, price: 100, reason: 'BREAKOUT', mode: 'live', pnl: null };
  const saved = { account: 'account-a', date: istDate(), mode: 'live' as 'live' | 'paper', trades: [trade] };
  let average = 100;
  f.broker.request = async path => path === '/orders' ? [{ order_id: trade.orderId, tradingsymbol: trade.symbol, exchange: 'NFO', transaction_type: 'BUY', filled_quantity: 65, average_price: average, status: 'COMPLETE' }] : previous(path);
  const run = () => new AccountDiagnostics(f.broker, f.stream, Date.now, () => saved).read();
  assert.equal((await run()).checks.find(check => check.name === 'Real order placement')!.status, 'pass');
  average = 101;
  assert.equal((await run()).checks.find(check => check.name === 'Real order placement')!.status, 'untested');
  average = 100; saved.mode = 'paper';
  assert.equal((await run()).checks.find(check => check.name === 'Real order placement')!.status, 'untested');
  saved.mode = 'live'; saved.account = 'another-account';
  assert.equal((await run()).checks.find(check => check.name === 'Real order placement')!.status, 'untested');
});

test('an acknowledgement or unfilled order cannot pass execution verification', async () => {
  const f = setup(), previous = f.broker.request.bind(f.broker);
  const trade: Trade = { id: 'engine-fill', orderId: 'broker-123', at: Date.now(), side: 'CE', symbol: 'NIFTY-CE', transaction: 'BUY', quantity: 65, price: 100, reason: 'BREAKOUT', mode: 'live', pnl: null };
  f.broker.request = async path => path === '/orders' ? [{ order_id: trade.orderId, tradingsymbol: trade.symbol, exchange: 'NFO', transaction_type: 'BUY', filled_quantity: 0, average_price: 0, status: 'OPEN' }] : previous(path);
  const report = await new AccountDiagnostics(f.broker, f.stream, Date.now, () => ({ account: 'account-a', date: istDate(), mode: 'live', trades: [trade] })).read();
  assert.equal(report.checks.find(check => check.name === 'Real order placement')!.status, 'untested');
});

test('missing NSE F&O permission produces an actionable broker-segment failure', async () => {
  const f = setup();
  (f.broker.credentials as SavedBroker).permissions = { exchanges: ['BEQ', 'NEQ', 'BSEMF', 'NSEIPO', 'BSEIPO'], products: ['CNC', 'NRML', 'MIS'], orderTypes: ['MARKET', 'LIMIT', 'SL', 'SL-M'] };
  const check = (await f.service.read()).checks.find(item => item.name === 'Login trading capabilities')!;
  assert.equal(check.status, 'failed');
  assert.match(check.detail, /Not advertised by this login: NSE F&O/);
  assert.match(check.detail, /Profile → Segments/);
  assert.equal(check.helpUrl, 'https://www.mstock.com/articles/how-to-activate-a-segment-in-mstock');
});
