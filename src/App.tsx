import './components/StrategySettingsPanel.css'
import { StrategySettingsPanel } from './components/StrategySettingsPanel'
import { useEffect, useState } from 'react'
import { Check, Clock3, Link2, Radio, RefreshCw, X } from 'lucide-react'
import type { Mode, Side } from '../shared/model'
import { freshMark } from '../shared/market'
import { BrokerDialog } from './components/BrokerDialog'
import { AccountProfile } from './components/AccountProfile'
import { LegCard } from './components/LegCard'
import { MarketChart } from './components/MarketChart'
import { RulesDialog } from './components/RulesDialog'
import { SessionControls } from './components/SessionControls'
import { TradesPanel } from './components/TradesPanel'
import { BacktestPanel } from './components/BacktestPanel'
import { TransparencyPanel } from './components/TransparencyPanel'
import { DEFAULT_SETTINGS, settingsFor } from '../shared/settings'
import { useDashboard } from './hooks/useDashboard'
import { clock, date, money } from './lib/format'
import { useDeployment } from './lib/deployment'
import './App.css'
import './minimal-ui.css'

const statusLabels: Record<string, string> = {
  idle: 'Not started', armed: 'Armed', preparing: 'Loading reference',
  running: 'Running', stopping: 'Closing positions', stopped: 'Stopped', blocked: 'Needs attention',
}
const currentView = () => window.location.hash === '#settings' ? 'settings' as const : window.location.hash === '#backtest' ? 'backtest' as const : window.location.hash === '#audit' ? 'audit' as const : 'market' as const

export default function App() {
  const deployment = useDeployment()
  const { data, online, now, error, setError, working, action } = useDashboard()
  const [brokerDialog, setBrokerDialog] = useState(false)
  const [rulesDialog, setRulesDialog] = useState(false)
  const [mode, setMode] = useState<Mode>('paper')
  const [liveAck, setLiveAck] = useState(false)
  const [view, setView] = useState<'market' | 'backtest' | 'audit' | 'settings'>(currentView)

  useEffect(() => {
    const update = () => setView(currentView())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  function navigate(next: 'market' | 'backtest' | 'audit' | 'settings') {
    setView(next)
    window.history.replaceState(null, '', `#${next}`)
  }

  const session = data?.session, broker = data?.broker, connected = !!broker?.connected
  const running = !!session && ['armed', 'preparing', 'running', 'stopping'].includes(session.status)
  const sides: Side[] = ['CE', 'PE']
  const positions = sides.filter(side => !!session?.legs[side]?.position)
  const locked = running || positions.length > 0 || !!session?.pending
  const dayLocked = !!session && session.date === new Date(now + 330 * 60_000).toISOString().slice(0, 10) && session.mode === mode
    && (!broker?.account || session.account === broker.account)
  const realized = session?.pnlVerified
    ? Object.values(session.legs).reduce((sum, leg) => sum + leg!.realized, 0)
    : null
  let openPnl: number | null = session ? 0 : null
  for (const side of positions) {
    const leg = session!.legs[side]!, mark = data?.marks[leg.contract.token]
    if (!freshMark(mark, now)) { openPnl = null; break }
    openPnl! += (mark.price - leg.position!.average) * leg.position!.quantity
  }
  const total = realized == null || openPnl == null ? null : realized + openPnl
  const identity = `${broker?.account ?? 'disconnected'}:${session?.id ?? 'no-session'}`
  const markFor = (side: Side) => session?.legs[side] ? data?.marks[session.legs[side]!.contract.token] : undefined

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#market" aria-label="Mavrix 009 live market">
          <img className="brand-image" src="/mavrix-icon.jpg" alt="" width="28" height="28" />
          MAVRIX <small>009</small>
        </a>
        <div className="topbar-right">
          <span className="engine-link">
            <i className={`status-dot ${online ? 'green' : ''}`} />
            {online ? 'Engine online' : 'Engine offline'}
          </span>
          <span className="clock"><Clock3 size={14} />{clock(now, true)} <small>IST</small></span>
          <button className="broker-button" disabled={!deployment.available} title={!deployment.available ? 'Connect the hosted execution engine first.' : undefined} onClick={() => setBrokerDialog(true)}>
            <Link2 size={15} />{connected ? 'mStock connected' : 'Connect mStock'}
            {connected && <Check size={14} />}
          </button>
          <AccountProfile broker={broker} onBroker={() => setBrokerDialog(true)} onSettings={() => navigate('settings')} />
        </div>
      </header>

      <main>
        <div className="page-heading">
          <div><h1>009 Breakout</h1><p>NIFTY 50 <span>·</span> Independent CALL & PUT</p></div>
          <span className={`tag ${session?.mode === 'live' ? 'live-tag' : ''}`}>
            {!session ? 'NO SESSION' : session.mode === 'live' ? 'LIVE SESSION' : 'PAPER SESSION'}
          </span>
        </div>
        {!deployment.available ? <section className="deployment-notice" role="status"><div><strong>{deployment.reason === 'setup' ? 'Execution engine not connected' : 'Dashboard connection could not be verified'}</strong><p>You can view the dashboard and strategy rules. Market data, broker connection, backtests and orders are unavailable until the hosted engine is connected.</p></div><button className="button secondary" disabled={deployment.checking} onClick={deployment.retry}>{deployment.checking ? 'Checking…' : 'Check connection'}</button><details><summary>Deployment setup</summary><p>The deployment owner must configure the hosted engine connection and private dashboard access. <a href="https://github.com/satvik8373/Home-Treding/blob/main/VERCEL_DEPLOYMENT.md" target="_blank" rel="noreferrer">Open setup guide</a>.</p></details></section>
          : !online && <div className="notice" role="status">Waiting for the trading engine to reconnect.</div>}
        {error && (
          <div className="notice error" role="alert">
            <span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button>
          </div>
        )}
        <nav className="workspace-nav" aria-label="Workspace">
          <button className={view === 'market' ? 'active' : ''} aria-current={view === 'market' ? 'page' : undefined} onClick={() => navigate('market')}>Live market</button>
          <button className={view === 'backtest' ? 'active' : ''} aria-current={view === 'backtest' ? 'page' : undefined} onClick={() => navigate('backtest')}>Backtest</button>
          <button className={view === 'settings' ? 'active' : ''} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}>Settings</button>
          <button className={view === 'audit' ? 'active' : ''} aria-current={view === 'audit' ? 'page' : undefined} onClick={() => navigate('audit')}>Money & audit</button>
        </nav>

        <div hidden={view !== 'market'}>
          <section className="summary-grid" aria-label="Session summary">
            <div>
              <span className="eyebrow">ENGINE</span>
              <strong className="status-value"><i className={`status-dot ${session?.status === 'running' ? 'green' : ''}`} />{statusLabels[session?.status ?? 'idle']}</strong>
              <small>{session?.pending ? 'Waiting for broker confirmation' : '5-minute candle decisions'}</small>
            </div>
            <div>
              <span className="eyebrow">SESSION P&L</span>
              <strong className={total != null && total < 0 ? 'negative-text' : total != null && total > 0 ? 'positive-text' : ''}>{money(total)}</strong>
              <small>Realized {money(realized)} · before charges</small>
            </div>
            <div>
              <span className="eyebrow">OPEN POSITIONS</span>
              <strong className="status-value">{!session ? '—' : positions.length ? positions.map(side => side === 'CE' ? 'CALL' : 'PUT').join(' + ') : 'Flat'}</strong>
              <small>Open P&L {money(openPnl)}</small>
            </div>
            <div>
              <span className="eyebrow">LOCKED ATM</span>
              <strong>{session?.atm?.toLocaleString('en-IN') ?? '—'}</strong>
              <small>{session?.expiry ? `Expiry ${date(session.expiry)}` : 'Selected from the 09:20 close'}</small>
            </div>
          </section>

          {session && (
            <div className={`session-message ${session.status === 'blocked' ? 'attention' : ''}`} role="status">
              <Radio size={14} /><span>{session.message}</span>
              {session.status === 'blocked' && <button className="text-button" disabled={!online || !connected || !!working} onClick={() => void action('/api/strategy/reconcile', {}, 'reconcile')}><RefreshCw size={13} />Reconcile</button>}
            </div>
          )}
          <div className="workspace">
            <MarketChart connected={connected} identity={identity} now={now} marks={data?.marks ?? {}} legs={session?.legs ?? {}} trades={session?.trades ?? []} settings={settingsFor(session)} />
            <SessionControls session={session} locked={locked} connected={connected} online={online} working={working} now={now} mode={mode} setMode={setMode} liveAck={liveAck} setLiveAck={setLiveAck} action={action} onRules={() => setRulesDialog(true)} settings={locked || dayLocked ? settingsFor(session) : data?.savedSettings ?? DEFAULT_SETTINGS} onSettings={() => navigate('settings')} liveAvailable={data?.runtime?.liveExecution !== false} liveReason={data?.runtime?.reason} />
          </div>
          <div className="section-heading"><h2>Strategy positions</h2><span>References stay fixed for the session</span></div>
          <div className="legs-grid">{sides.map(side => <LegCard key={side} side={side} leg={session?.legs[side]} mark={markFor(side)} now={now} settings={settingsFor(session)} />)}</div>
          <TradesPanel trades={session?.trades ?? []} />
          <details className="panel activity-panel">
            <summary>Session activity <span>{session?.activity.length ?? 0} events</span></summary>
            {session?.activity.length ? (
              <ol className="activity-list">{[...session.activity].reverse().slice(0, 40).map((entry, index) => (
                <li key={`${entry.at}-${index}`}><time>{clock(entry.at, true)}</time><p className={entry.level === 'error' ? 'negative-text' : ''}>{entry.message}</p></li>
              ))}</ol>
            ) : <p className="trade-empty">Activity appears after the strategy starts.</p>}
          </details>
        </div>

        <div hidden={view !== 'backtest'}>
          <BacktestPanel visible={view === 'backtest'} now={now} connected={connected} online={online} working={working} action={action} settings={data?.savedSettings ?? DEFAULT_SETTINGS} />
        </div>
        <div hidden={view !== 'settings'}><StrategySettingsPanel saved={data?.savedSettings ?? DEFAULT_SETTINGS} effective={session ? settingsFor(session) : data?.savedSettings ?? DEFAULT_SETTINGS} active={running} hasSession={!!session} online={online} working={working} action={action} /></div>
        <div hidden={view !== 'audit'}><TransparencyPanel data={data} visible={view === 'audit'} now={now} online={online} /></div>
        <footer className="page-footer">
          <span>MAVRIX / 009 · {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }).format(now)}</span>
          <a href="https://tradingapi.mstock.com/docs/v1/Introduction/" target="_blank" rel="noreferrer">Official mStock API</a>
        </footer>
      </main>
      {brokerDialog && <BrokerDialog broker={broker} locked={locked} online={online} working={working} error={error} action={action} onClose={() => setBrokerDialog(false)} />}
      {rulesDialog && <RulesDialog settings={locked || dayLocked ? settingsFor(session) : data?.savedSettings ?? DEFAULT_SETTINGS} onClose={() => setRulesDialog(false)} />}
    </div>
  )
}
