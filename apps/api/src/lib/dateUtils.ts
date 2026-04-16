type Frequency = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

// Due dates are stored at 02:55 UTC the *next* calendar day = 23:55 ARG (UTC-3, no DST).
// e.g. April 8 ARG deadline → stored as 2026-04-09T02:55:00Z.
// The cron job runs at 02:58 UTC, 3 minutes after the client deadline.

const DAY_MS = 24 * 60 * 60 * 1000

function shiftStoredSunday(date: Date): Date {
  return date.getUTCDay() === 1
    ? new Date(date.getTime() + DAY_MS)
    : date
}

// Dates are stored at 02:55 UTC = 23:55 ARG, so Monday UTC (getUTCDay()===1) = Sunday ARG.
// DAILY: cascade — a Sunday hit shifts all following installments too (avoids date collisions).
// WEEKLY/FORTNIGHTLY/MONTHLY: each installment is checked independently; gaps are large
// enough that shifting one never collides with the next.
function skipSundays(dates: Date[], frequency: Frequency): Date[] {
  if (frequency === 'DAILY') {
    let shift = 0
    return dates.map((date) => {
      let result = new Date(date.getTime() + shift * DAY_MS)
      if (result.getUTCDay() === 1) {
        shift += 1
        result = new Date(result.getTime() + DAY_MS)
      }
      return result
    })
  }
  return dates.map(shiftStoredSunday)
}

export function computeNextDueDate(base: Date, frequency: Frequency): Date {
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const d = base.getUTCDate()
  const h = base.getUTCHours()
  const min = base.getUTCMinutes()
  const s = base.getUTCSeconds()
  const ms = base.getUTCMilliseconds()

  if (frequency === 'DAILY') {
    return shiftStoredSunday(new Date(Date.UTC(y, m, d + 1, h, min, s, ms)))
  }
  if (frequency === 'WEEKLY') {
    return shiftStoredSunday(new Date(Date.UTC(y, m, d + 7, h, min, s, ms)))
  }
  if (frequency === 'FORTNIGHTLY') {
    return shiftStoredSunday(new Date(Date.UTC(y, m, d + 15, h, min, s, ms)))
  }

  return shiftStoredSunday(new Date(Date.UTC(y, m + 1, d, h, min, s, ms)))
}

export function computeDueDates(startDate: Date, count: number, frequency: Frequency): Date[] {
  const y = startDate.getUTCFullYear()
  const m = startDate.getUTCMonth()
  const d = startDate.getUTCDate()
  const dates = Array.from({ length: count }, (_, i) => {
    if (frequency === 'DAILY')       return new Date(Date.UTC(y, m, d + i        + 1, 2, 55, 0))
    if (frequency === 'WEEKLY')      return new Date(Date.UTC(y, m, d + i * 7    + 1, 2, 55, 0))
    if (frequency === 'FORTNIGHTLY') return new Date(Date.UTC(y, m, d + i * 15   + 1, 2, 55, 0))
    /* MONTHLY */                    return new Date(Date.UTC(y, m + i, d        + 1, 2, 55, 0))
  })

  return skipSundays(dates, frequency)
}
