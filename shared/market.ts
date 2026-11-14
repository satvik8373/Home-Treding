import type { Mark } from './model.ts'

/** Receipt time cannot make an old exchange update executable again. */
export function freshMark(mark: Mark | null | undefined, now: number): mark is Mark {
  return isMarketOpen(now) && !!mark && Number.isFinite(mark.price) && mark.price > 0
    && Number.isFinite(mark.receivedAt) && now - mark.receivedAt <= 5000 && mark.receivedAt <= now + 1000
    && (mark.exchangeAt == null || Number.isFinite(mark.exchangeAt)
      && now - mark.exchangeAt <= 5000 && mark.exchangeAt <= now + 1000)
}

/**
 * NSE Market Trading Hours:
 * - Monday to Friday (where 0=Sun, 6=Sat)
 * - 09:15 to 15:30 IST
 */
export function isMarketOpen(now: number = Date.now()): boolean {
  // IST is UTC + 5:30 (330 minutes)
  const istDate = new Date(now + 330 * 60_000);
  const day = istDate.getUTCDay();
  if (day === 0 || day === 6) return false; // Weekend closed
  const minutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  return minutes >= 555 && minutes < 930; // 09:15 (555m) to 15:30 (930m)
}
