import { useEffect, useRef, useState } from 'react'
import { Download, Play, Upload } from 'lucide-react'
import type { BacktestJob, HistoricalFetchJob } from '../../shared/backtest'
import { pastTwoMonths } from '../../shared/history'
import type { useDashboard } from '../hooks/useDashboard'
import { clock, money, price } from '../lib/format'
import { BacktestEquity } from './BacktestEquity'
import { HistoricalDataPanel } from './HistoricalDataPanel'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import type { StrategySettings } from '../../shared/settings'
import './BacktestPanel.css'

type Props = { visible: boolean; now: number; connected: boolean; online: boolean; working: string; action: ReturnType<typeof useDashboard>['action']; settings?: StrategySettings }
const dayOf = (now: number) => new Date(now + 330 * 60_000).toISOString().slice(0, 10)

export function BacktestPanel({ visible, now, connected, online, working, action, settings = DEFAULT_SETTINGS }: Props) {
  const [from, setFrom] = useState(() => dayOf(now)), [to, setTo] = useState(() => dayOf(now))
  const [slippage, setSlippage] = useState('0.05'), [fee, setFee] = useState('0')
  const [job, setJob] = useState<BacktestJob | null>(null), [history, setHistory] = useState<HistoricalFetchJob | null>(null)
  const [error, setError] = useState(''), [importNote, setImportNote] = useState(''), [historyBusy, setHistoryBusy] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const version = useRef(0), restored = useRef(false), file = useRef<HTMLInputElement>(null)
  const running = job?.status === 'running', busy = running || historyBusy || !!working
  useEffect(() => {
    if (!online || !visible) return
    const controller = new AbortController(); let pending = false
    async function refresh() {
      if (pending) return
      pending = true; const revision = version.current
      try {
        const opts = { cache: 'no-store' as const, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) }
        const responses = await Promise.all([fetch('/api/backtest/latest', opts), fetch('/api/history/latest', opts)])
        if (responses.some(response => !response.ok)) throw new Error('Status refresh delayed. Retrying automatically.')
        const [backtest, download] = await Promise.all(responses.map(response => response.json()))
        if (controller.signal.aborted || revision !== version.current) return
        setJob(previous => previous?.id === backtest.job?.id && previous?.status === backtest.job?.status && previous?.completed === backtest.job?.completed && previous?.message === backtest.job?.message ? previous : backtest.job)
        setHistory(previous => previous?.id === download.job?.id && previous?.status === download.job?.status && previous?.completed === download.job?.completed && previous?.message === download.job?.message ? previous : download.job)
        setRefreshError('')
        if (!restored.current) {
          restored.current = true
          if (backtest.job?.startDate && backtest.job?.endDate) { setFrom(backtest.job.startDate); setTo(backtest.job.endDate) }
          if (backtest.job?.result) { setSlippage(String(backtest.job.result.options.slippagePoints)); setFee(String(backtest.job.result.options.feePerOrder)) }
        }
      } catch (error) { if (!controller.signal.aborted && revision === version.current) setRefreshError(error instanceof Error ? error.message : 'Status unavailable. Retrying.') }
      finally { pending = false }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 2000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [visible, online])
  function choose(start: string, end: string) { restored.current = true; setFrom(start); setTo(end); setError('') }
  async function run() {
    if (!slippage.trim() || !fee.trim()) { setError('Enter slippage and cost, or use 0 to exclude them.'); return }
    version.current++; restored.current = true; setError(''); setImportNote('')
    const response = await action('/api/backtest/run', { startDate: from, endDate: to, options: { slippagePoints: Number(slippage), feePerOrder: Number(fee) } }, 'backtest')
      if (response) setJob(response)
  }
  async function importFile(chosen?: File) {
    if (!chosen) return
    version.current++; restored.current = true; setError(''); setImportNote('')
    try {
      if (chosen.size > 2 * 1024 * 1024) throw new Error('Choose an original option dataset smaller than 2 MB.')
      const result = await action('/api/backtest/import', JSON.parse(await chosen.text()), 'import-backtest')
      if (result) { choose(result.date, result.date); setImportNote(`Imported ${result.date} · ${result.complete ? 'complete option session' : 'partial option session'}. Select Run backtest.`) }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read the dataset.') }
  }
  const result = job?.result, summary = result?.summary
  const fills = result?.days.flatMap(day => day.fills).sort((a, b) => a.at - b.at) ?? []
  const selectedHistory = history?.startDate === from && history?.endDate === to ? history : null
  return <section className="backtest-view" aria-label="NIFTY 009 backtest">
    <section className="panel bt-controls">
      <div className="panel-title"><h2>NIFTY 009 · Backtest</h2><span className="tag">SIMULATION</span></div>
      <div className="bt-periods"><button className="button secondary" disabled={busy} onClick={() => choose(dayOf(now), dayOf(now))}>Today</button><button className="button secondary" disabled={busy} onClick={() => { const range = pastTwoMonths(now); choose(range.startDate, range.endDate) }}>Past 2 months</button></div>
      <div className="bt-form"><label className="field">From<input aria-label="Backtest from date" type="date" max={dayOf(now)} value={from} disabled={busy} onChange={event => choose(event.target.value, to)} /></label><label className="field">To<input aria-label="Backtest to date" type="date" min={from} max={dayOf(now)} value={to} disabled={busy} onChange={event => choose(from, event.target.value)} /></label><button className="button primary" disabled={!online || busy || !from || !to} onClick={() => void run()}><Play size={13} />{running ? 'Running…' : 'Run backtest'}</button></div>
      <p className="bt-help">Next run: {settings.entryLots} lots · breakout +{settings.breakoutPercent}% / exit −{settings.exitPercent}% · targets +{settings.target1Points}/+{settings.target2Points} · cutoff {settings.cutoff}. Uses saved strategy settings; available broker data loads automatically.</p>
      <details className="bt-options"><summary>Costs & data import</summary><div className="bt-form"><label className="field">Slippage · points / fill<input aria-label="Slippage points" type="number" min="0" max="10" step="0.01" value={slippage} disabled={busy} onChange={event => setSlippage(event.target.value)} /></label><label className="field">Cost · ₹ / order<input aria-label="Cost per order" type="number" min="0" max="1000" value={fee} disabled={busy} onChange={event => setFee(event.target.value)} /></label><input ref={file} type="file" hidden accept="application/json,.json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /><button className="button secondary" disabled={!online || busy} onClick={() => file.current?.click()}><Upload size={13} />Import option data</button></div><a className="text-button bt-format" href="/api/backtest/schema">Download data format</a></details>
    </section>
    {(error || refreshError || importNote) && <p className="notice" role="status">{error || refreshError || importNote}</p>}
    {job && <section className="panel bt-status" role="status"><strong>{job.status === 'blocked' ? 'Needs data' : job.status === 'running' ? 'Loading & replaying' : job.status === 'failed' ? 'Run interrupted' : job.result?.summary.partialSessions ? 'Partial session replay' : 'Backtest complete'}</strong><span>{job.message}</span>{running && <progress value={selectedHistory?.status === 'running' ? selectedHistory.completed : job.completed} max={job.total} />}</section>}
    {selectedHistory && <p className="bt-help">Saved NIFTY: {selectedHistory.rows.filter(row => row.spotBars > 0).length} dates · complete option datasets: {selectedHistory.rows.filter(row => row.status === 'ready').length}. Spot-only data cannot replay this option strategy.</p>}
    {result && <>
      <div className="bt-result-heading"><div><h2>{result.startDate} → {result.endDate}</h2><p>{summary!.completeSessions} complete · {summary!.partialSessions} partial · {result.skipped.length} excluded dates</p></div>{summary!.sessions > 0 && <a className="text-button" href={`/api/backtest/jobs/${job!.id}/trades.csv`}><Download size={13} />Export fills</a>}</div>
      {summary!.sessions > 0 && <><section className="bt-metrics"><div><span>Net marked P&L</span><strong>{money(summary!.markedNetPnl)}</strong><small>Fees {money(summary!.fees)} · open {money(summary!.openPnl)}</small></div><div><span>Closed trades</span><strong>{summary!.closedTrades}</strong><small>{summary!.orderCount} simulated fills · {summary!.openTrades} open</small></div><div><span>Win rate</span><strong>{summary!.winRate == null ? '—' : `${price(summary!.winRate)}%`}</strong><small>Closed cycles, after estimated costs</small></div><div><span>Max drawdown</span><strong>{money(summary!.maxDrawdown)}</strong><small>Five-minute portfolio marks</small></div></section>{visible && result.equity.length > 1 && <BacktestEquity points={result.equity} />}
      <section className="panel bt-days"><div className="panel-title"><h2>Tested sessions</h2></div><div className="trade-scroll"><table><thead><tr><th>Date</th><th>Source</th><th>ATM / expiry / lot</th><th>Coverage</th><th>Net P&L</th><th>Data</th></tr></thead><tbody>{result.days.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.source === 'broker' ? 'mStock' : 'Imported'}</td><td>{day.atm} / {day.expiry} / {day.lotSize}</td><td>{day.status} · {clock(day.asOf)}</td><td>{money(day.markedNetPnl)}</td><td><a className="text-button" href={`/api/backtest/jobs/${job!.id}/data/${day.date}`}>Original JSON</a></td></tr>)}</tbody></table></div></section>
      <section className="panel bt-days"><div className="panel-title"><h2>Simulated fills · {fills.length}</h2></div>{fills.length ? <div className="trade-scroll"><table><thead><tr><th>Date / time IST</th><th>Leg</th><th>Action</th><th>Qty</th><th>Price</th><th>Reason</th><th>Timing</th><th>Fee</th></tr></thead><tbody>{fills.map(fill => <tr key={fill.id}><td>{dayOf(fill.at)} {clock(fill.at)}</td><td>{fill.side}</td><td>{fill.transaction}</td><td>{fill.quantity}</td><td>{price(fill.price)}</td><td>{fill.reason.replaceAll('_', ' ')}</td><td>{fill.timing?.replaceAll('-', ' ')}</td><td>{money(fill.fee)}</td></tr>)}</tbody></table></div> : <p className="bt-help">No qualifying signal in the tested candles.</p>}</section></>}
      {result.skipped.length > 0 && <details className="panel bt-details"><summary>Excluded dates · {result.skipped.length}</summary><ul>{result.skipped.map(item => <li key={item.date}><b>{item.date}</b><span>{item.reason}</span></li>)}</ul></details>}
      <details className="panel bt-details"><summary>Method & limitations · {result.engine}</summary><ul>{result.assumptions.map(text => <li key={text}>{text}</li>)}</ul></details>
    </>}
    <details className="panel bt-details"><summary>Historical downloads & original contract imports</summary><HistoricalDataPanel from={from} to={to} connected={connected} online={online} visible={visible} blocked={running} working={working} action={action} onBusy={setHistoryBusy} onSaved={() => {}} /></details>
  </section>
}
