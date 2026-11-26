import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { MStock, parseReceipt } from '../server/broker.ts'
import { Controller } from '../server/controller.ts'
import { createProxyFetcher } from '../server/proxy.ts'
import { istTime } from '../server/time.ts'
import { DEFAULT_SETTINGS } from '../shared/settings.ts'
import { targetPrice } from '../shared/targets.ts'
import { bar, contract, DAY, fixture } from './helpers.ts'

test('live T1 20-pt partial exit clears latched reason and ignores brief broker position API lag without early MANUAL_STOP', async () => {
  const f = await fixture(); await f.start('live')
  const orders = f.broker.order.bind(f.broker)
  // Delay updating broker positions right after T1 fills, simulating mStock /portfolio/positions lag.
  let lagPositions = false
  f.broker.positions = async () => {
    const qty = lagPositions ? 195 : (f.broker.holdings.get('NIFTY-TEST-CE') ?? 0)
    return qty ? [{ symbol: 'NIFTY-TEST-CE', exchange: 'NFO', product: 'MIS', quantity: qty }] : []
  }
  f.setTime(istTime(DAY, '09:25') + 3000)
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 101)])
  f.broker.candles.set('102', [bar('09:15'), bar('09:20', 100)])
  f.mark('CE', 101); f.mark('PE', 100)
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195)

  // T1 order initially stays pending on first poll, then confirms while positions API still reports 195.
  f.broker.plans.push({ pending: true, quantity: 65, average: 120 })
  f.setTime(istTime(DAY, '09:26'))
  f.feed.onMark({ token: '101', price: 120, receivedAt: f.now(), source: 'websocket' })
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.ok(f.controller.session!.pending)
  const pendingId = f.controller.session!.pending!.id

  // Release pending T1 confirmation while enabling lagged /portfolio/positions.
  f.broker.order = async intent => {
    lagPositions = true
    if (intent.id === pendingId) {
      f.broker.rows.get(intent.orderId!)!.fill = { orderId: intent.orderId!, quantity: 65, average: 120, status: 'COMPLETE' }
    }
    return orders(intent)
  }
  f.setTime(istTime(DAY, '09:26') + 300)
  await f.controller.pump()
  assert.equal(f.controller.session!.pending, null)
  assert.equal(f.controller.session!.legs.CE!.exitReason, null)
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)

  // Next periodic position check runs within propagation grace and must NOT block or MANUAL_STOP remaining lots.
  f.setTime(istTime(DAY, '09:26') + 2000)
  f.mark('CE', 125)
  await f.controller.pump()
  assert.equal(f.controller.session!.status, 'running')
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 130)
  assert.equal(f.broker.submitted.length, 2)

  // Once position feed catches up and price reaches T2 (40 pts = 140), remaining 130 sell cleanly at T2.
  lagPositions = false
  f.setTime(istTime(DAY, '09:27'))
  f.mark('CE', 140)
  await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position, null)
  assert.deepEqual(f.controller.session!.trades.map(t => t.reason), ['BREAKOUT', 'TARGET_1', 'TARGET_2'])
})

test('live entry fill tolerates brief zero-position lag, while genuine divergence after reconcile still catches mismatches', async () => {
  const f = await fixture(); await f.start('live')
  let forceZeroPosition = true
  f.broker.positions = async () => forceZeroPosition ? [] : [...f.broker.holdings].map(([symbol, quantity]) => ({ symbol, exchange: 'NFO', product: 'MIS', quantity }))
  f.setTime(istTime(DAY, '09:25') + 3000)
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 101)])
  f.broker.candles.set('102', [bar('09:15'), bar('09:20', 100)])
  f.mark('CE', 101); f.mark('PE', 100)
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195)

  // 2s later position endpoint still reports 0 due to API propagation lag: keep tracked position intact.
  f.setTime(istTime(DAY, '09:25') + 5000)
  await f.controller.pump()
  assert.equal(f.controller.session!.pnlVerified, true)
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195)

  // Explicit reconcile never suppresses genuine broker mismatch.
  await f.controller.reconcile()
  assert.equal(f.controller.session!.pnlVerified, false)
  assert.equal(f.controller.session!.legs.CE!.position, null)
  const fresh = new Controller(f.broker, f.store, f.feed, f.now)
  assert.equal(fresh.session!.pnlVerified, false)
})

test('MStock quotes accept instrument_token 0, reject wrong non-zero tokens, and parse FILLED / pending_quantity=0 receipts', async () => {
  const broker = new MStock(async input => {
    const url = String(input)
    if (url.includes('/quote/ltp')) {
      return new Response(JSON.stringify({
        status: 'success',
        data: {
          'NFO:NIFTY-TEST-CE': { instrument_token: 0, last_price: 112.5 },
          'NFO:NIFTY-TEST-PE': { instrument_token: 999, last_price: 88.0 },
        },
      }))
    }
    return new Response(JSON.stringify({ status: 'error', error_type: 'NetworkException', message: 'Upstream timeout' }), { status: 200 })
  })
  broker.credentials = { apiKey: 'k', accessToken: 't', account: 'a', name: 'N', expiresAt: Date.now() + 60_000 }
  const marks = await broker.quotes([contract('CE'), contract('PE')])
  assert.deepEqual(marks.map(m => [m.token, m.price]), [['101', 112.5]])
  await assert.rejects(() => broker.place({ id: '1', tag: 'tag', side: 'CE', symbol: contract('CE').symbol, transaction: 'BUY', quantity: 65, reason: 'BREAKOUT', submittedAt: Date.now() }), err => (err as { definitive?: boolean }).definitive === false)

  const filled = parseReceipt({ order_id: 'ORD-1', tradingsymbol: contract('CE').symbol, exchange: 'NFO', transaction_type: 'BUY', product: 'MIS', quantity: 65, filled_quantity: 65, pending_quantity: 0, average_price: 105, status: 'FILLED' },
    { id: '1', tag: 'tag', side: 'CE', symbol: contract('CE').symbol, product: 'MIS', transaction: 'BUY', quantity: 65, reason: 'BREAKOUT', submittedAt: Date.now(), orderId: 'ORD-1' })
  assert.equal(filled?.quantity, 65)
})

test('MStock priority data queue serves urgent strategy history ahead of queued background chart calls', async () => {
  const order: string[] = []
  let releaseFirst!: () => void
  const gate = new Promise<void>(resolve => { releaseFirst = resolve })
  const broker = new MStock(async input => {
    const token = String(input).split('/').at(-2)!
    order.push(token)
    if (token === '26000') await gate
    return new Response(JSON.stringify({
      status: 'success',
      data: { candles: [[`${DAY}T09:15:00+05`, 100, 110, 90, 100]] },
    }))
  })
  broker.credentials = { apiKey: 'k', accessToken: 't', account: 'a', name: 'N', expiresAt: Date.now() + 60_000 }

  const first = broker.history('26000', 'NSE', DAY, istTime(DAY, '10:00'), false, false)
  await new Promise(resolve => setTimeout(resolve, 20))
  const bgChart = broker.history('999', 'NFO', DAY, istTime(DAY, '10:00'), false, false)
  const urgentStrategy = broker.history('101', 'NFO', DAY, istTime(DAY, '10:00'), false, true)
  releaseFirst()
  await Promise.all([first, bgChart, urgentStrategy])
  assert.deepEqual(order, ['26000', '101', '999'])
})

test('simultaneous CE and PE breakouts survive CE pending confirmation, and prepare retains closes completed during setup', async () => {
  const f = await fixture()
  // Advance time across 09:25 boundary right while contracts() is resolving during prepare().
  const origContracts = f.broker.contracts.bind(f.broker)
  f.setTime(istTime(DAY, '09:24') + 59_000)
  f.broker.candles.set('26000', [bar('09:15')])
  f.broker.candles.set('101', [bar('09:15')])
  f.broker.candles.set('102', [bar('09:15')])
  f.broker.contracts = async () => {
    f.setTime(istTime(DAY, '09:25') + 2500)
    return origContracts()
  }
  await f.controller.start('live')
  for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.legs.CE!.lastCandleEnd, istTime(DAY, '09:20'))

  // Now both CE and PE break out on 09:20-09:25; CE order stays pending first.
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 102)])
  f.broker.candles.set('102', [bar('09:15'), bar('09:20', 102)])
  f.mark('CE', 102); f.mark('PE', 102)
  f.broker.plans.push({ pending: true, quantity: 195, average: 102 }, { quantity: 195, average: 102 })
  const orders = f.broker.order.bind(f.broker)
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.pending?.side, 'CE')
  assert.ok(f.controller.session!.legs.PE!.pendingBreakout, 'PE breakout must be preserved while CE awaits acknowledgement fill')

  // Confirm CE at +250ms; PE must submit immediately on next pump without waiting 5s.
  const cePending = f.controller.session!.pending!
  f.broker.rows.get(cePending.orderId!)!.fill = { orderId: cePending.orderId!, quantity: 195, average: 102, status: 'COMPLETE' }
  f.broker.order = orders
  f.setTime(f.now() + 300)
  await f.controller.pump()
  f.setTime(f.now() + 100)
  f.mark('PE', 102)
  await f.controller.pump()
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195)
  assert.equal(f.controller.session!.legs.PE!.position!.quantity, 195)
})

test('evaluateCandles rejects timestamp-shifted fallback bars that disagree with locked opening reference, preventing early exit', async () => {
  const f = await fixture(); await f.start('paper')
  f.setTime(istTime(DAY, '09:25') + 3000)
  f.broker.candles.set('101', [bar('09:15'), bar('09:20', 102)])
  f.broker.candles.set('102', [bar('09:15'), bar('09:20', 100)])
  f.mark('CE', 102); f.mark('PE', 100)
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195)

  // Return mis-aligned history where 09:15 close changed from locked 100 -> 95 (as in a -5m close-labeled shift).
  f.setTime(istTime(DAY, '09:30') + 3000)
  f.broker.candles.set('101', [bar('09:15', 95), bar('09:20', 102), bar('09:25', 90)])
  await f.controller.pump()
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.controller.session!.legs.CE!.position!.quantity, 195, 'shifted candle feed must not trigger false LOWER_CLOSE early exit')

  // Short-leg targets compute below entry when position direction is passed explicitly.
  const both = { ...DEFAULT_SETTINGS, direction: 'both' as const }
  assert.equal(targetPrice(both, 1, 100, 'sell'), 80)
  assert.equal(targetPrice(both, 2, 100, 'sell'), 60)
})

test('proxy fetcher keeps connections warm with keep-alive across repeated requests', async t => {
  let sockets = 0
  const proxy = createServer((req, res) => {
    const dest = new URL(req.url!)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ path: dest.pathname }))
  })
  proxy.on('connection', () => { sockets++ })
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve))
  t.after(() => { proxy.closeAllConnections(); proxy.close() })
  const port = (proxy.address() as AddressInfo).port
  const fetcher = createProxyFetcher(`http://127.0.0.1:${port}`)
  assert.equal((await fetcher('http://example.test/one')).status, 200)
  assert.equal((await fetcher('http://example.test/two')).status, 200)
  assert.ok(sockets <= 2)
})

test('controller snapshot exposes WebSocket feed diagnostics as feedError for UI logs', async () => {
  const f = await fixture()
  Object.assign(f.feed, { diagnostics: { lastError: 'Unexpected server response: 502' } })
  assert.equal(f.controller.snapshot().broker.feedError, 'Unexpected server response: 502')
  Object.assign(f.feed, { diagnostics: { lastError: '' } })
  assert.equal(f.controller.snapshot().broker.feedError, undefined)
})
