type Frequency = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

// Due dates are always set to 20:00 UTC = 5 PM Argentina (UTC-3, no DST).
// The cron job runs at 20:05 UTC, catching all installments due that day.

export function computeNextDueDate(base: Date, frequency: Frequency): Date {
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const d = base.getUTCDate()
  if (frequency === 'DAILY')       return new Date(Date.UTC(y, m, d + 1,  20, 0, 0))
  if (frequency === 'WEEKLY')      return new Date(Date.UTC(y, m, d + 7,  20, 0, 0))
  if (frequency === 'FORTNIGHTLY') return new Date(Date.UTC(y, m, d + 15, 20, 0, 0))
  /* MONTHLY */                    return new Date(Date.UTC(y, m + 1, d,  20, 0, 0))
}

export function computeDueDates(startDate: Date, count: number, frequency: Frequency): Date[] {
  const y = startDate.getUTCFullYear()
  const m = startDate.getUTCMonth()
  const d = startDate.getUTCDate()
  return Array.from({ length: count }, (_, i) => {
    if (frequency === 'DAILY')       return new Date(Date.UTC(y, m, d + (i + 1),       20, 0, 0))
    if (frequency === 'WEEKLY')      return new Date(Date.UTC(y, m, d + (i + 1) * 7,   20, 0, 0))
    if (frequency === 'FORTNIGHTLY') return new Date(Date.UTC(y, m, d + (i + 1) * 15,  20, 0, 0))
    /* MONTHLY */                    return new Date(Date.UTC(y, m + (i + 1), d,        20, 0, 0))
  })
}
