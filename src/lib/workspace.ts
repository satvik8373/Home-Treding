export const workspacePages = {
  market: { title: 'Market overview', description: 'Your session, market and execution controls.' },
  positions: { title: 'Positions & orders', description: 'Locked references, confirmed fills and session activity.' },
  analytics: { title: 'History & analytics', description: 'Daily, weekly and monthly performance from recorded sessions.' },
  backtest: { title: 'Backtest', description: 'Replay your strategy against available historical candles.' },
  settings: { title: 'Strategy settings', description: 'Manage entry size, target exits and session protection.' },
  audit: { title: 'Money & audit', description: 'Trace session amounts, broker checks and order decisions.' },
} as const
export type WorkspaceView = keyof typeof workspacePages
export function currentView(): WorkspaceView {
  const hash = window.location.hash.slice(1)
  return Object.hasOwn(workspacePages, hash) ? hash as WorkspaceView : 'market'
}
