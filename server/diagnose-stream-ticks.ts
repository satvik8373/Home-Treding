/** Read-only tick-shape check. Never logs credentials or market prices. */
import WebSocket from 'ws'
import { Store } from './store.ts'
import { MStock, INDEX_TOKEN } from './broker.ts'
import { MarketFeed, parsePackets } from './feed.ts'
import { resolve } from 'node:path'
import { istDate, istTime } from './time.ts'
const store = new Store(resolve(process.env.N009_DATA_DIR || 'data'))
const broker = new MStock(); broker.credentials = store.broker()
const packets = new Map<string, { count: number; exchangeAgeMs: number | null }>()
const texts: unknown[] = [], seen = new Set<string>()
const feed = new MarketFeed(url => {
  const socket = new WebSocket(url, { handshakeTimeout: 8000 })
  socket.on('message', (data, binary) => {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
    if (binary) for (const mark of parsePackets(bytes)) packets.set(mark.token, { count: (packets.get(mark.token)?.count ?? 0) + 1, exchangeAgeMs: mark.exchangeAt ? Date.now() - mark.exchangeAt : null })
    else if (texts.length < 5) {
      let value: Record<string, unknown> = {}
      try { value = JSON.parse(bytes.toString()) } catch {}
      texts.push({ bytes: bytes.length, keys: Object.keys(value), type: typeof value.type === 'string' ? value.type : undefined, status: typeof value.status === 'string' ? value.status : undefined, invalidAuthentication: /invalid|expired|unauthor|fail|error/i.test(bytes.toString()) })
    }
  })
  return socket
})
try {
  const day = istDate(), bars = await broker.history(INDEX_TOKEN, 'NSE', day, Date.now())
  const opening = bars.find(bar => bar.start === istTime(day, '09:15'))
  if (!opening) throw new Error('Opening reference unavailable')
  const pair = await broker.contracts(day, opening.close)
  feed.onMark = mark => { seen.add(mark.token) }
  feed.connect(broker.credentials!, [INDEX_TOKEN, ...pair.map(item => item.token)])
  await new Promise(resolve => setTimeout(resolve, 12_000))
  console.log(JSON.stringify({ status: feed.status, diagnostics: feed.diagnostics, acceptedTokens: [...seen], packets: Object.fromEntries(packets), texts }))
} finally { feed.close(); store.close() }
