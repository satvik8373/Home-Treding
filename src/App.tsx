import { BrandLogo } from './components/BrandLogo'
import { directionOf, positionPnl } from '../shared/strategy'
import type { StrategyDirection } from '../shared/strategy'
import './components/StrategySettingsPanel.css'
import { StrategySettingsPanel } from './components/StrategySettingsPanel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutGrid,
  ArrowLeftRight,
  Wallet,
  FileText,
  BellRing,
  SlidersHorizontal,
  Radio,
  RefreshCw,
  X,
  AlertTriangle,
  Info,
  Calendar,
  History,
  Clock,
} from 'lucide-react'
import type { ChartSymbol, Mode, Side, OrderAudit, Trade } from '../shared/model'
import { HomeLogsPanel, type ClientRuntimeLog } from './components/HomeLogsPanel'
import { freshMark } from '../shared/market'
import { BrokerDialog } from './components/BrokerDialog'
import { AccountProfile } from './components/AccountProfile'
import { MarketChart } from './components/MarketChart'
import { RulesDialog } from './components/RulesDialog'
import { PortfolioHeroCard } from './components/PortfolioHeroCard'
import { StrategyTopBar } from './components/StrategyTopBar'
import { UnifiedOptionsCockpit } from './components/UnifiedOptionsCockpit'
import { SeparateOptionsDeck } from './components/SeparateOptionsDeck'
import { SplitOptionPairCard } from './components/SplitOptionPairCard'
import { LegCard } from './components/LegCard'
import { RealInstrumentsList } from './components/RealInstrumentsList'
import { OrdersPanel } from './components/OrdersPanel'
import { TradesPanel } from './components/TradesPanel'
import { clock } from './lib/format'
import { BacktestPanel } from './components/BacktestPanel'
import { TransparencyPanel } from './components/TransparencyPanel'
import { AnalyticsPanel } from './components/AnalyticsPanel'
import { DEFAULT_SETTINGS, SELL_DEFAULT_SETTINGS, BOTH_DEFAULT_SETTINGS, settingsFor } from '../shared/settings'
import { useDashboard } from './hooks/useDashboard'
import { useDeployment } from './lib/deployment'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { currentView, workspacePages, type WorkspaceView } from './lib/workspace'
import { useAccount } from './lib/account'
import { LiveScoreModal } from './components/LiveScoreModal'
import { updateFloatingLiveScore, type LiveScoreData } from './lib/liveScore'
import { NeoHeader } from './components/NeoHeader'

const viewIcons: Record<WorkspaceView, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  market: LayoutGrid,
  explore: ArrowLeftRight,
  analytics: Wallet,
  backtest: FileText,
  audit: BellRing,
  settings: SlidersHorizontal,
}

const mobileTabLabels: Record<WorkspaceView, string> = {
  market: 'Home',
  explore: 'Orders',
  analytics: 'Analytics',
  backtest: 'Backtest',
  audit: 'Alerts',
  settings: 'Settings',
}

const navDockTabs: WorkspaceView[] = ['market', 'explore', 'analytics', 'backtest', 'settings']

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
  const [liveScoreOpen, setLiveScoreOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const account = useAccount()

  const [historyScope, setHistoryScope] = useState<'today' | 'history'>('today')
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState<string>('all')
  const [historyData, setHistoryData] = useState<{
    sessions: { id: string; date: string; mode: string; status: string; tradesCount: number; ordersCount: number }[]
    trades: Trade[]
    orders: OrderAudit[]
    activeSessionId: string | null
  } | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [runtimeLogs, setRuntimeLogs] = useState<ClientRuntimeLog[]>([])
  const logSeqRef = useRef(0)
  const lastLogKeysRef = useRef({
    error: '',
    noticeAt: 0,
    brokerKey: '',
    feedError: '',
    chartKey: '',
    offlineKey: '',
  })

  const appendRuntimeLog = useCallback(
    (entry: Omit<ClientRuntimeLog, 'id'>) => {
      const id = `${entry.at}-${++logSeqRef.current}`
      setRuntimeLogs(prev => [{ ...entry, id }, ...prev].slice(0, 120))
    },
    [],
  )

  useEffect(() => {
    if (view !== 'explore' || historyScope !== 'history') return
    const controller = new AbortController()
    setHistoryLoading(true)
    setHistoryError('')
    const query = new URLSearchParams({ mode })
    if (selectedHistorySessionId !== 'all') {
      query.set('sessionId', selectedHistorySessionId)
    }
    void fetch(`/api/history/orders-trades?${query.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error('Could not load historical orders and trades.')
        return res.json()
      })
      .then(payload => {
        if (!controller.signal.aborted) {
          setHistoryData(payload)
          setHistoryLoading(false)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setHistoryError(err instanceof Error ? err.message : 'Failed to fetch history.')
          setHistoryLoading(false)
        }
      })
    return () => controller.abort()
  }, [view, historyScope, selectedHistorySessionId, mode])

  useEffect(() => {
    const update = () => {
      setView(currentView())
      setSidebarOpen(false)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  function navigate(next: WorkspaceView) {
    setView(next)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.history.replaceState(null, '', `#${next}`)
  }

  const engineSession = data?.session,
    broker = data?.broker,
    connected = !!broker?.connected
  const engineLocked =
    !!engineSession &&
    (['armed', 'preparing', 'running', 'stopping'].includes(engineSession.status) ||
      !!engineSession.pending ||
      Object.values(engineSession.legs).some((leg) => !!leg?.position))
  const chosenDirection = engineLocked
    ? directionOf(engineSession?.settings)
    : selectedDirection ?? directionOf(engineSession?.settings)
  const selectedSettings =
    data?.strategyProfiles?.[chosenDirection] ??
    (chosenDirection === 'sell'
      ? SELL_DEFAULT_SETTINGS
      : chosenDirection === 'both'
        ? BOTH_DEFAULT_SETTINGS
        : data?.savedSettings ?? DEFAULT_SETTINGS)
  const session =
    engineSession && directionOf(engineSession.settings) === chosenDirection ? engineSession : undefined
  const running = !!session && ['armed', 'preparing', 'running', 'stopping'].includes(session.status)
  const sides: Side[] = ['CE', 'PE']
  const positions = sides.filter((side) => !!session?.legs[side]?.position)
  const locked = engineLocked
  const dayLocked =
    !!session &&
    session.date === new Date(now + 330 * 60_000).toISOString().slice(0, 10) &&
    session.mode === mode &&
    (!broker?.account || session.account === broker.account)
  const realized = session?.pnlVerified
    ? Object.values(session.legs).reduce((sum, leg) => sum + leg!.realized, 0)
    : null
  const openPnl: number | null = (() => {
    if (!session) return null
    const settings = settingsFor(session)
    let sum = 0
    for (const leg of Object.values(session.legs)) {
      if (!leg?.position) continue
      const mark = data?.marks[leg.contract.token]
      if (!freshMark(mark, now)) return null
      sum += positionPnl(leg.position, mark.price, settings)
    }
    return sum
  })()
  const total = realized == null || openPnl == null ? null : realized + openPnl
  const identity = `${broker?.account ?? 'disconnected'}:${session?.id ?? 'no-session'}`

  const spotPrice = data?.marks?.['26000']?.price ?? null
  const ceLeg = session?.legs?.CE
  const peLeg = session?.legs?.PE
  const ceMark = ceLeg ? data?.marks?.[ceLeg.contract.token] : undefined
  const peMark = peLeg ? data?.marks?.[peLeg.contract.token] : undefined
  const markFor = (side: Side) =>
    session?.legs[side] ? data?.marks[session.legs[side]!.contract.token] : undefined

  const liveScoreData: LiveScoreData = useMemo(
    () => ({
      running,
      status: session?.status ?? 'idle',
      mode,
      total,
      openPnl,
      realized,
      spotPrice,
      atm: session?.atm ?? null,
      ceStrike: ceLeg?.contract?.strike ?? null,
      cePrice: ceMark?.price ?? null,
      ceStatus: ceLeg?.position ? 'Active' : 'Watching',
      peStrike: peLeg?.contract?.strike ?? null,
      pePrice: peMark?.price ?? null,
      peStatus: peLeg?.position ? 'Active' : 'Watching',
      updatedAt: 0,
    }),
    [running, session?.status, session?.atm, mode, total, openPnl, realized, spotPrice, ceLeg, peLeg, ceMark?.price, peMark?.price]
  )

  useEffect(() => {
    updateFloatingLiveScore(liveScoreData)
  }, [liveScoreData])

  useEffect(() => {
    if (error && lastLogKeysRef.current.error !== error) {
      lastLogKeysRef.current.error = error
      appendRuntimeLog({ at: now, level: 'error', source: 'ui', title: 'Action error', message: error })
    } else if (!error) {
      lastLogKeysRef.current.error = ''
    }
  }, [error, now, appendRuntimeLog])

  useEffect(() => {
    if (notice && lastLogKeysRef.current.noticeAt !== notice.at) {
      lastLogKeysRef.current.noticeAt = notice.at
      appendRuntimeLog({ at: notice.at, level: 'info', source: 'ui', title: 'Action submitted', message: notice.message })
    }
  }, [notice, appendRuntimeLog])

  const brokerPhase = broker?.connection?.phase ?? ''
  const brokerMessage = broker?.connection?.message ?? ''
  const brokerFeedError = broker?.feedError ?? ''

  useEffect(() => {
    if (brokerPhase && ['rejected', 'expired', 'retrying'].includes(brokerPhase)) {
      const key = `${brokerPhase}:${brokerMessage}`
      if (lastLogKeysRef.current.brokerKey !== key) {
        lastLogKeysRef.current.brokerKey = key
        appendRuntimeLog({
          at: broker?.connection?.checkedAt ?? now,
          level: brokerPhase === 'retrying' ? 'warn' : 'error',
          source: 'broker',
          title: `Broker ${brokerPhase}`,
          message: brokerMessage,
        })
      }
    } else {
      lastLogKeysRef.current.brokerKey = ''
    }
  }, [brokerPhase, brokerMessage, broker?.connection?.checkedAt, now, appendRuntimeLog])

  useEffect(() => {
    if (brokerFeedError && lastLogKeysRef.current.feedError !== brokerFeedError) {
      lastLogKeysRef.current.feedError = brokerFeedError
      appendRuntimeLog({ at: now, level: 'error', source: 'broker', title: 'WebSocket feed error', message: brokerFeedError })
    } else if (!brokerFeedError) {
      lastLogKeysRef.current.feedError = ''
    }
  }, [brokerFeedError, now, appendRuntimeLog])

  useEffect(() => {
    const offlineKey = !deployment.available
      ? `deploy:${deployment.reason ?? 'unknown'}`
      : !online
        ? 'engine:offline'
        : ''
    if (offlineKey && lastLogKeysRef.current.offlineKey !== offlineKey) {
      lastLogKeysRef.current.offlineKey = offlineKey
      appendRuntimeLog({
        at: now,
        level: 'error',
        source: 'network',
        title: !deployment.available ? 'Engine disconnected' : 'Engine offline',
        message: !deployment.available
          ? 'Execution engine connection could not be verified.'
          : 'Waiting for trading engine to reconnect.',
      })
    } else if (!offlineKey) {
      lastLogKeysRef.current.offlineKey = ''
    }
  }, [deployment.available, deployment.reason, online, now, appendRuntimeLog])

  const handleChartDiagnostic = useCallback(
    (issue: { symbol: ChartSymbol; level: 'error' | 'warn'; message: string } | null) => {
      if (!issue) {
        lastLogKeysRef.current.chartKey = ''
        return
      }
      const key = `${issue.symbol}:${issue.level}:${issue.message}`
      if (lastLogKeysRef.current.chartKey === key) return
      lastLogKeysRef.current.chartKey = key
      appendRuntimeLog({
        at: now,
        level: issue.level,
        source: 'chart',
        title: `${issue.symbol} chart ${issue.level === 'error' ? 'error' : 'warning'}`,
        message: issue.message,
      })
    },
    [now, appendRuntimeLog],
  )

  return (
    <div className={`app-shell workspace-shell light-theme ${view === 'market' ? 'home-view' : view === 'analytics' ? 'history-view' : ''}`}>
      <a
        className="skip-link"
        href="#workspace-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('workspace-content')?.focus()
        }}
      >
        Skip to content
      </a>

      <WorkspaceSidebar
        view={view}
        open={sidebarOpen}
        onClose={closeSidebar}
        onNavigate={navigate}
        onBroker={() => setBrokerDialog(true)}
        onRules={() => setRulesDialog(true)}
        onProfile={account ? () => setProfileOpen(true) : undefined}
        accountName={account?.user?.name}
      />

      <main id="workspace-content" tabIndex={-1}>
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

        {/* Stable Non-Fluctuating Notification Tray (non-Home tabs; Home consolidates all logs & errors at bottom) */}
        {view !== 'market' && (
          <div className="neo-notification-tray" aria-live="polite">
            {!deployment.available ? (
              <section className="deployment-notice stable-notice" role="status">
                <div>
                  <strong>
                    {deployment.reason === 'setup'
                      ? 'Execution engine not connected'
                      : 'Dashboard connection could not be verified'}
                  </strong>
                  <p>
                    You can view the dashboard and strategy rules. Market data, broker connection, backtests and orders are
                    unavailable until the hosted engine is connected.
                  </p>
                </div>
                <button className="button secondary" disabled={deployment.checking} onClick={deployment.retry}>
                  {deployment.checking ? 'Checking…' : 'Check connection'}
                </button>
              </section>
            ) : (
              !online && (
                <div className="notice engine-offline-banner stable-notice" role="status">
                  <i className="status-dot" />
                  <span>Waiting for the trading engine to reconnect. Market data is paused.</span>
                </div>
              )
            )}

            {error && (
              <div className="notice error stable-notice" role="alert">
                <span>{error}</span>
                <button aria-label="Dismiss error" onClick={() => setError('')}>
                  <X size={15} />
                </button>
              </div>
            )}

            {notice && (
              <div className="notice action-notice stable-notice" role="status">
                <span>
                  <strong>{clock(notice.at, true)} IST</strong> · {notice.message}
                </span>
                <button aria-label="Dismiss action notification" onClick={() => setNotice(null)}>
                  <X size={15} />
                </button>
              </div>
            )}

            {session?.status === 'blocked' && (
              <div className="session-message attention stable-notice" role="status">
                <Radio size={14} />
                <span>{session.message}</span>
                <button
                  className="text-button"
                  disabled={!online || !connected || !!working}
                  onClick={() => void action('/api/strategy/reconcile', {}, 'reconcile')}
                >
                  <RefreshCw size={13} />
                  Reconcile
                </button>
              </div>
            )}
          </div>
        )}

        {/* 1. Market (Main View: Pure, Minimal, Light Aesthetic Matching Image 1) */}
        <div hidden={view !== 'market'}>
          {/* Top Full-Width Terminal Header (Mavrix Trading Brand + Broker + Profile - Edge to Edge) */}
          <NeoHeader
            connected={connected}
            deploymentAvailable={deployment.available}
            brokerPhase={broker?.connection?.phase}
            brokerLinked={!!broker?.linked}
            onBroker={() => setBrokerDialog(true)}
            onProfile={account ? () => setProfileOpen(true) : undefined}
          />

          <div className="fintech-dashboard neo-mobile-canvas" aria-label="Strategy controls and session summary">
            {/* Top Strategy Direction Buttons & Focus Parameters Strip ("stretegy need to top buttons and focus") */}
            <StrategyTopBar
              settings={locked || dayLocked ? settingsFor(session) : selectedSettings}
              session={session}
              locked={locked}
              working={working}
              direction={chosenDirection}
              onDirectionChange={(dir) => {
                setSelectedDirection(dir)
                setLiveAck(false)
              }}
              onRules={() => setRulesDialog(true)}
            />

            {/* Primary Portfolio Hero Balance */}
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

            {/* Single Unified Container with Divided Minimal Parts for CALL & PUT */}
            <UnifiedOptionsCockpit
              session={session}
              marks={data?.marks ?? {}}
              now={now}
              settings={session ? settingsFor(session) : selectedSettings}
            />

            {/* Official Market Spline Curve Chart */}
            <div className="dashboard-chart-row">
              <MarketChart
                connected={connected}
                identity={identity}
                now={now}
                marks={data?.marks ?? {}}
                legs={session?.legs ?? {}}
                trades={session?.trades ?? []}
                settings={session ? settingsFor(session) : selectedSettings}
                onDiagnostic={handleChartDiagnostic}
              />
            </div>

            {/* Consolidated Full Logs & Errors Feed (Bottom Last on Home) */}
            <HomeLogsPanel
              session={session}
              broker={broker}
              runtime={data?.runtime}
              online={online}
              deploymentAvailable={deployment.available}
              deploymentReason={deployment.reason}
              now={now}
              working={working}
              connected={connected}
              error={error}
              onDismissError={() => setError('')}
              notice={notice}
              onDismissNotice={() => setNotice(null)}
              runtimeLogs={runtimeLogs}
              onClearRuntimeLogs={() => setRuntimeLogs([])}
              onReconcile={() => void action('/api/strategy/reconcile', {}, 'reconcile')}
            />
          </div>
        </div>

        {/* 2. Trades & Orders Execution History View (Trades First, Full Area Fit) */}
        <div hidden={view !== 'explore'}>
          <div className="neo-mobile-canvas neo-table-canvas">
            <div className="view-sub-header">
              <div className="orders-header-row">
                <div className="orders-header-text">
                  <h2>Trades & Orders Execution</h2>
                  <p>
                    {historyScope === 'today'
                      ? "Real-time fill confirmation log and broker order audit trail for today's active session."
                      : selectedHistorySessionId === 'all'
                        ? `Historical execution record across ${historyData?.sessions.length ?? 0} previous recorded sessions.`
                        : `Historical execution record for session ${historyData?.sessions.find(s => s.id === selectedHistorySessionId)?.date ?? selectedHistorySessionId}.`}
                  </p>
                </div>

                {/* Scope Switcher: Today's Session vs Previous All Data */}
                <div className="orders-scope-toggle-group" role="tablist" aria-label="Orders history view scope">
                  <button
                    type="button"
                    className={`orders-scope-btn ${historyScope === 'today' ? 'active' : ''}`}
                    onClick={() => {
                      setHistoryScope('today')
                      setSelectedHistorySessionId('all')
                    }}
                  >
                    <Calendar size={13} />
                    <span>Today's Session</span>
                    <span className="orders-scope-badge">
                      {(session?.trades?.length ?? 0) + (session?.orderAudit?.length ?? 0)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`orders-scope-btn ${historyScope === 'history' ? 'active' : ''}`}
                    onClick={() => setHistoryScope('history')}
                  >
                    <History size={13} />
                    <span>Previous All Data</span>
                    {historyData && (
                      <span className="orders-scope-badge">
                        {historyData.trades.length + historyData.orders.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Previous History Filter Bar */}
              {historyScope === 'history' && (
                <div className="orders-history-bar">
                  <div className="orders-history-filter-item">
                    <label htmlFor="history-session-dropdown" className="orders-history-lbl">
                      <Clock size={12} />
                      <span>Filter by Past Session:</span>
                    </label>
                    <select
                      id="history-session-dropdown"
                      className="orders-history-select"
                      value={selectedHistorySessionId}
                      onChange={(e) => setSelectedHistorySessionId(e.target.value)}
                    >
                      <option value="all">
                        All Previous Sessions ({historyData?.sessions.length ?? 0} dates)
                      </option>
                      {historyData?.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.date} · {s.mode.toUpperCase()} ({s.tradesCount} trades, {s.ordersCount} orders)
                        </option>
                      ))}
                    </select>
                  </div>

                  {historyLoading && <span className="history-loader-badge">Loading previous data…</span>}
                  {historyError && <span className="history-error-badge">{historyError}</span>}
                </div>
              )}
            </div>

            {/* Trades First */}
            <TradesPanel
              exportAvailable={historyScope === 'today' ? !!session : (historyData?.trades.length ?? 0) > 0}
              trades={historyScope === 'today' ? (session?.trades ?? []) : (historyData?.trades ?? [])}
              titleSuffix={historyScope === 'history' ? (selectedHistorySessionId === 'all' ? 'All Previous History' : historyData?.sessions.find(s => s.id === selectedHistorySessionId)?.date) : undefined}
            />

            {/* Orders Second */}
            <div style={{ marginTop: '2rem' }}>
              <OrdersPanel
                session={historyScope === 'today' ? session : undefined}
                customOrders={historyScope === 'history' ? (historyData?.orders ?? []) : undefined}
                titleSuffix={historyScope === 'history' ? (selectedHistorySessionId === 'all' ? 'All Previous History' : historyData?.sessions.find(s => s.id === selectedHistorySessionId)?.date) : undefined}
              />
            </div>
          </div>
        </div>

        {/* 3. Settings View */}
        <div hidden={view !== 'settings'}>
          <div className="neo-mobile-canvas">
            <StrategySettingsPanel
              key={chosenDirection}
              saved={selectedSettings}
              effective={session ? settingsFor(session) : selectedSettings}
              active={running}
              hasSession={!!session}
              online={online}
              working={working}
              action={action}
            />
          </div>
        </div>

        {/* 4. Backtest View */}
        <div hidden={view !== 'backtest'}>
          <BacktestPanel
            visible={view === 'backtest'}
            now={now}
            connected={connected}
            online={online}
            working={working}
            action={action}
            settings={selectedSettings}
          />
        </div>

        {/* 5. Audit Transparency View */}
        <div hidden={view !== 'audit'}>
          <TransparencyPanel data={data} visible={view === 'audit'} now={now} online={online} />
        </div>

        {/* 6. Analytics View */}
        {view === 'analytics' && (
          <AnalyticsPanel
            key={engineSession?.mode ?? mode}
            initialMode={engineSession?.mode ?? mode}
            online={online}
          />
        )}

        <footer className="page-footer neo-page-footer">
          <span>
            MAVRIX / 009 ·{' '}
            {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }).format(now)}
          </span>
          <a href="https://tradingapi.mstock.com/docs/v1/Introduction/" target="_blank" rel="noreferrer">
            Official mStock API
          </a>
        </footer>
      </main>

      <AccountProfile
        open={profileOpen}
        onOpenChange={setProfileOpen}
        hideTrigger
        broker={broker}
        persistence={data?.persistence}
        onBroker={() => setBrokerDialog(true)}
        onSettings={() => navigate('settings')}
      />

      {brokerDialog && (
        <BrokerDialog
          broker={broker}
          locked={locked}
          online={online}
          working={working}
          error={error}
          action={action}
          onClose={() => setBrokerDialog(false)}
        />
      )}

      {rulesDialog && (
        <RulesDialog
          settings={locked || dayLocked ? settingsFor(session) : selectedSettings}
          onClose={() => setRulesDialog(false)}
        />
      )}

      <LiveScoreModal
        open={liveScoreOpen}
        onClose={() => setLiveScoreOpen(false)}
        data={liveScoreData}
        onSquareOff={() => void action('/api/strategy/stop', {}, 'stop')}
      />

      {/* Docked Fintech Bottom Bar (Touched Bottom, Top-Rounded, Matches Reference) */}
      <nav className="mobile-bottom-bar neo-mobile-bar" aria-label="Navigation">
        <div className="neo-mobile-bar-inner">
          {navDockTabs.map((key) => {
            const Icon = viewIcons[key]
            const isActive = view === key
            return (
              <button
                key={key}
                className={`mobile-tab-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(key)}
              >
                <div className="tab-icon-wrap">
                  <Icon size={20} strokeWidth={isActive ? 2.3 : 1.9} />
                </div>
                <span className="tab-label">{mobileTabLabels[key]}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
