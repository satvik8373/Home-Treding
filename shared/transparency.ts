import { signFor, directionOf, entryLevel } from './strategy.ts'
import type { Mark, TradingSession } from './model.ts'
import { settingsFor } from './settings.ts'
import { freshMark } from './market.ts'
import type { Side } from './model.ts'

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export function sessionMoney(session: TradingSession | null, marks: Record<string, Mark>, now: number) {
  if (!session) return null
  const trades = session.trades.filter(trade => trade.mode === session.mode)
  const buys = round(trades.filter(t => t.transaction === 'BUY').reduce((sum, t) => sum + t.quantity * t.price, 0))
  const sells = round(trades.filter(t => t.transaction === 'SELL').reduce((sum, t) => sum + t.quantity * t.price, 0))
  let value: number | null = 0, cost = 0
  for (const leg of Object.values(session.legs)) if (leg?.position) {
    cost += leg.position.average * leg.position.quantity
    const mark = marks[leg.contract.token]
    if (!freshMark(mark, now)) value = null
    else if (value != null) value += mark.price * leg.position.quantity
  }
  const grossRealized = session.pnlVerified ? round(trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)) : null
  const openPnl = value == null ? null : round(signFor(settingsFor(session)) * (value - cost))
  const grossMarked = grossRealized == null || openPnl == null ? null : round(grossRealized + openPnl)
  const estimate = round(settingsFor(session).feePerOrderEstimate * trades.length)
  return { mode: session.mode, buyPremiums: buys, sellProceeds: sells, premiumCashflow: round(sells - buys), openCost: round(cost),
    openMarketValue: value == null ? null : round(value), grossRealized, openPnl, grossMarked, estimatedCosts: estimate,
    estimatedNet: grossMarked == null ? null : round(grossMarked - estimate), actualBrokerCharges: null, actualNetAfterCharges: null,
    paperRealDebit: session.mode === 'paper' ? 0 : null, fillCount: trades.length }
}

export function explainLeg(session: TradingSession | null, side: Side, marks: Record<string, Mark>, now: number) {
  const settings = settingsFor(session), leg = session?.legs[side], mark = leg ? marks[leg.contract.token] : undefined
  const fresh = freshMark(mark, now), enabled = settings.enabledSides.includes(side)
  const cutoff = session ? Date.parse(`${session.date}T${settings.cutoff}:00+05:30`) : null
  const quota = !settings.maxEntriesPerLeg || (leg?.entries ?? 0) < settings.maxEntriesPerLeg
  const headline = !session ? 'Start a session to lock the original ATM contracts.' : session.pending ? 'Waiting for broker confirmation. No new entry can be submitted.'
    : !leg ? 'Waiting for the completed opening reference.' : leg.position ? 'Position open: monitoring selected targets and the completed-candle protective exit.'
      : !enabled ? 'This leg is disabled in the session settings.' : !quota ? 'The configured entry limit has been reached.'
        : cutoff != null && now >= cutoff ? 'Cutoff reached: new entries are disabled.' : !session.pnlVerified ? 'Quantity accounting is unverified. Automatic entries are blocked; review the broker ledger.' : session.status !== 'running' ? `Session is ${session.status}.`
          : !fresh ? 'Waiting for a fresh market price.' : 'Waiting for a new completed five-minute candle that qualifies for entry.'
  return { side, headline, mark, fresh, markReceiptAgeMs: mark ? Math.max(0, now - mark.receivedAt) : null, entryQuantity: leg ? settings.entryLots * leg.contract.lotSize : null,
    estimatedEntryPremium: leg && fresh ? round(settings.entryLots * leg.contract.lotSize * mark.price) : null,
    checks: [
      { name: 'Session accepting entries', ready: session?.status === 'running', detail: session ? `Session is ${session.status}.` : 'No active session.' },
      { name: 'Before cutoff', ready: cutoff != null && now < cutoff, detail: `New entries stop at ${settings.cutoff} IST.` },
      { name: 'Tracked quantities verified', ready: session?.pnlVerified === true, detail: session?.pnlVerified ? 'Tracked quantity accounting is verified.' : 'Reconcile quantities before trusting P&L or submitting entries.' },
      { name: 'Reference locked', ready: !!leg, detail: leg ? `Opening close ${leg.reference.close}; breakout ${entryLevel(leg, settings)}; candle exit ${directionOf(settings) === 'sell' ? leg.upper : leg.lower}.` : 'Original 09:15–09:20 reference not yet available.' },
      { name: 'Leg enabled', ready: enabled, detail: enabled ? 'Entries enabled for this leg.' : 'Entries disabled; existing exposure is still monitored.' },
      { name: 'Fresh price', ready: fresh, detail: fresh ? `${mark.source} receipt is fresh. Exchange time is ${mark.exchangeAt ? 'supplied separately' : 'unavailable'}.` : 'Stale or absent prices cannot open a new position.' },
      { name: 'No pending order', ready: !session?.pending, detail: session?.pending ? 'Broker confirmation is outstanding.' : 'No unresolved order intent.' },
      { name: 'Flat before entry', ready: !leg?.position, detail: leg?.position ? `Holding ${leg.position.quantity} units.` : 'No tracked position on this leg.' },
      { name: 'Entry quota', ready: quota, detail: settings.maxEntriesPerLeg ? `${leg?.entries ?? 0}/${settings.maxEntriesPerLeg} entries this session.` : 'No configured entry-count limit.' },
      { name: 'Fresh breakout for re-entry', ready: !!leg && (leg.entries === 0 && !leg.firstSignalConsumed || leg.reentryReady === true), detail: !leg ? 'Opening reference not yet available.' : leg.entries === 0 && !leg.firstSignalConsumed ? 'First entry uses the original breakout level.' : leg.reentryReady ? `Reset confirmed. Waiting for a later close ${directionOf(settings) === 'sell' ? 'below' : 'above'} ${entryLevel(leg, settings)}.` : `After full exit, wait for a close ${directionOf(settings) === 'sell' ? 'above' : 'below'} ${entryLevel(leg, settings)}, then a later close back through it. Opening reference stays fixed.` },
    ] }
}
