import type { TradingSession } from '../shared/model.ts'
import type { BacktestReport } from '../shared/backtest.ts'
import { settingsFor } from '../shared/settings.ts'

type Cell = string | number | boolean | null | undefined
type Row = Record<string, Cell>
const rounded = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
/** Explicit timezone conversion; never depend on the host/server locale. */
export function istFields(at: number | null | undefined, prefix = 'fill'): Row {
  if (at == null || !Number.isFinite(at)) return { [`${prefix}_date_ist`]: null, [`${prefix}_time_ist`]: null, [`${prefix}_datetime_ist`]: null, [`${prefix}_time_utc`]: null }
  const text = new Date(at + 330 * 60_000).toISOString()
  return { [`${prefix}_date_ist`]: text.slice(0, 10), [`${prefix}_time_ist`]: text.slice(11, 23), [`${prefix}_datetime_ist`]: `${text.slice(0, 10)} ${text.slice(11, 23)}`, [`${prefix}_time_utc`]: new Date(at).toISOString() }
}
function csvCell(value: Cell): string {
  if (value == null || typeof value === 'number' && !Number.isFinite(value)) return '""'
  // Preserve negative numeric P&L as numbers. Only text can contain spreadsheet formulas.
  let text = String(value)
  if (typeof value === 'string' && /^[\s\u200b\ufeff]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function csvRows(columns: string[], rows: Row[]): string {
  return '\ufeff' + [columns.map(csvCell).join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n'
}
const timeColumns = (prefix: string) => ['date_ist', 'time_ist', 'datetime_ist', 'time_utc'].map(key => `${prefix}_${key}`)
const commonColumns = [...timeColumns('fill'), 'timezone', 'timestamp_basis', 'session_date', 'mode', 'side', 'symbol', 'transaction', 'quantity_units', 'lot_size_units', 'lots', 'fill_price_inr', 'premium_value_inr', 'premium_cash_flow_inr', 'reason', 'order_id', 'trade_id', 'cycle_id', 'entry_datetime_ist', 'entry_price_inr', 'remaining_cycle_units', 'cycle_match', 'reference_close_inr', 'breakout_level_inr', 'lower_exit_level_inr', 'reference_stop_inr', 'target1_price_inr', 'target2_price_inr', 'realized_gross_pnl_inr', 'cumulative_realized_gross_pnl_inr', 'actual_broker_charges_inr', 'estimated_fee_inr', 'cumulative_pnl_after_estimated_fees_inr', 'pnl_verified', 'session_id', 'exported_datetime_ist', 'report_scope', 'cost_note', 'strategy_settings_json']

export function tradesReport(session: TradingSession | null, exportedAt = Date.now()) {
  const settings = settingsFor(session), rows: Row[] = []
  const cycles = new Map<string, { id: string; price: number; at: number; remaining: number; valid: boolean }>()
  let realized = 0, estimated = 0
  for (const trade of [...(session?.trades ?? [])].sort((a, b) => a.at - b.at)) {
    const key = `${trade.side}:${trade.symbol}`
    let cycle = cycles.get(key), matched = true
    if (trade.transaction === 'BUY') {
      matched = !cycle?.remaining
      cycle = { id: trade.id, price: trade.price, at: trade.at, remaining: trade.quantity, valid: matched }
      cycles.set(key, cycle)
    } else if (!cycle || cycle.remaining < trade.quantity) { matched = false; cycle = undefined; cycles.delete(key) }
    else cycle.remaining -= trade.quantity
    const candidate = session?.legs[trade.side]
    const leg = candidate?.contract.symbol === trade.symbol ? candidate : undefined
    realized = rounded(realized + (trade.pnl ?? 0)); estimated = rounded(estimated + settings.feePerOrderEstimate)
    rows.push({ ...istFields(trade.at), timezone: 'Asia/Kolkata (UTC+05:30)', timestamp_basis: trade.mode === 'paper' ? 'Paper simulation timestamp' : 'Engine fill-confirmation timestamp; exchange fill time not captured',
      session_date: session?.date, mode: trade.mode, side: trade.side, symbol: trade.symbol, transaction: trade.transaction,
      quantity_units: trade.quantity, lot_size_units: leg?.contract.lotSize, lots: leg ? trade.quantity / leg.contract.lotSize : null,
      fill_price_inr: trade.price, premium_value_inr: rounded(trade.quantity * trade.price), premium_cash_flow_inr: rounded((trade.transaction === 'BUY' ? -1 : 1) * trade.quantity * trade.price),
      reason: trade.reason, order_id: trade.orderId, trade_id: trade.id, cycle_id: cycle?.valid ? cycle.id : null,
      entry_datetime_ist: cycle?.valid ? istFields(cycle.at).fill_datetime_ist : null, entry_price_inr: cycle?.valid ? cycle.price : null, remaining_cycle_units: cycle?.remaining,
      cycle_match: matched && cycle?.valid ? 'MATCHED' : 'UNMATCHED_OR_OVERLAPPING_HISTORY', reference_close_inr: leg?.reference.close, breakout_level_inr: leg?.upper, lower_exit_level_inr: leg?.lower,
      reference_stop_inr: leg && (settings.stopLossPoints ?? 0) > 0 ? rounded(leg.reference.close - settings.stopLossPoints!) : null,
      target1_price_inr: cycle && settings.target1Lots > 0 ? rounded(cycle.price + settings.target1Points) : null, target2_price_inr: cycle ? rounded(cycle.price + settings.target2Points) : null,
      realized_gross_pnl_inr: trade.pnl, cumulative_realized_gross_pnl_inr: realized, actual_broker_charges_inr: null,
      estimated_fee_inr: settings.feePerOrderEstimate, cumulative_pnl_after_estimated_fees_inr: rounded(realized - estimated),
      pnl_verified: session?.pnlVerified, session_id: session?.id, exported_datetime_ist: istFields(exportedAt).fill_datetime_ist,
      report_scope: 'Current saved day-session only; confirmed/simulated fills, not the full broker ledger', cost_note: 'Actual brokerage/taxes unavailable; estimates are not broker deductions.', strategy_settings_json: JSON.stringify(settings) })
  }
  return { filename: `009-${session?.mode ?? 'session'}-trades-${session?.date ?? 'empty'}.csv`, body: csvRows(commonColumns, rows) }
}

export function ordersReport(session: TradingSession | null, exportedAt = Date.now()) {
  const records = [...(session?.orderAudit ?? [])]
  if (session?.pending && !records.some(order => order.id === session.pending!.id)) {
    const p = session.pending
    records.push({ ...p, updatedAt: p.submittedAt, mode: session.mode, status: 'unknown', filled: null, average: null, detail: 'Saved pending intent. Fill and latest broker status are not confirmed.' })
  }
  const rows: Row[] = records.sort((a, b) => a.submittedAt - b.submittedAt).map(order => ({
    ...istFields(order.submittedAt, 'submitted'), ...istFields(order.updatedAt, 'updated'), timezone: 'Asia/Kolkata (UTC+05:30)', session_date: session?.date,
    mode: order.mode, side: order.side, symbol: order.symbol, transaction: order.transaction, requested_quantity_units: order.quantity,
    confirmed_filled_units: order.filled, unfilled_requested_units: order.filled == null ? null : Math.max(0, order.quantity - order.filled),
    confirmed_average_inr: order.average, status: order.status, reason: order.reason, order_id: order.orderId, intent_id: order.id, tag: order.tag,
    detail: order.detail, status_history_ist: JSON.stringify((order.events ?? []).map(event => ({ at_ist: istFields(event.at).fill_datetime_ist, status: event.status, detail: event.detail }))),
    session_id: session?.id, exported_datetime_ist: istFields(exportedAt).fill_datetime_ist,
    report_scope: 'Engine order audit; pending/rejected orders are not fills; Paper entries are simulated.' }))
  return { filename: `009-${session?.mode ?? 'session'}-orders-${session?.date ?? 'empty'}.csv`, body: csvRows([...timeColumns('submitted'), ...timeColumns('updated'), 'timezone', 'session_date', 'mode', 'side', 'symbol', 'transaction', 'requested_quantity_units', 'confirmed_filled_units', 'unfilled_requested_units', 'confirmed_average_inr', 'status', 'reason', 'order_id', 'intent_id', 'tag', 'detail', 'status_history_ist', 'session_id', 'exported_datetime_ist', 'report_scope'], rows) }
}

export function backtestTradesReport(report: BacktestReport, jobId: string, exportedAt = Date.now()) {
  const settings = settingsFor({ settings: report.options.strategySettings }), rows: Row[] = []
  for (const day of report.days) {
    const quantities = new Map<string, number>(); let realized = 0, fees = 0
    for (const fill of [...day.fills].sort((a, b) => a.at - b.at)) {
      const cycle = day.cycles.find(c => c.id === fill.cycleId), reference = day.reference[fill.side]
      const remaining = (quantities.get(fill.cycleId) ?? 0) + (fill.transaction === 'BUY' ? fill.quantity : -fill.quantity)
      quantities.set(fill.cycleId, remaining); realized = rounded(realized + (fill.grossPnl ?? 0)); fees = rounded(fees + fill.fee)
      rows.push({ ...istFields(fill.at), timezone: 'Asia/Kolkata (UTC+05:30)', timestamp_basis: !fill.timing ? 'Legacy backtest timestamp; exact execution timing not recorded' : fill.timing === 'intrabar-unknown' ? 'Candle-end proxy; exact intrabar time/order unknown' : 'Modelled candle-open execution',
        session_date: day.date, mode: 'backtest', side: fill.side, symbol: fill.symbol, transaction: fill.transaction, quantity_units: fill.quantity,
        lot_size_units: day.lotSize, lots: fill.quantity / day.lotSize, fill_price_inr: fill.price, premium_value_inr: rounded(fill.quantity * fill.price),
        premium_cash_flow_inr: rounded((fill.transaction === 'BUY' ? -1 : 1) * fill.quantity * fill.price), reason: fill.reason, trade_id: fill.id, cycle_id: fill.cycleId,
        entry_datetime_ist: cycle ? istFields(cycle.entryAt).fill_datetime_ist : null, entry_price_inr: cycle?.entryPrice, remaining_cycle_units: remaining,
        cycle_match: cycle && remaining >= 0 ? 'MATCHED' : 'UNMATCHED_HISTORY', reference_close_inr: reference.close, breakout_level_inr: reference.upper, lower_exit_level_inr: reference.lower,
        reference_stop_inr: (settings.stopLossPoints ?? 0) > 0 ? rounded(reference.close - settings.stopLossPoints!) : null,
        target1_price_inr: cycle && settings.target1Lots > 0 ? rounded(cycle.entryPrice + settings.target1Points) : null, target2_price_inr: cycle ? rounded(cycle.entryPrice + settings.target2Points) : null,
        realized_gross_pnl_inr: fill.grossPnl, cumulative_realized_gross_pnl_inr: realized, actual_broker_charges_inr: null, estimated_fee_inr: fill.fee,
        cumulative_pnl_after_estimated_fees_inr: rounded(realized - fees), exported_datetime_ist: istFields(exportedAt).fill_datetime_ist,
        report_scope: 'Simulated OHLC backtest fills only', cost_note: 'Assumed fees only; actual brokerage/taxes not verified.', strategy_settings_json: JSON.stringify(settings), timing_model: fill.timing,
        engine: report.engine, job_id: jobId, range_start: report.startDate, range_end: report.endDate, expiry: day.expiry, coverage: day.status,
        data_source: day.source, contract_source: day.contractSource, slippage_points: report.options.slippagePoints })
    }
  }
  rows.sort((a, b) => String(a.fill_datetime_ist).localeCompare(String(b.fill_datetime_ist)))
  return { filename: `009-backtest-trades-${report.startDate}-to-${report.endDate}.csv`, body: csvRows([...commonColumns, 'timing_model', 'engine', 'job_id', 'range_start', 'range_end', 'expiry', 'coverage', 'data_source', 'contract_source', 'slippage_points'], rows) }
}

export function backtestDaysReport(report: BacktestReport) {
  const rows: Row[] = []
  for (let at = Date.parse(report.startDate); at <= Date.parse(report.endDate); at += 86400_000) {
    const date = new Date(at).toISOString().slice(0, 10), day = report.days.find(d => d.date === date), excluded = report.skipped.find(d => d.date === date)
    rows.push({ date_ist: date, timezone: 'Asia/Kolkata (UTC+05:30)', status: day ? day.status : 'EXCLUDED', reason: excluded?.reason,
      data_source: day?.source, contract_source: day?.contractSource, atm_strike: day?.atm, expiry: day?.expiry, lot_size_units: day?.lotSize,
      fill_count: day?.fills.length, closed_cycles: day?.cycles.filter(c => c.remaining === 0).length, gross_realized_pnl_inr: day?.grossPnl,
      assumed_fees_inr: day?.fees, pnl_after_assumed_costs_inr: day?.netRealizedPnl, open_pnl_inr: day?.openPnl, marked_max_drawdown_inr: day?.maxDrawdown,
      actual_broker_charges_inr: null, data_as_of_ist: day ? istFields(day.asOf).fill_datetime_ist : null, engine: report.engine,
      report_scope: 'Excluded dates have no calculated performance; not zero-P&L trading days.' })
  }
  return { filename: `009-backtest-daily-${report.startDate}-to-${report.endDate}.csv`, body: csvRows(['date_ist', 'timezone', 'status', 'reason', 'data_source', 'contract_source', 'atm_strike', 'expiry', 'lot_size_units', 'fill_count', 'closed_cycles', 'gross_realized_pnl_inr', 'assumed_fees_inr', 'pnl_after_assumed_costs_inr', 'open_pnl_inr', 'marked_max_drawdown_inr', 'actual_broker_charges_inr', 'data_as_of_ist', 'engine', 'report_scope'], rows) }
}
