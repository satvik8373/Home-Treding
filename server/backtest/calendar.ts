import { isTradingDay, istTime } from '../time.ts'

// NSE F&O 2026 trading calendar, verified 2026-11-04:
// https://nsearchives.nseindia.com/content/circulars/FAOP71777.pdf
// Scope: normal 09:15–15:30 sessions used by this strategy; not Muhurat sessions.
const holidays: Record<string, string> = {
  '2026-01-26': 'Republic Day', '2026-03-03': 'Holi', '2026-03-26': 'Shri Ram Navami',
  '2026-03-31': 'Shri Mahavir Jayanti', '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti', '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id', '2026-06-26': 'Muharram', '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Mahatma Gandhi Jayanti', '2026-10-20': 'Dussehra',
  '2026-11-10': 'Diwali-Balipratipada', '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2026-12-25': 'Christmas Day',
}

export function nonSessionReason(date: string): string | null {
  if (holidays[date]) return `NSE holiday: ${holidays[date]}.`
  return !isTradingDay(istTime(date, '12:00')) ? 'Weekend: no normal NSE session.' : null
}
