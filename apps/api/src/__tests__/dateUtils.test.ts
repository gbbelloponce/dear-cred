import { describe, expect, test } from 'bun:test'
import { computeNextDueDate, computeDueDates } from '../lib/dateUtils.ts'

// All due dates are stored at 20:00 UTC = 5 PM Argentina (UTC-3, no DST).

describe('computeNextDueDate', () => {
  const base = new Date(Date.UTC(2025, 0, 15, 20, 0, 0)) // Jan 15, 2025 20:00 UTC

  test('DAILY adds one day', () => {
    const result = computeNextDueDate(base, 'DAILY')
    expect(result).toEqual(new Date(Date.UTC(2025, 0, 16, 20, 0, 0)))
  })

  test('WEEKLY adds seven days', () => {
    const result = computeNextDueDate(base, 'WEEKLY')
    expect(result).toEqual(new Date(Date.UTC(2025, 0, 22, 20, 0, 0)))
  })

  test('MONTHLY adds one month', () => {
    const result = computeNextDueDate(base, 'MONTHLY')
    expect(result).toEqual(new Date(Date.UTC(2025, 1, 15, 20, 0, 0))) // Feb 15
  })

  test('always sets time to 20:00 UTC', () => {
    for (const freq of ['DAILY', 'WEEKLY', 'MONTHLY'] as const) {
      const result = computeNextDueDate(base, freq)
      expect(result.getUTCHours()).toBe(20)
      expect(result.getUTCMinutes()).toBe(0)
      expect(result.getUTCSeconds()).toBe(0)
    }
  })

  test('MONTHLY on Jan 31 overflows into March (JS Date natural rollover)', () => {
    const jan31 = new Date(Date.UTC(2025, 0, 31, 20, 0, 0))
    const result = computeNextDueDate(jan31, 'MONTHLY')
    // Date.UTC(2025, 1, 31) = Feb doesn't have 31 days → overflows to Mar 3
    expect(result).toEqual(new Date(Date.UTC(2025, 2, 3, 20, 0, 0)))
  })

  test('DAILY across month boundary', () => {
    const jan31 = new Date(Date.UTC(2025, 0, 31, 20, 0, 0))
    const result = computeNextDueDate(jan31, 'DAILY')
    expect(result).toEqual(new Date(Date.UTC(2025, 1, 1, 20, 0, 0))) // Feb 1
  })

  test('WEEKLY across year boundary', () => {
    const dec29 = new Date(Date.UTC(2024, 11, 29, 20, 0, 0))
    const result = computeNextDueDate(dec29, 'WEEKLY')
    expect(result).toEqual(new Date(Date.UTC(2025, 0, 5, 20, 0, 0))) // Jan 5, 2025
  })
})

describe('computeDueDates', () => {
  const start = new Date(Date.UTC(2025, 0, 1, 20, 0, 0)) // Jan 1, 2025

  test('DAILY generates correct sequence', () => {
    const dates = computeDueDates(start, 3, 'DAILY')
    expect(dates).toHaveLength(3)
    expect(dates[0]).toEqual(new Date(Date.UTC(2025, 0, 2, 20, 0, 0)))
    expect(dates[1]).toEqual(new Date(Date.UTC(2025, 0, 3, 20, 0, 0)))
    expect(dates[2]).toEqual(new Date(Date.UTC(2025, 0, 4, 20, 0, 0)))
  })

  test('WEEKLY generates correct sequence', () => {
    const dates = computeDueDates(start, 3, 'WEEKLY')
    expect(dates).toHaveLength(3)
    expect(dates[0]).toEqual(new Date(Date.UTC(2025, 0, 8, 20, 0, 0)))
    expect(dates[1]).toEqual(new Date(Date.UTC(2025, 0, 15, 20, 0, 0)))
    expect(dates[2]).toEqual(new Date(Date.UTC(2025, 0, 22, 20, 0, 0)))
  })

  test('MONTHLY generates correct sequence', () => {
    const dates = computeDueDates(start, 3, 'MONTHLY')
    expect(dates).toHaveLength(3)
    expect(dates[0]).toEqual(new Date(Date.UTC(2025, 1, 1, 20, 0, 0))) // Feb 1
    expect(dates[1]).toEqual(new Date(Date.UTC(2025, 2, 1, 20, 0, 0))) // Mar 1
    expect(dates[2]).toEqual(new Date(Date.UTC(2025, 3, 1, 20, 0, 0))) // Apr 1
  })

  test('count of 1 returns single date', () => {
    const dates = computeDueDates(start, 1, 'MONTHLY')
    expect(dates).toHaveLength(1)
    expect(dates[0]).toEqual(new Date(Date.UTC(2025, 1, 1, 20, 0, 0)))
  })

  test('all dates are at 20:00 UTC', () => {
    const dates = computeDueDates(start, 5, 'DAILY')
    for (const d of dates) {
      expect(d.getUTCHours()).toBe(20)
      expect(d.getUTCMinutes()).toBe(0)
    }
  })

  test('first date is always startDate + 1 period (not startDate itself)', () => {
    const dates = computeDueDates(start, 1, 'DAILY')
    expect(dates[0].getUTCDate()).toBe(start.getUTCDate() + 1) // Jan 2, not Jan 1
  })
})
