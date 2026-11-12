import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { BrokerDiagnostics as Report } from '../../shared/diagnostics'
import { clock, money, price } from '../lib/format'

export function BrokerDiagnostics({ account }: { account: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [account])
  async function run() {
    if (request.current) return
    const controller = new AbortController(); request.current = controller
    const timer = setTimeout(() => controller.abort(), 20_000)
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/broker/diagnostics', {
        cache: 'no-store',
        signal: typeof AbortSignal.any === 'function' ? AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) : controller.signal,
      })
      const body = await response.json()
      clearTimeout(timer)
      if (!response.ok) throw new Error(body.error || 'Account checks could not complete.')
      if (!controller.signal.aborted && body.account === account) setReport(body)
    } catch (error) {
      clearTimeout(timer)
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not complete account checks.')
    } finally { if (request.current === controller) { request.current = null; setLoading(false) } }
  }
  const authPassed = !!report?.checks.some(c => c.name === 'Authentication & funds' && c.status === 'pass')
  return <section className="broker-diagnostics" aria-label="mStock account checks">
    <button className="button primary full-width" disabled={loading} onClick={() => void run()}>{loading ? 'Checking broker APIs…' : 'Run read-only account checks'}</button>
    <p className="form-hint">Checks funds, positions, order-book access and NIFTY quotes. Sends no orders.</p>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {report && <>
      <p className="diagnostic-time">Checked {clock(report.checkedAt, true)} IST · Account {report.account}</p>
      {authPassed && <div className="diagnostic-flow-banner"><ShieldCheck size={14} /><span>Official mStock API flow verified. Requests from execution IP accepted by mStock.</span></div>}
      <ul className="diagnostic-checks">{report.checks.map(check => <li key={check.name}><div><strong>{check.name}</strong><span className={`tag ${check.status === 'pass' ? 'positive' : ''}`}>{check.status === 'untested' ? 'NOT TESTED' : check.status.toUpperCase()}</span></div><p>{check.detail}</p>{check.helpUrl && <a className="text-button" href={check.helpUrl} target="_blank" rel="noreferrer">mStock segment activation guide</a>}</li>)}</ul>
      {report.funds.length > 0 && <dl className="connection-details">{report.funds.map((fund, index) => <div key={`${fund.segment}-${index}`}><dt>Balance · {fund.segment}</dt><dd>{money(fund.available)}<small>Utilized {money(fund.utilized)}</small></dd></div>)}</dl>}
      <details><summary>Broker positions ({report.positions.filter(item => item.quantity !== 0).length} open)</summary>{report.positions.filter(item => item.quantity !== 0).map((position, index) => <p className="diagnostic-record" key={`${position.symbol}-${index}`}><strong>{position.symbol}</strong><span>{position.exchange} · {position.product} · {position.quantity} units</span></p>)}{!report.positions.some(item => item.quantity !== 0) && <p className="form-hint">No open broker positions returned.</p>}</details>
      <details><summary>Broker order book ({report.orderCount})</summary>{report.orders.map((order, index) => <div className="diagnostic-record" key={`${order.id}-${index}`}><strong>{order.symbol} · {order.side}</strong><span>{order.status} · filled {order.filled ?? '—'} / {order.quantity ?? '—'} · avg ₹{price(order.average)}</span><small>ID {order.id || '—'} · {order.at || 'Timestamp unavailable'}</small></div>)}{report.orderCount === 0 && <p className="form-hint">No broker orders returned.</p>}</details>
    </>}
    <details className="execution-guide"><summary>How to verify trading</summary><ol><li>Run these read-only checks and compare the account, funds and orders with mStock.</li><li>Use Paper mode during market hours to verify the strategy with real quotes. Paper never submits a broker order.</li><li>Live mode places 3 lots per qualifying leg; both legs can enter. Confirm the live-order checkbox only when you intend to trade.</li><li>A broker order ID proves acknowledgement. Match its filled quantity and average price in mStock to verify execution. A pending or rejected order is not a fill.</li></ol></details>
  </section>
}
