/** Read-only historical-discovery probe. Prints only coverage and metadata shapes. */
import { Store } from './store.ts'
import { MStock } from './broker.ts'
import { parse } from 'csv-parse/sync'
import { resolve } from 'node:path'
import { istTime } from './time.ts'
const store = new Store(resolve(process.env.N009_DATA_DIR || 'data'))
const broker = new MStock(); broker.credentials = store.broker()
try {
  for (const date of ['2026-11-02', '2026-11-03']) {
    try { const candles = await broker.history('26000', 'NSE', date, Date.now()); console.log(JSON.stringify({ date, spotBars: candles.length, hasOpening: candles.some(bar => bar.start === istTime(date, '09:15')) })) }
    catch { console.log(JSON.stringify({ date, spotHistory: 'unavailable' })) }
  }
  const csv = String(await broker.request('/instruments/scriptmaster', 'GET', undefined, true, true))
  const rows = parse(csv, { columns: true, bom: true, trim: true, skip_empty_lines: true }) as Record<string,string>[]
  const nifty = rows.filter(row => row.name === 'NIFTY' && ['CE','PE'].includes(row.instrument_type))
  console.log(JSON.stringify({ masterFields: Object.keys(rows[0] ?? {}), niftyExpiries: [...new Set(nifty.map(row => row.expiry))].slice(0, 15), niftyLots: [...new Set(nifty.map(row => row.lot_size))] }))
  await new Promise(resolve => setTimeout(resolve, 1100))
  try {
    const master = await broker.request('/getoptionchainmaster/2') as Record<string,unknown>
    console.log(JSON.stringify({ chainMasterKeys: Object.keys(master ?? {}), expiries: master?.dctExp, nifty: Array.isArray(master?.OPTIDX) ? master.OPTIDX.filter(value => String(value).startsWith('NIFTY,')) : undefined }))
  } catch { console.log('Option-chain master unavailable') }
} finally { store.close() }
