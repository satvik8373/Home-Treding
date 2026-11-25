/** Read-only shape probe: no credentials, account values or order contents. */
import { Store } from './store.ts'
import { MStock } from './broker.ts'
import { resolve } from 'node:path'
const store = new Store(resolve(process.env.N009_DATA_DIR || 'data'))
const broker = new MStock(async (input, init) => {
  const response = await fetch(input, init)
  let body: Record<string, unknown> = {}
  try { body = await response.clone().json() as Record<string, unknown> } catch {}
  const shape = (value: unknown): unknown => Array.isArray(value) ? { type: 'array', count: value.length, fields: value[0] && typeof value[0] === 'object' ? Object.keys(value[0]) : [] } : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, Array.isArray(child) ? { type: 'array', count: child.length } : { type: child === null ? 'null' : typeof child }])) : { type: value === null ? 'null' : typeof value }
  const message = typeof body.message === 'string' ? body.message : ''
  console.log(JSON.stringify({ endpoint: new URL(String(input)).pathname, http: response.status, status: body.status, errorType: body.error_type, noRecordsMessage: /no.*(data|order|position)|(data|order|position).*not.*found/i.test(message), messageLength: message.length, data: shape(body.data) }))
  return response
})
broker.credentials = store.broker()
try { for (const path of ['/portfolio/positions', '/orders']) { try { await broker.request(path) } catch { /* shape logged above */ } } }
finally { store.close() }
