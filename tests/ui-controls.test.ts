import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortfolioHeroCard } from '../src/components/PortfolioHeroCard'
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
