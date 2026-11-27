import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortfolioHeroCard } from '../src/components/PortfolioHeroCard'
import { HomeLogsPanel } from '../src/components/HomeLogsPanel'
import { LegCard } from '../src/components/LegCard'
import { OrdersPanel } from '../src/components/OrdersPanel'
import { TradesPanel } from '../src/components/TradesPanel'
import { DEFAULT_SETTINGS } from '../shared/settings'
import type { TradingSession, OrderAudit, Trade } from '../shared/model'

const now = Date.UTC(2026, 10, 13, 4, 30)
const base = { locked: false, connected: true, online: true, working: '', now, mode: 'paper' as const, setMode() {}, liveAck: false, setLiveAck() {}, action: async () => {}, settings: DEFAULT_SETTINGS }
const session = (status: TradingSession['status']) => ({ id: 'ui-test', date: '2026-11-13', status, mode: 'paper', message: 'Waiting for the reference candle.', pnlVerified: false, trades: [], legs: {}, pending: null, activity: [], account: 'test', atm: null, expiry: null }) as TradingSession
const renderHero = (changes = {}) => renderToStaticMarkup(createElement(PortfolioHeroCard, { ...base, ...changes }))

test('armed and preparing sessions retain accurate status labels', () => {
  assert.match(renderHero({ session: session('armed'), locked: true }), />Armed</)
  assert.match(renderHero({ session: session('preparing'), locked: true }), />Loading reference</)
})
test('unavailable Live cannot start even with prior acknowledgement', () => {
  const html = renderHero({ mode: 'live', liveAck: true, liveAvailable: false })
  assert.match(html, /<button class="hero-action-btn btn-primary" disabled=""[\s\S]*?Start Strategy/)
})
test('offline and outside-window states explain why Start is unavailable', () => {
  assert.match(renderHero({ online: false }), /Waiting for the engine connection/)
  assert.match(renderHero({ now: Date.UTC(2026, 10, 14, 4, 30) }), /Start window: weekdays/)
})
test('hero labels gross P&L and never labels it net', () => {
  const html = renderHero({ total: 100, session: session('stopped') })
  assert.match(html, /Gross · before charges/)
  assert.doesNotMatch(html, /Net Session P&amp;L/)
})
test('pending and rejected orders retain quantities, reasons and broker details', () => {
  const order: OrderAudit = { id: 'order', tag: 'tag', side: 'CE', symbol: 'TEST', transaction: 'BUY', quantity: 65, reason: 'BREAKOUT', submittedAt: now, updatedAt: now, mode: 'live', status: 'rejected', filled: 0, average: null, detail: 'Broker rejected this request.' }
  const html = renderToStaticMarkup(createElement(OrdersPanel, { session: { ...session('blocked'), pending: order, orderAudit: [order] } }))
  assert.match(html, /0 \/ —/)
  assert.match(html, /Broker rejected this request/)
  assert.match(html, /Filled \/ average/)
  assert.doesNotMatch(html, /Awaiting Confirmation/)
})
test('unknown exit P&L remains unknown in the original table', () => {
  const trade: Trade = { id: 'fill', at: now, side: 'CE', symbol: 'TEST', transaction: 'SELL', quantity: 65, price: 100, reason: 'LOWER_CLOSE', orderId: 'test', mode: 'live', pnl: null }
  assert.doesNotMatch(renderToStaticMarkup(createElement(TradesPanel, { trades: [trade] })), /Entry/)
})
test('trade records render semantic tables with full quantities, timestamps and premium amounts', () => {
  const trade: Trade = { id: 'table-fill', at: now, side: 'PE', symbol: 'TEST-CONTRACT', transaction: 'BUY', quantity: 65, price: 100, reason: 'BREAKOUT', orderId: 'simulated', mode: 'paper', pnl: null }
  const html = renderToStaticMarkup(createElement(TradesPanel, { trades: [trade], exportAvailable: true }))
  assert.match(html, /<table/)
  assert.match(html, /Date \/ time IST/)
  assert.match(html, /Action/); assert.match(html, /13 Nov 2026/); assert.match(html, /10:00:00/)
  assert.match(html, /Premium amount/)
  assert.match(html, /6,500.00/)
  assert.doesNotMatch(html, /aria-haspopup="dialog"/)
  assert.match(html, /\/api\/trades.csv/)
})

test('hero removes inline logs while bottom HomeLogsPanel shows all engine activity, orders, trades, decisions and errors', () => {
  const s = {
    ...session('blocked'),
    message: 'Broker check blocked execution.',
    pnlVerified: false,
    activity: [
      { at: now - 2000, level: 'info' as const, message: 'Reference candles locked.' },
      { at: now - 1000, level: 'error' as const, message: 'CE quantity mismatch detected.' },
    ],
    orderAudit: [
      { id: 'o1', tag: 't1', orderId: 'ORD-1', side: 'CE' as const, symbol: 'NIFTY-CE', transaction: 'BUY' as const, quantity: 65, reason: 'BREAKOUT' as const, submittedAt: now - 1500, updatedAt: now - 1400, mode: 'live' as const, status: 'rejected' as const, filled: 0, average: null, detail: 'RMS margin shortfall.' },
    ],
    trades: [
      { id: 'tr1', at: now - 3000, side: 'PE' as const, symbol: 'NIFTY-PE', transaction: 'SELL' as const, quantity: 65, price: 120, reason: 'TARGET_1' as const, orderId: 'ORD-0', mode: 'live' as const, pnl: 1300 },
    ],
    decisionAudit: [
      { side: 'CE' as const, candle: { start: now - 300_000, end: now, open: 100, high: 104, low: 98, close: 102 }, evaluatedAt: now - 500, signal: 'BREAKOUT' as const, explanation: 'Completed close reached breakout level.' },
    ],
  }
  const heroHtml = renderHero({ session: s })
  assert.doesNotMatch(heroHtml, /hero-session-message-inline/)

  const logsHtml = renderToStaticMarkup(createElement(HomeLogsPanel, {
    session: s,
    broker: { connected: false, account: null, name: null, expiresAt: null, feed: 'disconnected', feedError: 'WebSocket HTTP 502', lastTickAt: null },
    online: true,
    deploymentAvailable: true,
    now,
    working: '',
    connected: false,
    error: 'Action request failed.',
    onDismissError() {},
    notice: { message: 'Square-off queued.', at: now },
    onDismissNotice() {},
    runtimeLogs: [{ id: 'ui-1', at: now, level: 'error', source: 'ui', title: 'Action error', message: 'Action request failed.' }],
    onClearRuntimeLogs() {},
    onReconcile() {},
  }))
  assert.match(logsHtml, /panel activity-panel home-activity-logs/)
  assert.match(logsHtml, /activity-list home-activity-list/)
  assert.match(logsHtml, /System Logs &amp; Errors/)
  assert.match(logsHtml, /Action request failed/)
  assert.match(logsHtml, /WebSocket HTTP 502/)
  assert.match(logsHtml, /Broker check blocked execution/)
  assert.match(logsHtml, /CE quantity mismatch detected/)
  assert.match(logsHtml, /RMS margin shortfall/)
  assert.match(logsHtml, /Completed close reached breakout level/)
  assert.match(logsHtml, /Reconcile/)

  const ceHtml = renderToStaticMarkup(createElement(LegCard, { side: 'CE', now, settings: DEFAULT_SETTINGS }))
  const peHtml = renderToStaticMarkup(createElement(LegCard, { side: 'PE', now, settings: DEFAULT_SETTINGS }))
  assert.match(ceHtml, /tile tile--wide leg-card/)
  assert.match(ceHtml, /CALL/)
  assert.match(ceHtml, /Target 1/)
  assert.match(peHtml, /PUT/)
  assert.match(peHtml, /Target 2/)
})
