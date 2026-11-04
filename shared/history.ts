export const MAX_HISTORY_DAYS = 93

/** Two calendar months ending yesterday in IST; exclude today's forming session. */
export function pastTwoMonths(now: number): { startDate: string; endDate: string } {
  const today = new Date(new Date(now + 330 * 60_000).toISOString().slice(0, 10))
  const target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(today.getUTCDate(), lastDay))
  return { startDate: target.toISOString().slice(0, 10), endDate: new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10) }
}
