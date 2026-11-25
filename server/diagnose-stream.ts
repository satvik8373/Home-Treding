/** Read-only handshake comparison against the documented endpoint and SDK URL. */
import WebSocket from 'ws'
import { Store } from './store.ts'
import { resolve } from 'node:path'
const store = new Store(resolve(process.env.N009_DATA_DIR || 'data'))
const saved = store.broker()
if (!saved) throw new Error('Connect mStock first.')
let claims: Record<string, unknown> = {}
try { claims = JSON.parse(Buffer.from(saved.accessToken.split('.')[1] || '', 'base64url').toString()) } catch {}
let details: unknown = claims.USER_DETAILS
if (typeof details === 'string') { try { details = JSON.parse(details) } catch { details = null } }
console.log(JSON.stringify({ expiresInMinutes: Math.floor((saved.expiresAt - Date.now()) / 60000), userDetailsType: Array.isArray(details) ? 'array' : typeof details, userDetailsKeys: details && typeof details === 'object' && !Array.isArray(details) ? Object.keys(details) : [] }))
const documented = new URL('wss://ws.mstock.trade')
documented.searchParams.set('API_KEY', saved.apiKey); documented.searchParams.set('ACCESS_TOKEN', saved.accessToken)
const sdk = `wss://ws.mstock.trade?ACCESS_TOKEN=${saved.accessToken}&API_KEY=${saved.apiKey}`
for (const [label, url] of [['documented', documented], ['official-sdk', sdk]] as const) {
  await new Promise<void>(resolve => {
    const socket = new WebSocket(url, { handshakeTimeout: 8000 })
    let done = false
    const finish = (status: string, http?: number) => { if (done) return; done = true; console.log(JSON.stringify({ connection: label, status, http })); socket.terminate(); resolve() }
    socket.on('open', () => finish('upgrade-accepted'))
    socket.on('unexpected-response', (_request, response) => { response.resume(); finish('upgrade-rejected', response.statusCode) })
    socket.on('error', () => finish('connection-error'))
    socket.on('close', () => finish('closed'))
  })
}
store.close()
