import type { MStock } from './broker.ts'
import type { BrokerCheck, BrokerDiagnostics } from '../shared/diagnostics.ts'
import type { TradingSession } from '../shared/model.ts'
import { istDate } from './time.ts'
import { rejectionSummary, sameTradingSymbol } from './orderIdentity.ts'

type Broker = Pick<MStock, 'credentials' | 'request' | 'positions'>
type Stream = { status: string; lastTickAt: number | null; diagnostics?: { lastError: string } }
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const number = (value: unknown) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null
const label = (value: unknown) => String(value ?? '').slice(0, 100)

/** Intentionally has no order placement, cancellation, controller or strategy API. */
export class AccountDiagnostics {
  private task: Promise<BrokerDiagnostics> | null = null
  private owner: Broker['credentials'] = null
  private result: BrokerDiagnostics | null = null
  constructor(private broker: Broker, private stream: Stream, private now = Date.now,
    private session: () => Pick<TradingSession, 'account' | 'date' | 'mode' | 'trades'> | null = () => null) {}
  async read(): Promise<BrokerDiagnostics> {
    const credentials = this.broker.credentials
    if (!credentials || credentials.expiresAt <= this.now()) throw new Error('Reconnect mStock before running account checks.')
    if (this.owner === credentials && this.task) return structuredClone(await this.task)
    if (this.owner === credentials && this.result && this.now() - this.result.checkedAt < 10_000) return structuredClone(this.result)
    this.owner = credentials
    const task = this.run(credentials).then(result => {
      if (this.broker.credentials !== credentials) throw new Error('Broker account changed during verification. Run the checks again.')
      this.result = result
      return result
    })
    this.task = task
    try {
      const result = await task
      return structuredClone(result)
    } finally { if (this.task === task) this.task = null }
  }
  private async run(credentials: NonNullable<Broker['credentials']>): Promise<BrokerDiagnostics> {
    let brokerOrders: Record<string, unknown>[] = []
    const report: BrokerDiagnostics = { account: credentials.account, expiresAt: credentials.expiresAt, checkedAt: this.now(), checks: [], funds: [], positions: [], orders: [], orderCount: 0, stream: { status: this.stream.status, lastTickAt: this.stream.lastTickAt, error: this.stream.diagnostics?.lastError ?? '' } }
    const check = async (name: string, work: () => Promise<string>): Promise<BrokerCheck> => {
      const start = this.now()
      try { return { name, status: 'pass', detail: await work(), durationMs: this.now() - start } }
      catch { return { name, status: 'failed', detail: 'Broker read failed or returned an unsupported response. Reconnect or retry; no order was sent.', durationMs: this.now() - start } }
    }
    report.checks = await Promise.all([
      check('Authentication & funds', async () => {
        const raw = await this.broker.request('/user/fundsummary')
        if (!Array.isArray(raw) || !raw.length) throw new Error('Funds unavailable')
        report.funds = raw.slice(0, 10).map(item => { const value = row(item); return { segment: label(value.SEG || value.LIMIT_TYPE || 'Account'), available: number(value.AVAILABLE_BALANCE), utilized: number(value.AMOUNT_UTILIZED) } })
        return 'Authenticated fund summary received. Available balance does not guarantee margin for an order.'
      }),
      check('Broker positions', async () => {
        report.positions = await this.broker.positions()
        return `${report.positions.filter(item => item.quantity !== 0).length} non-flat broker position(s). Includes manual trades.`
      }),
      check('Order-book access', async () => {
        const data = await this.broker.request('/orders'), raw = data === null ? [] : data
        if (!Array.isArray(raw)) throw new Error('Orders unavailable')
        brokerOrders = raw.map(row)
        report.orderCount = raw.length
        report.orders = raw.map(item => { const value = row(item); return { id: label(value.order_id), symbol: label(value.tradingsymbol), side: label(value.transaction_type), quantity: number(value.quantity), filled: number(value.filled_quantity), average: number(value.average_price), status: label(value.status), at: label(value.order_timestamp), rejectionReason: String(value.status).toUpperCase() === 'REJECTED' ? rejectionSummary(value.status_message) : null } }).sort((a, b) => b.at.localeCompare(a.at))
        return `${raw.length} order-book record(s) returned. Read access is separate from order placement.`
      }),
      check('NIFTY REST quote', async () => {
        const raw = row(await this.broker.request('/instruments/quote/ltp?i=NSE%3ANIFTY+50'))
        const price = number(row(raw['NSE:NIFTY 50']).last_price)
        if (price == null || price <= 0) throw new Error('Quote unavailable')
        return `NIFTY 50: ₹${price.toFixed(2)} received via REST. Exchange quote time is not supplied by this endpoint.`
      }),
    ])
    const at = this.stream.lastTickAt
    report.stream = { status: this.stream.status, lastTickAt: at, error: this.stream.diagnostics?.lastError ?? '' }
    report.checks.push({ name: 'WebSocket ticks', status: at != null && this.now() - at <= 5000 && this.now() >= at ? 'pass' : 'warning', detail: at != null && this.now() - at <= 5000 && this.now() >= at ? 'A subscribed instrument delivered a fresh tick. This does not verify every option contract.' : `No fresh stream tick observed. ${report.stream.error || 'Use REST status and check market hours.'}`, durationMs: 0 })
    const session = this.session()
    const recorded = session?.mode === 'live' && session.account === credentials.account && session.date === istDate(this.now()) ? session.trades.filter(trade => trade.mode === 'live') : []
    const confirmed = recorded.find(trade => brokerOrders.some(order =>
      String(order.order_id) === trade.orderId && sameTradingSymbol(order.tradingsymbol, trade.symbol) && ['NFO', 'NSE'].includes(String(order.exchange))
      && String(order.transaction_type).toUpperCase() === trade.transaction
      && ['COMPLETE', 'COMPLETED', 'TRADED', 'EXECUTED', 'CANCELLED', 'CANCELED'].includes(String(order.status).toUpperCase())
      && trade.quantity > 0 && number(order.filled_quantity) === trade.quantity && trade.price > 0
      && number(order.average_price) != null && Math.abs(Number(order.average_price) - trade.price) < 0.005))
    report.checks.push({ name: 'Real order placement', status: confirmed ? 'pass' : 'untested', detail: confirmed
      ? `Existing live fill ${confirmed.orderId} matches the broker order book: ${confirmed.quantity} units at ₹${confirmed.price.toFixed(2)}. This check sent no order.`
      : 'No matching current-day live engine fill was verified in the broker order book. Read-only checks and Paper mode never place a real order. This is an unperformed execution test, not a connection failure.', durationMs: 0 })
    const permissions = credentials.permissions
    const missing = permissions ? [!permissions.exchanges.includes('NFO') ? 'NSE F&O (NFO)' : '', !permissions.products.includes('MIS') ? 'MIS' : '', !permissions.orderTypes.includes('MARKET') ? 'MARKET orders' : ''].filter(Boolean) : []
    report.checks.push({ name: 'Login trading capabilities', status: !permissions ? 'untested' : missing.length ? 'failed' : 'pass', detail: permissions
      ? `${missing.length ? `Not advertised by this login: ${missing.join(', ')}. ${!permissions.exchanges.includes('NFO') ? 'Check Profile → Segments in mStock and enable NSE F&O, or contact mStock if it is already active. Then use Refresh login metadata.' : 'Verify the missing capabilities with mStock, then refresh login metadata.'} ` : 'Required NFO, MIS and MARKET capabilities are advertised. ' }Exchanges: ${permissions.exchanges.join(', ')}; products: ${permissions.products.join(', ')}; order types: ${permissions.orderTypes.join(', ')}. This does not guarantee a fill.`
      : 'This saved login predates capability capture, or mStock omitted those fields. Use Refresh login metadata below, complete OTP/TOTP, then rerun checks. Account read access does not establish NFO/MIS/MARKET permission.', durationMs: 0,
      ...(permissions && !permissions.exchanges.includes('NFO') ? { helpUrl: 'https://www.mstock.com/articles/how-to-activate-a-segment-in-mstock' } : {}),
    })
    report.checkedAt = this.now()
    return report
  }
}
