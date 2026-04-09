type Frequency = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

// Due dates are stored at 02:55 UTC the *next* calendar day = 23:55 ARG (UTC-3, no DST).
// e.g. April 8 ARG deadline → stored as 2026-04-09T02:55:00Z.
// The cron job runs at 02:58 UTC, 3 minutes after the client deadline.

export function computeNextDueDate(base: Date, frequency: Frequency): Date {
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const d = base.getUTCDate()
  if (frequency === 'DAILY')       return new Date(Date.UTC(y, m, d + 1  + 1, 2, 55, 0))
  if (frequency === 'WEEKLY')      return new Date(Date.UTC(y, m, d + 7  + 1, 2, 55, 0))
  if (frequency === 'FORTNIGHTLY') return new Date(Date.UTC(y, m, d + 15 + 1, 2, 55, 0))
  /* MONTHLY */                    return new Date(Date.UTC(y, m + 1, d  + 1, 2, 55, 0))
}

export function computeDueDates(startDate: Date, count: number, frequency: Frequency): Date[] {
  const y = startDate.getUTCFullYear()
  const m = startDate.getUTCMonth()
  const d = startDate.getUTCDate()
  return Array.from({ length: count }, (_, i) => {
    if (frequency === 'DAILY')       return new Date(Date.UTC(y, m, d + (i + 1)      + 1, 2, 55, 0))
    if (frequency === 'WEEKLY')      return new Date(Date.UTC(y, m, d + (i + 1) * 7  + 1, 2, 55, 0))
    if (frequency === 'FORTNIGHTLY') return new Date(Date.UTC(y, m, d + (i + 1) * 15 + 1, 2, 55, 0))
    /* MONTHLY */                    return new Date(Date.UTC(y, m + (i + 1), d      + 1, 2, 55, 0))
  })
}
