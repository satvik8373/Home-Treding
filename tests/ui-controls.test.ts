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
  assert.match(html, /Filled 0 \/ 65/)
  assert.match(html, /Broker rejected this request/)
  assert.match(html, /Fill price unavailable/)
  assert.doesNotMatch(html, /Awaiting Confirmation/)
})
test('unverified exit P&L is not presented as an entry', () => {
  const trade: Trade = { id: 'fill', at: now, side: 'CE', symbol: 'TEST', transaction: 'SELL', quantity: 65, price: 100, reason: 'LOWER_CLOSE', orderId: 'test', mode: 'live', pnl: null }
  assert.match(renderToStaticMarkup(createElement(TradesPanel, { trades: [trade] })), /P&amp;L unverified/)
})
