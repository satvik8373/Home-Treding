/** Scheduled NSE window for display/polling only; this does not check exchange holidays. */
export function isMarketOpen(now = Date.now()): boolean {
  const ist = new Date(now + 330 * 60_000)
  const day = ist.getUTCDay(), minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return day !== 0 && day !== 6 && minutes >= 555 && minutes < 930
}
