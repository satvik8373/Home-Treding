import { randomUUID } from 'node:crypto'
import type { BacktestDataset, BacktestDate, BacktestJob } from '../../shared/backtest.ts'
import type { TradingSession } from '../../shared/model.ts'
import { RULES } from '../../shared/model.ts'
import type { MStock } from '../broker.ts'
import { INDEX_TOKEN } from '../broker.ts'
import { istDate, istTime } from '../time.ts'
import { dateRange, dataset, options, tradingDate } from './validation.ts'
import { ENGINE, replay, report } from './replay.ts'
import { nonSessionReason } from './calendar.ts'
import type { HistoricalData } from './historical.ts'

export interface BacktestRepository { get<T>(key: string): T | null; put(key: string, value: unknown): void; keys(prefix: string): string[] }
export class MemoryRepository implements BacktestRepository {
  private values = new Map<string, unknown>()
  get<T>(key: string): T | null { return structuredClone((this.values.get(key) as T | undefined) ?? null) }
  put(key: string, value: unknown) { this.values.set(key, structuredClone(value)) }
  keys(prefix: string) { return [...this.values.keys()].filter(key => key.startsWith(prefix)) }
}
type Context = { connected: boolean; account: string | null; session: TradingSession | null }
const INDEX = 'backtest:v2:job-index', jobKey = (id: string) => `backtest:v2:job:${id}`
export const completeDataset = (data: BacktestDataset) => (['CE', 'PE'] as const).every(side => data.candles[side].some(bar => bar.start === istTime(data.date, RULES.cutoff)))

/** One job: obtain source data, validate, replay, persist. No execution/controller API. */
export class Backtests {
  private records = new Map<string, { job: BacktestJob; datasets: BacktestDataset[] }>()
  private running = false
  constructor(private broker: Pick<MStock, 'history' | 'contracts'>, private context: () => Context,
    private repository: BacktestRepository = new MemoryRepository(), private now = Date.now, private history?: HistoricalData) {
    for (const id of (repository.get<string[]>(INDEX) ?? []).slice(-10)) {
      const stored = repository.get<{ job: BacktestJob; datasets: BacktestDataset[] }>(jobKey(id))
      if (!stored || stored.job.result && stored.job.result.engine !== ENGINE) continue
      if (stored.job.status === 'running') { stored.job.status = 'failed'; stored.job.message = 'Engine restarted during this run. Saved candles are retained; run again.' }
      this.records.set(id, stored)
    }
  }
  latest(): BacktestJob | null { const id = [...this.records.keys()].at(-1); return id ? this.job(id) : null }
  job(id: string): BacktestJob { const record = this.records.get(id); if (!record) throw new Error('Backtest result unavailable. Run the selected dates again.'); return structuredClone(record.job) }
  jobDataset(id: string, date: string): BacktestDataset | null { this.job(id); return structuredClone(this.records.get(id)!.datasets.find(data => data.date === tradingDate(date)) ?? null) }
  archive(date: string): BacktestDataset | null { return this.repository.get(`backtest:archive:${tradingDate(date)}`) }
  private persist(id: string) { this.repository.put(jobKey(id), this.records.get(id)) }
  dates(): BacktestDate[] {
    const dates: BacktestDate[] = []
    for (const key of this.repository.keys('backtest:archive:')) {
      try { const data = dataset(this.repository.get(key), this.now(), this.repository.get<BacktestDataset>(key)!.source); dates.push({ date: data.date, source: data.source, capturedAt: data.capturedAt, complete: completeDataset(data) }) } catch { /* Invalid archives are not advertised as ready. */ }
    }
    return dates.sort((a, b) => b.date.localeCompare(a.date))
  }
  import(input: unknown): BacktestDate {
    if (this.running) throw new Error('Wait for the current backtest to finish before importing data.')
    const validated = dataset(input, this.now(), 'import'), existing = this.archive(validated.date)
    if (existing?.source === 'broker' && completeDataset(existing)) throw new Error('A complete broker-captured archive already exists for this date.')
    this.repository.put(`backtest:archive:${validated.date}`, validated)
    return { date: validated.date, source: validated.source, capturedAt: validated.capturedAt, complete: completeDataset(validated) }
  }
  start(input: unknown): BacktestJob {
    if (this.running) throw new Error('A backtest is already running. Wait for it to finish.')
    const body = input as Record<string, unknown> | null
    const dates = dateRange(body?.startDate, body?.endDate, this.now()), config = options(body?.options ?? {})
    const id = randomUUID(), job: BacktestJob = { id, startDate: dates[0], endDate: dates.at(-1), status: 'running', completed: 0, total: dates.length, message: 'Checking original option data…', result: null }
    this.records.set(id, { job, datasets: [] }); this.running = true
    while (this.records.size > 10) this.records.delete(this.records.keys().next().value!)
    try { this.persist(id); this.repository.put(INDEX, [...this.records.keys()]) } catch (error) { this.records.delete(id); this.running = false; throw error }
    void (async () => {
      if (this.history && this.context().connected && dates.some(date => !nonSessionReason(date) && (!this.archive(date) || date === istDate(this.now()) || !completeDataset(this.archive(date)!)))) {
        job.message = 'Downloading available NIFTY and original option candles…'
        const current = this.history.latest()
        if (current?.status === 'running' && (current.startDate !== dates[0] || current.endDate !== dates.at(-1))) throw new Error('Another date range is downloading. Wait for it to finish.')
        const download = current?.status === 'running' ? current : this.history.start({ startDate: dates[0], endDate: dates.at(-1) })
        const finished = await this.history.finished(download.id)
        if (finished.status !== 'complete') throw new Error(finished.message)
      }
      const days = [], skipped = []
      for (const date of dates) {
        job.message = `Replaying ${date}`
        try {
          const closed = nonSessionReason(date); if (closed) throw new Error(closed)
          const data = await this.load(date), day = replay(data, config)
          if (day.status === 'partial' && date !== istDate(this.now())) throw new Error('Historical session is incomplete: original option candles including the 15:10 open are required.')
          days.push(day); this.records.get(id)!.datasets.push(structuredClone(data))
        } catch (error) { skipped.push({ date, reason: error instanceof Error ? error.message : 'Source data unavailable.' }) }
        job.completed++
      }
      job.result = report(days, skipped, config, dates[0], dates.at(-1)!, this.now())
      job.status = days.length ? 'complete' : 'blocked'
      job.message = days.length ? `${days.length} sessions replayed · ${skipped.length} excluded dates.` : dates.every(date => nonSessionReason(date)) ? 'No normal NSE trading sessions in this range. Choose a trading date.' : 'Needs original CALL + PUT candles. No usable option sessions were found; no performance result was calculated.'
    })().catch(error => { job.status = 'failed'; job.message = error instanceof Error ? error.message : 'Backtest failed.' }).finally(() => {
      this.running = false
      try { this.persist(id) } catch { job.status = 'failed'; job.message = 'Could not save the backtest. Check available disk space.' }
    })
    return structuredClone(job)
  }
  private async load(date: string): Promise<BacktestDataset> {
    const saved = this.archive(date), context = this.context()
    if (saved && (completeDataset(saved) || date !== istDate(this.now()) || !context.connected || this.history)) return dataset(saved, this.now(), saved.source)
    if (this.history || date !== istDate(this.now()) || !context.connected) throw new Error('No saved historical ATM option data. Import the original CALL + PUT candles for this date.')
    const spot = (await this.broker.history(INDEX_TOKEN, 'NSE', date, this.now())).find(bar => bar.start === istTime(date, RULES.referenceStart))
    if (!spot) throw new Error('NIFTY opening reference unavailable.')
    const [ce, pe] = await this.broker.contracts(date, spot.close)
    const candles = { CE: await this.broker.history(ce.token, 'NFO', date, this.now()), PE: await this.broker.history(pe.token, 'NFO', date, this.now()) }
    if (!this.context().connected || this.context().account !== context.account) throw new Error('Broker account changed during download. Retry the selected dates.')
    const data = dataset({ version: 1, date, spotReferenceClose: spot.close, contracts: { CE: ce, PE: pe }, candles, capturedAt: this.now(), contractSource: 'broker' }, this.now(), 'broker')
    this.repository.put(`backtest:archive:${date}`, data)
    return data
  }
}
