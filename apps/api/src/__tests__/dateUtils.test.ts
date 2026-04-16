import { describe, expect, test } from 'bun:test'
import { computeDueDates, computeNextDueDate } from '../lib/dateUtils.ts'

function storedDueDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day + 1, 2, 55, 0))
}

describe('computeNextDueDate', () => {
  const base = storedDueDate(2025, 0, 15) // Jan 15, 2025 at 23:55 ARG

  test('DAILY adds one due day', () => {
    const result = computeNextDueDate(base, 'DAILY')
    expect(result).toEqual(storedDueDate(2025, 0, 16))
  })

  test('WEEKLY adds seven due days', () => {
    const result = computeNextDueDate(base, 'WEEKLY')
    expect(result).toEqual(storedDueDate(2025, 0, 22))
  })

  test('FORTNIGHTLY adds fifteen due days', () => {
    const result = computeNextDueDate(base, 'FORTNIGHTLY')
    expect(result).toEqual(storedDueDate(2025, 0, 30))
  })

  test('MONTHLY adds one month', () => {
    const result = computeNextDueDate(base, 'MONTHLY')
    expect(result).toEqual(storedDueDate(2025, 1, 15))
  })

  test('always keeps the stored due time at 02:55 UTC', () => {
    for (const frequency of ['DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY'] as const) {
      const result = computeNextDueDate(base, frequency)
      expect(result.getUTCHours()).toBe(2)
      expect(result.getUTCMinutes()).toBe(55)
      expect(result.getUTCSeconds()).toBe(0)
    }
  })

  test('shifts a Sunday due date to Monday', () => {
    const saturdayDue = storedDueDate(2025, 0, 4)
    const result = computeNextDueDate(saturdayDue, 'DAILY')

    expect(result).toEqual(storedDueDate(2025, 0, 6))
  })
})

describe('computeDueDates', () => {
  const start = new Date(Date.UTC(2025, 0, 1, 20, 0, 0)) // Jan 1, 2025 start date

  test('DAILY generates the stored due-date sequence', () => {
    const dates = computeDueDates(start, 3, 'DAILY')

    expect(dates).toHaveLength(3)
    expect(dates[0]).toEqual(storedDueDate(2025, 0, 1))
    expect(dates[1]).toEqual(storedDueDate(2025, 0, 2))
    expect(dates[2]).toEqual(storedDueDate(2025, 0, 3))
  })

  test('WEEKLY generates the stored due-date sequence', () => {
    const dates = computeDueDates(start, 3, 'WEEKLY')

    expect(dates).toHaveLength(3)
    expect(dates[0]).toEqual(storedDueDate(2025, 0, 1))
    expect(dates[1]).toEqual(storedDueDate(2025, 0, 8))
    expect(dates[2]).toEqual(storedDueDate(2025, 0, 15))
  })

  test('MONTHLY generates the stored due-date sequence', () => {
    const dates = computeDueDates(start, 3, 'MONTHLY')

    expect(dates).toHaveLength(3)
    expect(dates[0]).toEqual(storedDueDate(2025, 0, 1))
    expect(dates[1]).toEqual(storedDueDate(2025, 1, 1))
    expect(dates[2]).toEqual(storedDueDate(2025, 2, 1))
  })

  test('count of 1 returns a single stored due date', () => {
    const dates = computeDueDates(start, 1, 'MONTHLY')

    expect(dates).toHaveLength(1)
    expect(dates[0]).toEqual(storedDueDate(2025, 0, 1))
  })

  test('all due dates are stored at 02:55 UTC', () => {
    const dates = computeDueDates(start, 5, 'DAILY')

    for (const date of dates) {
      expect(date.getUTCHours()).toBe(2)
      expect(date.getUTCMinutes()).toBe(55)
      expect(date.getUTCSeconds()).toBe(0)
    }
  })

  test('first due date is the start day itself', () => {
    const dates = computeDueDates(start, 1, 'DAILY')

    expect(dates[0]).toEqual(storedDueDate(2025, 0, 1))
  })

  test('DAILY cascades Sunday shifts so installments do not overlap', () => {
    const fridayStart = new Date(Date.UTC(2025, 0, 3, 20, 0, 0))
    const dates = computeDueDates(fridayStart, 4, 'DAILY')

    expect(dates).toEqual([
      storedDueDate(2025, 0, 3),
      storedDueDate(2025, 0, 4),
      storedDueDate(2025, 0, 6),
      storedDueDate(2025, 0, 7),
    ])
  })

  test('FORTNIGHTLY shifts Sunday installments independently', () => {
    const fridayStart = new Date(Date.UTC(2025, 0, 3, 20, 0, 0))
    const dates = computeDueDates(fridayStart, 3, 'FORTNIGHTLY')

    expect(dates).toEqual([
      storedDueDate(2025, 0, 3),
      storedDueDate(2025, 0, 18),
      storedDueDate(2025, 1, 3),
    ])
  })
})
