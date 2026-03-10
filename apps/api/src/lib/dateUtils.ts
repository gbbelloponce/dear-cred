type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

// Due dates are always set to 23:00 UTC = 8 PM Argentina (UTC-3, no DST).
// The cron job runs at 23:10 UTC, catching all installments due that day.

export function computeNextDueDate(base: Date, frequency: Frequency): Date {
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const d = base.getUTCDate()
  if (frequency === 'DAILY')   return new Date(Date.UTC(y, m, d + 1, 23, 0, 0))
  if (frequency === 'WEEKLY')  return new Date(Date.UTC(y, m, d + 7, 23, 0, 0))
  /* MONTHLY */                return new Date(Date.UTC(y, m + 1, d, 23, 0, 0))
}

export function computeDueDates(startDate: Date, count: number, frequency: Frequency): Date[] {
  const y = startDate.getUTCFullYear()
  const m = startDate.getUTCMonth()
  const d = startDate.getUTCDate()
  return Array.from({ length: count }, (_, i) => {
    if (frequency === 'DAILY')   return new Date(Date.UTC(y, m, d + (i + 1), 23, 0, 0))
    if (frequency === 'WEEKLY')  return new Date(Date.UTC(y, m, d + (i + 1) * 7, 23, 0, 0))
    /* MONTHLY */                return new Date(Date.UTC(y, m + (i + 1), d, 23, 0, 0))
  })
}
