import { directionOf, signFor } from '../shared/strategy'
import type { StrategyDirection } from '../shared/strategy'
import './components/StrategySettingsPanel.css'
import { StrategySettingsPanel } from './components/StrategySettingsPanel'
import { useCallback, useEffect, useState } from 'react'
import { ChartNoAxesCombined, Check, FlaskConical, LayoutDashboard, Link2, Radio, RefreshCw, Settings2, ShieldCheck, UserRound, X } from 'lucide-react'
import type { Mode, Side } from '../shared/model'
import { freshMark } from '../shared/market'
import { BrokerDialog } from './components/BrokerDialog'
import { AccountProfile } from './components/AccountProfile'
import { MarketChart } from './components/MarketChart'
import { RulesDialog } from './components/RulesDialog'
import { PortfolioHeroCard } from './components/PortfolioHeroCard'
import { StrategyContextBanner } from './components/StrategyContextBanner'
import { LegCard } from './components/LegCard'
import { OrdersPanel } from './components/OrdersPanel'
import { TradesPanel } from './components/TradesPanel'
import { clock } from './lib/format'
import { BacktestPanel } from './components/BacktestPanel'
import { TransparencyPanel } from './components/TransparencyPanel'
import { AnalyticsPanel } from './components/AnalyticsPanel'
import { DEFAULT_SETTINGS, SELL_DEFAULT_SETTINGS, settingsFor } from '../shared/settings'
import { useDashboard } from './hooks/useDashboard'
import { useDeployment } from './lib/deployment'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { currentView, workspacePages, type WorkspaceView } from './lib/workspace'
import { useAccount } from './lib/account'

const viewIcons: Record<WorkspaceView, React.ComponentType<{ size?: number }>> = {
  market: LayoutDashboard,
  analytics: ChartNoAxesCombined,
  backtest: FlaskConical,
  settings: Settings2,
  audit: ShieldCheck,
}

const mobileTabLabels: Record<WorkspaceView, string> = {
  market: 'Market',
  analytics: 'History',
  backtest: 'Backtest',
  settings: 'Settings',
  audit: 'Audit',
}


export default function App() {
  const deployment = useDeployment()
  const { data, online, now, error, setError, notice, setNotice, working, action } = useDashboard()
  const [brokerDialog, setBrokerDialog] = useState(false)
  const [rulesDialog, setRulesDialog] = useState(false)
  const [selectedDirection, setSelectedDirection] = useState<StrategyDirection | null>(null)
  const [mode, setMode] = useState<Mode>('paper')
  const [liveAck, setLiveAck] = useState(false)
  const [view, setView] = useState<WorkspaceView>(currentView)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const account = useAccount()

  useEffect(() => {
    const update = () => { setView(currentView()); setSidebarOpen(false) }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  function navigate(next: WorkspaceView) {
    setView(next)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.history.replaceState(null, '', `#${next}`)
  }

  const engineSession = data?.session, broker = data?.broker, connected = !!broker?.connected
  const engineLocked = !!engineSession && (['armed', 'preparing', 'running', 'stopping'].includes(engineSession.status) || !!engineSession.pending || Object.values(engineSession.legs).some(leg => !!leg?.position))
  const chosenDirection = engineLocked ? directionOf(engineSession?.settings) : selectedDirection ?? directionOf(engineSession?.settings)
  const selectedSettings = data?.strategyProfiles?.[chosenDirection] ?? (chosenDirection === 'sell' ? SELL_DEFAULT_SETTINGS : data?.savedSettings ?? DEFAULT_SETTINGS)
  const session = engineSession && directionOf(engineSession.settings) === chosenDirection ? engineSession : undefined
  const running = !!session && ['armed', 'preparing', 'running', 'stopping'].includes(session.status)
  const sides: Side[] = ['CE', 'PE']
  const positions = sides.filter(side => !!session?.legs[side]?.position)
  const locked = engineLocked
  const dayLocked = !!session && session.date === new Date(now + 330 * 60_000).toISOString().slice(0, 10) && session.mode === mode
    && (!broker?.account || session.account === broker.account)
  const realized = session?.pnlVerified
    ? Object.values(session.legs).reduce((sum, leg) => sum + leg!.realized, 0)
    : null
  let openPnl: number | null = session ? 0 : null
  for (const side of positions) {
    const leg = session!.legs[side]!, mark = data?.marks[leg.contract.token]
    if (!freshMark(mark, now)) { openPnl = null; break }
    openPnl! += signFor(settingsFor(session)) * (mark.price - leg.position!.average) * leg.position!.quantity
  }
  const total = realized == null || openPnl == null ? null : realized + openPnl
  const identity = `${broker?.account ?? 'disconnected'}:${session?.id ?? 'no-session'}`
  const markFor = (side: Side) => session?.legs[side] ? data?.marks[session.legs[side]!.contract.token] : undefined

  return (
    <div className={`app-shell workspace-shell ${view === 'market' ? 'home-view' : ''}`}>
      <a className="skip-link" href="#workspace-content" onClick={event => { event.preventDefault(); document.getElementById('workspace-content')?.focus() }}>Skip to content</a>
      <WorkspaceSidebar view={view} open={sidebarOpen} onClose={closeSidebar} onNavigate={navigate} onBroker={() => setBrokerDialog(true)} onRules={() => setRulesDialog(true)} onProfile={account ? () => setProfileOpen(true) : undefined} accountName={account?.user?.name} />
      <header className="topbar">
        <div className="navbar-left">
          <a className="navbar-brand" href="#market" onClick={(e) => { e.preventDefault(); navigate('market'); }}>
            <img src="/mavrix-icon.jpg" alt="" width="28" height="28" className="navbar-logo" />
            <div className="navbar-brand-text">
              <span className="brand-name">MAVRIX</span>
              <span className="brand-tag">009 ALGO</span>
            </div>
          </a>
        </div>

        <nav className="navbar-nav" aria-label="Main Navigation">
          {(Object.keys(workspacePages) as WorkspaceView[]).map(key => {
            const Icon = viewIcons[key]
            return (
              <button
                key={key}
                className={`navbar-tab ${view === key ? 'active' : ''}`}
                aria-current={view === key ? 'page' : undefined}
                onClick={() => navigate(key)}
              >
                <Icon size={14} />
                <span>{workspacePages[key].title}</span>
              </button>
            )
          })}
        </nav>

        <div className="topbar-right">
          <button className="broker-button" disabled={!deployment.available} title={!deployment.available ? 'Connect the hosted execution engine first.' : undefined} onClick={() => setBrokerDialog(true)}>
            <Link2 size={14} />
            <span className="broker-btn-label">{connected ? 'mStock connected' : broker?.connection?.phase === 'checking' || broker?.connection?.phase === 'retrying' ? 'Restoring' : broker?.linked ? 'Verify' : 'Connect'}</span>
            {connected && <Check size={13} />}
          </button>
          {account && (
            <button className="nav-profile-btn" aria-label="Open account profile" onClick={() => setProfileOpen(true)} title={account.user?.name ?? 'Profile'}>
              <UserRound size={15} />
              <span className="profile-name">{account.user?.name ? account.user.name.split(' ')[0] : 'Profile'}</span>
            </button>
          )}
        </div>
      </header>

      <main id="workspace-content" tabIndex={-1}>
        {view !== 'audit' && <h1 className="visually-hidden">{workspacePages[view].title}</h1>}
        {view === 'audit' && (
          <div className="page-heading">
            <div className="page-title-group">
              <span className="page-eyebrow">NIFTY 50 / STRATEGY WORKSPACE</span>
              <h1>{workspacePages.audit.title}</h1>
              <p>{workspacePages.audit.description}</p>
            </div>
            <span className={`tag session-badge ${session?.mode === 'live' ? 'live-tag' : ''}`}>
              {!session ? 'NO SESSION' : session.mode === 'live' ? 'LIVE SESSION' : 'PAPER SESSION'}
            </span>
          </div>
        )}
        {!deployment.available ? <section className="deployment-notice" role="status"><div><strong>{deployment.reason === 'setup' ? 'Execution engine not connected' : 'Dashboard connection could not be verified'}</strong><p>You can view the dashboard and strategy rules. Market data, broker connection, backtests and orders are unavailable until the hosted engine is connected.</p></div><button className="button secondary" disabled={deployment.checking} onClick={deployment.retry}>{deployment.checking ? 'Checking…' : 'Check connection'}</button><details><summary>Deployment setup</summary><p>The deployment owner must configure the hosted engine connection and private dashboard access. <a href="https://github.com/satvik8373/Home-Treding/blob/main/VERCEL_DEPLOYMENT.md" target="_blank" rel="noreferrer">Open setup guide</a>.</p></details></section>
          : !online && <div className="notice engine-offline-banner" role="status"><i className="status-dot" /><span>Waiting for the trading engine to reconnect. Market data is paused.</span></div>}
        {error && (
          <div className="notice error" role="alert">
            <span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button>
          </div>
        )}

        {notice && <div className="notice action-notice" role="status"><span><strong>{clock(notice.at, true)} IST</strong> · {notice.message}</span><button aria-label="Dismiss action notification" onClick={() => setNotice(null)}><X size={15} /></button></div>}
        {session?.status === 'blocked' && (
          <div className="session-message attention" role="status">
            <Radio size={14} /><span>{session.message}</span>
            <button className="text-button" disabled={!online || !connected || !!working} onClick={() => void action('/api/strategy/reconcile', {}, 'reconcile')}><RefreshCw size={13} />Reconcile</button>
          </div>
        )}

        <div hidden={view !== 'market'}>
          <div className="fintech-dashboard" aria-label="Strategy controls and session summary">
            {/* Top Row / Section: Hero + Strategy */}
            <div className="dashboard-grid-top">
              <div className="dashboard-strategy-col">
                <StrategyContextBanner
                  settings={locked || dayLocked ? settingsFor(session) : selectedSettings}
                  session={session}
                  locked={locked}
                  working={working}
                  direction={chosenDirection}
                  onDirectionChange={dir => { setSelectedDirection(dir); setLiveAck(false); }}
                  onSettings={() => navigate('settings')}
                  onRules={() => setRulesDialog(true)}
                />
              </div>
              <PortfolioHeroCard
                session={session}
                locked={locked}
                connected={connected}
                online={online}
                working={working}
                now={now}
                mode={mode}
                setMode={setMode}
                liveAck={liveAck}
                setLiveAck={setLiveAck}
                action={action}
                settings={locked || dayLocked ? settingsFor(session) : selectedSettings}
                liveAvailable={data?.runtime?.liveExecution !== false}
                liveReason={data?.runtime?.reason}
                total={total}
                openPnl={openPnl}
                realized={realized}
                positions={positions}
              />


            </div>

            {/* Strategy Positions (Old Perfect Simple & Clean) */}
            <section className="dashboard-positions-section" aria-labelledby="strategy-positions-title">
              <div className="section-heading">
                <h2 id="strategy-positions-title">Strategy positions</h2>
                <button className="text-button" onClick={() => navigate('audit')}>Order lifecycle →</button>
              </div>
              <div className="legs-grid">
                {sides.map(side => (
                  <LegCard
                    key={side}
                    side={side}
                    leg={session?.legs[side]}
                    mark={markFor(side)}
                    now={now}
                    settings={session ? settingsFor(session) : selectedSettings}
                  />
                ))}
              </div>
            </section>

            {/* Middle Row: Official Market Chart */}
            <div className="dashboard-chart-row">
              <MarketChart
                connected={connected}
                identity={identity}
                now={now}
                marks={data?.marks ?? {}}
                legs={session?.legs ?? {}}
                trades={session?.trades ?? []}
                settings={session ? settingsFor(session) : selectedSettings}
              />
            </div>

            {/* Session Orders & Executed Trades (Old Perfect Simple & Clean) */}
            <section className="dashboard-orders-section" aria-label="Session orders and trades">
              <OrdersPanel session={session} />
              <TradesPanel session={session} title="Executed trades" exportAvailable={!!session} trades={session?.trades ?? []} />
              <details className="panel activity-panel">
                <summary>Session activity <span>{session?.activity.length ?? 0} events</span></summary>
                {session?.activity.length ? (
                  <ol className="activity-list">{[...session.activity].reverse().slice(0, 40).map((entry, index) => (
                    <li key={`${entry.at}-${index}`}><time>{clock(entry.at, true)}</time><p className={entry.level === 'error' ? 'negative-text' : ''}>{entry.message}</p></li>
                  ))}</ol>
                ) : <p className="trade-empty">Activity appears after the strategy starts.</p>}
              </details>
            </section>
          </div>
        </div>

        <div hidden={view !== 'backtest'}>
          <BacktestPanel visible={view === 'backtest'} now={now} connected={connected} online={online} working={working} action={action} settings={selectedSettings} />
        </div>
        <div hidden={view !== 'settings'}><StrategySettingsPanel key={chosenDirection} saved={selectedSettings} effective={session ? settingsFor(session) : selectedSettings} active={running} hasSession={!!session} online={online} working={working} action={action} /></div>
        <div hidden={view !== 'audit'}><TransparencyPanel data={data} visible={view === 'audit'} now={now} online={online} /></div>
        {view === 'analytics' && <AnalyticsPanel initialMode={engineSession?.mode ?? mode} online={online} />}
        <footer className="page-footer">
          <span>MAVRIX / 009 · {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }).format(now)}</span>
          <a href="https://tradingapi.mstock.com/docs/v1/Introduction/" target="_blank" rel="noreferrer">Official mStock API</a>
        </footer>
      </main>
      <AccountProfile open={profileOpen} onOpenChange={setProfileOpen} hideTrigger broker={broker} persistence={data?.persistence} onBroker={() => setBrokerDialog(true)} onSettings={() => navigate('settings')} />
      {brokerDialog && <BrokerDialog broker={broker} locked={locked} online={online} working={working} error={error} action={action} onClose={() => setBrokerDialog(false)} />}
      {rulesDialog && <RulesDialog settings={locked || dayLocked ? settingsFor(session) : selectedSettings} onClose={() => setRulesDialog(false)} />}

      {/* Mobile App Bottom Tab Bar (Apple/Fintech Dock) */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
        {(Object.keys(workspacePages) as WorkspaceView[]).map(key => {
          const Icon = viewIcons[key]
          return (
            <button
              key={key}
              className={`mobile-tab-item ${view === key ? 'active' : ''}`}
              aria-current={view === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <div className="tab-icon-wrap"><Icon size={18} /></div>
              <span className="tab-label">{mobileTabLabels[key]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
