/** Read-only integration check. This command never imports the order controller. */
import { resolve } from 'node:path'
import { Store } from './store.ts'
import { MStock, INDEX_TOKEN } from './broker.ts'
import { MarketFeed } from './feed.ts'
import { istDate, istTime } from './time.ts'
import { levels } from './strategy.ts'
import { AccountDiagnostics } from './diagnostics.ts'

const store = new Store(resolve(process.env.N009_DATA_DIR || 'data'))
const broker = new MStock(), feed = new MarketFeed()
try {
  broker.credentials = store.broker()
  if (!broker.credentials) throw new Error('Connect mStock through the app first.')
  await broker.verifyAccount(); console.log('PASS: broker account authenticated')
  const day = istDate(), openingStart = istTime(day, '09:15')
  const bars = await broker.history(INDEX_TOKEN, 'NSE', day, Date.now())
  const opening = bars.find(c => c.start === openingStart)
  if (!opening) throw new Error('The 09:15–09:20 index candle is not available yet.')
  console.log('PASS: completed NIFTY opening candle')
  const contracts = await broker.contracts(day, opening.close)
  console.log(`PASS: official ATM call/put pair and lot size (${contracts[0].lotSize} units)`)
  for (const contract of contracts) {
    const candles = await broker.history(contract.token, 'NFO', day, Date.now())
    const reference = candles.find(c => c.start === openingStart)
    if (!reference) throw new Error(`${contract.side}: completed opening reference unavailable.`)
    levels(reference.close)
    console.log(`PASS: ${contract.side} opening reference and 0.09% levels`)
  }
  const tokens = [INDEX_TOKEN, ...contracts.map(c => c.token)], seen = new Set<string>()
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`WebSocket unavailable: ${feed.diagnostics.lastError || 'no complete tick set received'}`)), 12_000)
      feed.onMark = mark => { seen.add(mark.token); if (tokens.every(token => seen.has(token))) { clearTimeout(timeout); resolve() } }
      feed.connect(broker.credentials!, tokens)
    })
    console.log('PASS: authenticated WebSocket delivered NIFTY, CE and PE prices')
  } catch (error) {
    const quotes = await broker.quotes(contracts)
    if (!contracts.every(c => quotes.some(q => q.token === c.token && q.price > 0))) throw new Error('Both WebSocket and official REST option quotes are unavailable.')
    console.log(`PASS: official REST fallback delivered fresh CE/PE prices. ${error instanceof Error ? error.message : 'WebSocket unavailable.'}`)
  }
  const account = await new AccountDiagnostics(broker, feed).read()
  for (const check of account.checks.filter(item => !['WebSocket ticks', 'Real order placement', 'Login trading capabilities'].includes(item.name))) {
    console.log(`${check.status === 'pass' ? 'PASS' : 'FAIL'}: ${check.name}`)
  }
  if (account.checks.some(check => check.status === 'failed')) process.exitCode = 1
  console.log('NOT TESTED: live order placement. Read-only checks complete; no orders were submitted.')
} catch (error) { console.error(error instanceof Error ? error.message : 'Read-only check failed.'); process.exitCode = 1 }
finally { feed.close(); store.close() }
