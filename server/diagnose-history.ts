/** Read-only broker response-shape check. Prints no credentials or prices. */
import { Store } from './store.ts'
import { MStock } from './broker.ts'
import { istDate } from './time.ts'
import { resolve } from 'node:path'

const store = new Store(resolve(process.env.N009_DATA_DIR || 'data'))
const broker = new MStock()
broker.credentials = store.broker()
if (!broker.credentials) { console.log('Connect mStock in the app first.'); store.close(); process.exit(1) }
const day = istDate()
const describe = (value: unknown): unknown => {
  if (Array.isArray(value)) return { type: 'array', count: value.length, firstTimestamp: Array.isArray(value[0]) ? value[0][0] : undefined, lastTimestamp: Array.isArray(value.at(-1)) ? value.at(-1)[0] : undefined }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, child && typeof child === 'object' ? describe(child) : { type: typeof child }]))
  return { type: typeof value }
}
for (const path of [
  `/instruments/historical/NSE/26000/5minute?${new URLSearchParams({ from: `${day} 09:15:00`, to: `${day} 15:30:00` })}`,
  '/instruments/intraday/1/26000/5minute',
]) {
  try { console.log(JSON.stringify({ endpoint: path.split('?')[0], shape: describe(await broker.request(path)) })) }
  catch (error) { console.log(JSON.stringify({ endpoint: path.split('?')[0], error: error instanceof Error ? error.message : 'Request failed' })) }
  await new Promise(resolve => setTimeout(resolve, 1100))
}
store.close()
