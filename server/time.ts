const IST_OFFSET = 330 * 60_000
export const FIVE_MINUTES = 300_000
export function istDate(now = Date.now()): string { return new Date(now + IST_OFFSET).toISOString().slice(0, 10) }
export function istTime(day: string, hhmm: string): number { return Date.parse(`${day}T${hhmm}:00+05:30`) }
export function weekday(now: number): number { return new Date(now + IST_OFFSET).getUTCDay() }
export function completedBoundary(now: number): number { return Math.floor(now / FIVE_MINUTES) * FIVE_MINUTES }
export function isTradingDay(now: number): boolean { return ![0, 6].includes(weekday(now)) }
export function parseBrokerTime(value: unknown): number {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value
  if (typeof value !== 'string') throw new Error('Broker candle has no timestamp.')
  // mStock's documented samples truncate the IST offset to +05.
  const normalized = value.replace(/\+05$/, '+05:30')
  const zoned = /(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : `${normalized.replace(' ', 'T')}+05:30`
  const result = Date.parse(zoned)
  if (!Number.isFinite(result)) throw new Error('Broker returned an invalid candle timestamp.')
  return result
}
