import type { Contract, OrderIntent } from '../shared/model.ts'

type Row = Record<string, unknown>
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
/** Normalize only recognized NIFTY option identifiers, never arbitrary symbol punctuation. */
function contractIdentity(value: unknown, expiry?: string): string | null {
  const symbol = String(value ?? '').trim().toUpperCase()
  let year: number, month: number, day: number, strike: number, side: string
  const display = /^NIFTY-(\d{2})([A-Z]{3})(\d{4})-(\d+(?:\.\d+)?)-(CE|PE)$/.exec(symbol)
  const weekly = /^NIFTY(\d{2})([1-9OND])(\d{2})(\d+(?:\.\d+)?)(CE|PE)$/.exec(symbol)
  const monthly = /^NIFTY(\d{2})([A-Z]{3})(\d+(?:\.\d+)?)(CE|PE)$/.exec(symbol)
  if (display) { year = Number(display[3]); month = months.indexOf(display[2]) + 1; day = Number(display[1]); strike = Number(display[4]); side = display[5] }
  else if (weekly) { year = 2000 + Number(weekly[1]); month = /^[1-9]$/.test(weekly[2]) ? Number(weekly[2]) : 10 + 'OND'.indexOf(weekly[2]); day = Number(weekly[3]); strike = Number(weekly[4]); side = weekly[5] }
  else if (monthly && expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    year = 2000 + Number(monthly[1]); month = months.indexOf(monthly[2]) + 1; day = Number(expiry.slice(8)); strike = Number(monthly[3]); side = monthly[4]
    if (Number(expiry.slice(0, 4)) !== year || Number(expiry.slice(5, 7)) !== month) return null
  } else return null
  if (month < 1 || month > 12 || day < 1 || !Number.isFinite(strike) || strike <= 0) return null
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date || expiry && expiry !== date) return null
  return `${date}:${strike}:${side}`
}

export function sameTradingSymbol(a: unknown, b: unknown, expiry?: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a.trim() || !b.trim()) return false
  if (a.trim().toUpperCase() === b.trim().toUpperCase()) return true
  const left = contractIdentity(a, expiry), right = contractIdentity(b, expiry)
  return !!left && left === right
}

export function isNiftyDerivativePosition(row: { symbol: string; exchange: string }): boolean {
  return row.exchange === 'NFO' && row.symbol.toUpperCase().startsWith('NIFTY')
    || row.exchange === 'NSE' && (contractIdentity(row.symbol) !== null
      || /^NIFTY\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d+(?:\.\d+)?(CE|PE)$/.test(row.symbol.trim().toUpperCase()))
}

/** Type A can label recognized NIFTY options NSE and use its display symbol. */
export function matchesPositionRow(row: { symbol: string; exchange: string; product: string }, contract: Contract): boolean {
  if (!sameTradingSymbol(row.symbol, contract.symbol, contract.expiry) || !['MIS', 'INTRADAY', 'INTRA'].includes(row.product)) return false
  return row.exchange === 'NFO' || row.exchange === 'NSE'
    && contractIdentity(row.symbol, contract.expiry) !== null && contractIdentity(contract.symbol, contract.expiry) !== null
}

export function matchesOrderRow(row: Row, intent: OrderIntent, requireTag = false): boolean {
  const tags = Array.isArray(row.tag) ? row.tag : row.tag ? [row.tag] : []
  if ((requireTag || tags.length) && !tags.includes(intent.tag)) return false
  if (requireTag && (!row.tradingsymbol || !row.exchange || !row.transaction_type || row.quantity == null)) return false
  if (row.tradingsymbol && !sameTradingSymbol(row.tradingsymbol, intent.symbol, intent.expiry)) return false
  if (row.exchange && row.exchange !== 'NFO') {
    // Some Type A order reports label derivatives NSE. Accept only a positively identified NIFTY option.
    if (row.exchange !== 'NSE' || !contractIdentity(row.tradingsymbol, intent.expiry) || !contractIdentity(intent.symbol, intent.expiry)) return false
  }
  if (row.transaction_type && String(row.transaction_type).toUpperCase() !== intent.transaction) return false
  if (row.quantity != null && Number(row.quantity) !== intent.quantity) return false
  if (intent.instrumentToken && Number(row.instrument_token) > 0 && String(row.instrument_token) !== intent.instrumentToken) return false
  if (row.product && !['MIS', 'INTRADAY'].includes(String(row.product).toUpperCase())) return false
  return true
}

/** Do not put raw RMS messages, which may contain account identifiers, into the UI. */
export function rejectionSummary(message: unknown): string {
  const text = String(message ?? '')
  if (/FUND LIMIT INSUFFICIENT|INSUFFICIENT (?:FUND|MARGIN)/i.test(text)) {
    const available = /AVAILABLE FUND\s*=\s*([\d.]+)/i.exec(text)?.[1], required = /CALCULATED SPAN & EXPOSURE FOR ORDER\s*=\s*([\d.]+)/i.exec(text)?.[1]
    return available && required ? `Insufficient funds. Available ₹${Number(available).toFixed(2)}; broker requires ₹${Number(required).toFixed(2)} for this order.` : 'Broker rejected the order: insufficient funds or margin.'
  }
  if (/IP Address.*not matching|IP.*mismatch/i.test(text)) return 'Broker rejected the request: the engine IP does not match the registered API IPs.'
  return 'Broker rejected the order. Review its rejection details in mStock.'
}
