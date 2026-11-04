import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import type { HistoricalFetchJob } from '../../shared/backtest'
import type { useDashboard } from '../hooks/useDashboard'

export function HistoricalDataPanel({ from, to, connected, online, visible, blocked, working, action, onBusy, onSaved }: {
  from: string; to: string; connected: boolean; online: boolean; visible: boolean; blocked: boolean; working: string;
  action: ReturnType<typeof useDashboard>['action']; onBusy: (busy: boolean) => void; onSaved: () => void;
}) {
  const [job, setJob] = useState<HistoricalFetchJob | null>(null), [error, setError] = useState(''), [note, setNote] = useState('')
  const file = useRef<HTMLInputElement>(null), revision = useRef(0), saved = useRef(onSaved)
  const running = job?.status === 'running', id = job?.id, status = job?.status
  useEffect(() => { saved.current = onSaved }, [onSaved])
  useEffect(() => { onBusy(running); return () => onBusy(false) }, [running, onBusy])
  useEffect(() => { if (status === 'complete') saved.current() }, [id, status])
  useEffect(() => {
    if (!visible || !online) return
    const controller = new AbortController(), version = revision.current
    void fetch('/api/history/latest', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
      .then(async response => response.ok ? response.json() : null).then(body => { if (!controller.signal.aborted && version === revision.current && body?.job) setJob(body.job) }).catch(() => {})
    return () => controller.abort()
  }, [visible, online])
  useEffect(() => {
    if (!id || status !== 'running' || !online) return
    const controller = new AbortController(); let pending = false
    async function poll() {
      if (pending) return
      pending = true
      try {
        const response = await fetch(`/api/history/jobs/${id}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load download status.')
        if (!controller.signal.aborted) { setJob(body); setError('') }
      } catch { if (!controller.signal.aborted) setError('Status refresh delayed. Checking again; do not start another download.') }
      finally { pending = false }
    }
    void poll(); const timer = setInterval(() => void poll(), 1500)
    return () => { controller.abort(); clearInterval(timer) }
  }, [id, status, online])
  async function start() {
    setError(''); setNote(''); revision.current++
    const result = await action('/api/history/fetch', { startDate: from, endDate: to }, 'history-fetch')
    if (result) setJob(result)
  }
  async function importContracts(chosen?: File) {
    if (!chosen) return
    setError(''); setNote('')
    try {
      if (chosen.size > 2 * 1024 * 1024) throw new Error('Choose a contract JSON file smaller than 2 MB.')
      const result = await action('/api/history/contracts', JSON.parse(await chosen.text()), 'history-contracts')
      if (result) setNote(`Original contract metadata saved for ${result.dates.length} date(s). Fetch the range again to download option candles. Metadata is user-supplied.`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Contract file could not be imported.') }
  }
  return <section className="panel history-panel" aria-label="Historical data download">
    <div className="panel-title"><h2>Historical data</h2><button className="button secondary" disabled={!connected || !online || blocked || running || !!working || !from || !to} onClick={() => void start()}><Download size={14} />{running ? 'Fetching…' : 'Fetch selected dates'}</button></div>
    <p className="history-help">Fetch {from || 'start date'} → {to || 'end date'} using mStock · up to 93 calendar days. Completed NIFTY dates are reused on retry. Spot-only data cannot run an option backtest.</p>
    {job && <div className="history-import-actions"><span className="history-help">Saved range: {job.startDate ?? job.rows[0]?.date} → {job.endDate ?? job.rows.at(-1)?.date}</span>{job.rows.length > 0 && <a className="text-button" href={`/api/history/jobs/${job.id}/data`}><Download size={13} />Download all JSON{running ? ' (so far)' : ''}</a>}</div>}
    {job && <div className="history-progress" role="status"><span>{job.message}</span><span>{job.completed}/{job.total} dates</span></div>}
    {job?.rows.length ? <div className="trade-scroll"><table><thead><tr><th>Date</th><th>Coverage</th><th>NIFTY / CE / PE bars</th><th>Details</th><th>Data</th></tr></thead><tbody>{job.rows.map(row => <tr key={row.date}><td>{row.date}</td><td><span className="tag">{row.status.replaceAll('_', ' ')}</span></td><td>{row.spotBars} / {row.ceBars} / {row.peBars}</td><td className="history-message">{row.message}</td><td>{row.spotBars > 0 && <a className="text-button" href={`/api/history/spot/${row.date}`}>NIFTY JSON</a>}{['ready', 'partial'].includes(row.status) && <a className="text-button" href={`/api/backtest/archive/${row.date}`}>Option JSON</a>}</td></tr>)}</tbody></table></div> : null}
    {job?.status === 'failed' && <p className="inline-error" role="alert">{job.message}</p>}
    {(error || note) && <p className={error ? 'inline-error' : 'history-help'} role="status">{error || note}</p>}
    <details className="history-contracts"><summary>Original contracts for expired or unavailable dates</summary><p>Import a version-1 JSON file with a <code>days</code> array. Each item needs its date and the original CE/PE token, symbol, expiry, strike and lot size. Use broker records or a saved historical master; current contracts cannot establish a past expired ATM pair.</p><div className="history-import-actions"><input ref={file} type="file" accept="application/json,.json" hidden onChange={event => { void importContracts(event.target.files?.[0]); event.target.value = '' }} /><button className="text-button" disabled={!online || !!working || blocked || running} onClick={() => file.current?.click()}><Upload size={13} />Import contracts</button><a className="text-button" href="/api/history/contracts/schema"><Download size={13} />Contract format</a></div></details>
  </section>
}
