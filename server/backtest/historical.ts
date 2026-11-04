import { randomUUID } from 'node:crypto'
import type { BacktestDataset, HistoricalDateResult, HistoricalFetchJob } from '../../shared/backtest.ts'
import type { Candle, Contract, TradingSession } from '../../shared/model.ts'
import type { MStock } from '../broker.ts'
import { INDEX_TOKEN, resolveContracts } from '../broker.ts'
import { isTradingDay, istDate, istTime } from '../time.ts'
import { dataset, dateRange, historicalContracts, SIDES, tradingDate } from './validation.ts'
import type { BacktestRepository } from './service.ts'
import { DATASET_SCHEMA } from './schema.ts'
import { MAX_HISTORY_DAYS } from '../../shared/history.ts'
import { nonSessionReason } from './calendar.ts'

type Catalog = { date: string; contracts: Contract[] }
type Pair = { contracts: Record<'CE' | 'PE', Contract>; source: NonNullable<BacktestDataset['contractSource']> }
type Broker = Pick<MStock, 'history' | 'contracts'> & Partial<Pick<MStock, 'catalog'>>
type Context = { connected: boolean; account: string | null; session: TradingSession | null }
export const CONTRACT_SCHEMA = {
  $schema: DATASET_SCHEMA.$schema, title: 'Original historical NIFTY ATM contracts', type: 'object', required: ['version', 'days'],
  properties: { version: { const: 1 }, days: { type: 'array', minItems: 1, maxItems: MAX_HISTORY_DAYS, items: { type: 'object', required: ['date', 'contracts'], properties: {
    date: { type: 'string', format: 'date' }, contracts: { type: 'object', required: ['CE', 'PE'], properties: { CE: { $ref: '#/$defs/contract' }, PE: { $ref: '#/$defs/contract' } } },
  } } } }, $defs: DATASET_SCHEMA.$defs,
}

/** Broker GET data only: never receives placement, cancellation or controller APIs. */
export class HistoricalData {
  private current: HistoricalFetchJob | null
  private pending: Promise<void> | null = null
  constructor(private broker: Broker, private context: () => Context, private repository: BacktestRepository, private now = Date.now) {
    this.current = repository.get<HistoricalFetchJob>('history:fetch-job')
    if (this.current?.status === 'running') {
      this.current.status = 'failed'; this.current.message = 'Historical download interrupted by an engine restart. Fetch the range again; saved dates are retained.'
    }
  }
  latest(): HistoricalFetchJob | null { return structuredClone(this.current) }
  async finished(id: string): Promise<HistoricalFetchJob> { this.job(id); await this.pending; return this.job(id) }
  job(id: string): HistoricalFetchJob {
    if (this.current?.id !== id) throw new Error('Historical download is no longer available. Fetch the range again.')
    return structuredClone(this.current)
  }
  spot(date: string): { date: string; capturedAt: number; candles: Candle[] } | null { return this.repository.get(`history:spot:${tradingDate(date)}`) }
  bundle(id: string) {
    const job = this.job(id)
    return { version: 1, kind: 'nifty-009-history', interval: '5minute', timezone: 'Asia/Kolkata', exportedAt: this.now(), job,
      days: job.rows.map(row => ({ date: row.date, coverage: row.status, spot: this.spot(row.date), options: ['ready', 'partial'].includes(row.status) ? this.repository.get<BacktestDataset>(`backtest:archive:${row.date}`) : null })) }
  }
  importContracts(input: unknown): { dates: string[] } {
    if (this.current?.status === 'running') throw new Error('Wait for the historical download to finish before importing contracts.')
    const body = input as { version?: unknown; days?: unknown[] } | null
    if (!body || body.version !== 1 || !Array.isArray(body.days) || !body.days.length || body.days.length > MAX_HISTORY_DAYS) throw new Error(`A version-1 contract file with 1–${MAX_HISTORY_DAYS} days is required. Download Contract format for its schema.`)
    const rows = body.days.map(value => {
      const item = value as { date?: unknown; contracts?: unknown } | null, date = tradingDate(item?.date)
      if (date > istDate(this.now()) || !isTradingDay(istTime(date, '12:00'))) throw new Error('Contract dates must be trading weekdays, today or earlier.')
      return { date, contracts: historicalContracts(item?.contracts, date), source: 'import' as const }
    })
    if (new Set(rows.map(item => item.date)).size !== rows.length) throw new Error('The contract file contains duplicate dates.')
    for (const item of rows) this.repository.put(`history:contracts:${item.date}`, item)
    return { dates: rows.map(item => item.date) }
  }
  start(input: unknown): HistoricalFetchJob {
    if (this.current?.status === 'running') throw new Error('A historical download is already running.')
    const context = this.context()
    if (!context.connected || !context.account) throw new Error('Connect mStock before fetching historical data.')
    const body = input as { startDate?: unknown; endDate?: unknown } | null
    const dates = dateRange(body?.startDate, body?.endDate, this.now())
    const job: HistoricalFetchJob = { id: randomUUID(), startDate: dates[0], endDate: dates.at(-1), status: 'running', completed: 0, total: dates.length, message: 'Fetching official historical data.', rows: [] }
    this.repository.put('history:fetch-job', job); this.current = job
    this.pending = this.download(job, dates, context.account).catch(() => { job.status = 'failed'; job.message = 'Historical download failed. Saved dates are retained; reconnect and fetch again.' }).finally(() => {
      try { this.repository.put('history:fetch-job', job) } catch { job.status = 'failed'; job.message = 'Could not save download status. Check available disk space.' }
    })
    return structuredClone(job)
  }
  private unchanged(account: string): void {
    const context = this.context()
    if (!context.connected || context.account !== account) throw new Error('Broker connection changed during download. Reconnect and fetch again.')
  }
  private async download(job: HistoricalFetchJob, dates: string[], account: string): Promise<void> {
    if (this.broker.catalog) {
      try {
        const catalog = await this.broker.catalog(); this.unchanged(account)
        if (catalog.date === istDate(this.now())) this.repository.put(`history:master:${catalog.date}`, catalog)
      } catch { /* A failed current master cannot substitute for a historical master. */ }
    }
    for (const date of dates) {
      job.message = `Fetching ${date}`
      let result: HistoricalDateResult = { date, status: 'unavailable', spotBars: 0, ceBars: 0, peBars: 0, capturedAt: this.now(), message: '' }
      try {
        this.unchanged(account)
        const closed = nonSessionReason(date)
        if (closed) { result.status = 'skipped'; result.message = closed }
        else result = await this.capture(date, account)
      } catch (error) { result.message = error instanceof Error ? error.message : 'Historical data unavailable.' }
      job.rows.push(result); job.completed++
      this.repository.put('history:fetch-job', job)
      if (!this.context().connected || this.context().account !== account) throw new Error('Broker changed')
    }
    job.status = 'complete'
    job.message = `${job.rows.filter(row => row.status === 'ready' || row.status === 'partial').length} option dataset(s) available; ${job.rows.filter(row => row.status === 'spot_only').length} spot-only date(s).`
  }
  private pair(date: string, spot: number, saved: BacktestDataset | null): Pair | null {
    if (saved) return { contracts: historicalContracts(saved.contracts, date), source: saved.contractSource ?? (saved.source === 'import' ? 'import' : 'broker') }
    const imported = this.repository.get<Pair>(`history:contracts:${date}`)
    if (imported) return { contracts: historicalContracts(imported.contracts, date), source: 'import' }
    const context = this.context(), sessions = [context.session, ...this.repository.keys(`session:${date}:`).map(key => this.repository.get<TradingSession>(key))]
    const known = sessions.find(session => session?.date === date && session.legs.CE && session.legs.PE)
    if (known) return { contracts: historicalContracts({ CE: known.legs.CE!.contract, PE: known.legs.PE!.contract }, date), source: 'session' }
    const catalog = this.repository.get<Catalog>(`history:master:${date}`)
    if (!catalog) return null
    const rows = catalog.contracts.map(contract => ({ name: 'NIFTY', exchange: 'NFO', instrument_type: contract.side, expiry: contract.expiry, strike: contract.strike, instrument_token: contract.token, tradingsymbol: contract.symbol, lot_size: contract.lotSize }))
    const [ce, pe] = resolveContracts(rows, date, spot)
    return { contracts: { CE: ce, PE: pe }, source: 'master-snapshot' }
  }
  private async capture(date: string, account: string): Promise<HistoricalDateResult> {
    const saved = this.repository.get<BacktestDataset>(`backtest:archive:${date}`)
    const result: HistoricalDateResult = { date, status: 'unavailable', spotBars: 0, ceBars: 0, peBars: 0, message: '', capturedAt: this.now() }
    const cached = this.spot(date)
    const completeSpot = cached?.candles.length === 75 && cached.candles.every((bar, index) => bar.start === istTime(date, '09:15') + index * 300_000 && bar.end === bar.start + 300_000)
    const spot = date < istDate(this.now()) && completeSpot ? cached.candles : await this.broker.history(INDEX_TOKEN, 'NSE', date, this.now()); this.unchanged(account)
    const opening = spot.find(bar => bar.start === istTime(date, '09:15'))
    if (!opening) throw new Error('Official NIFTY opening reference unavailable for this date.')
    this.repository.put(`history:spot:${date}`, { date, capturedAt: this.now(), candles: spot })
    result.spotBars = spot.length; result.status = 'spot_only'
    try {
      let pair: Pair | null
      if (date === istDate(this.now())) {
        const [ce, pe] = await this.broker.contracts(date, opening.close); this.unchanged(account)
        pair = { contracts: { CE: ce, PE: pe }, source: 'broker' }
      } else pair = this.pair(date, opening.close, saved)
      if (!pair) { result.message = 'NIFTY saved. Original ATM option history is missing; this date cannot run an option backtest. Import original contracts and candles when available.'; return result }
      const ce = await this.broker.history(pair.contracts.CE.token, 'NFO', date, this.now()); this.unchanged(account)
      result.ceBars = ce.length
      const pe = await this.broker.history(pair.contracts.PE.token, 'NFO', date, this.now()); this.unchanged(account)
      result.peBars = pe.length
      const validated = dataset({ version: 1, date, spotReferenceClose: opening.close, contracts: pair.contracts, candles: { CE: ce, PE: pe }, capturedAt: this.now(), contractSource: pair.source }, this.now(), 'broker')
      // Retain a complete broker archive if an upstream refresh regresses.
      const complete = SIDES.every(side => validated.candles[side].some(bar => bar.start === istTime(date, '15:10')))
      const previousComplete = saved?.source === 'broker' && SIDES.every(side => saved.candles[side].some(bar => bar.start === istTime(date, '15:10')))
      if (previousComplete && !complete) { result.status = 'ready'; result.message = 'Incomplete refresh; existing complete broker archive retained.' }
      else {
        this.repository.put(`backtest:archive:${date}`, validated)
        result.status = complete ? 'ready' : 'partial'
        result.message = `${complete ? 'Complete option dataset saved for backtesting.' : 'Partial option dataset saved. Past partial sessions are excluded from backtests.'}${pair.source === 'import' ? ' Contract metadata is user-supplied; historical ATM selection is not independently verified.' : ''}`
      }
      result.contractSource = pair.source
    } catch (error) { result.message = `NIFTY candles saved; option download unavailable: ${error instanceof Error ? error.message : 'broker data unavailable'}` }
    return result
  }
}
