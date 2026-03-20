import { describe, expect, test } from 'bun:test'
import { recalculateStatusAfterVoid } from '../lib/paymentUtils.ts'

const dueDate = new Date('2025-03-15T20:00:00.000Z')
const beforeDue = new Date('2025-03-15T10:00:00.000Z')
const afterDue = new Date('2025-03-16T10:00:00.000Z')
const amount = 1000

// Helper to make a non-voided payment
const p = (id: string, amt: number, paymentDate: Date, isVoided = false) => ({
  id,
  amount: amt,
  isVoided,
  paymentDate,
})

describe('recalculateStatusAfterVoid', () => {
  describe('no remaining payments after void', () => {
    test('past due date → OVERDUE', () => {
      const now = new Date('2025-03-16T00:00:00.000Z')
      const status = recalculateStatusAfterVoid([p('a', 1000, beforeDue)], 'a', amount, dueDate, now)
      expect(status).toBe('OVERDUE')
    })

    test('before due date → PENDING', () => {
      const now = new Date('2025-03-14T00:00:00.000Z')
      const status = recalculateStatusAfterVoid([p('a', 1000, beforeDue)], 'a', amount, dueDate, now)
      expect(status).toBe('PENDING')
    })

    test('exactly at due date → OVERDUE (dueDate < now is false, but dueDate === now is also false → PENDING)', () => {
      // dueDate < now → OVERDUE; if now === dueDate → not strictly less → PENDING
      const now = new Date(dueDate)
      const status = recalculateStatusAfterVoid([p('a', 1000, beforeDue)], 'a', amount, dueDate, now)
      expect(status).toBe('PENDING')
    })
  })

  describe('partial sum remaining', () => {
    test('remaining sum < installment amount → PARTIALLY_PAID', () => {
      const now = new Date('2025-03-14T00:00:00.000Z')
      const payments = [p('a', 400, beforeDue), p('b', 300, beforeDue)]
      // void 'b', remaining sum = 400 < 1000
      const status = recalculateStatusAfterVoid(payments, 'b', amount, dueDate, now)
      expect(status).toBe('PARTIALLY_PAID')
    })

    test('already-voided payments are excluded from sum', () => {
      const now = new Date('2025-03-14T00:00:00.000Z')
      const payments = [p('a', 400, beforeDue), p('b', 300, beforeDue, true), p('c', 200, beforeDue)]
      // void 'c'; 'b' already voided; remaining = ['a'(400)] → sum = 400 < 1000
      const status = recalculateStatusAfterVoid(payments, 'c', amount, dueDate, now)
      expect(status).toBe('PARTIALLY_PAID')
    })
  })

  describe('full sum remaining', () => {
    test('latest remaining payment on due date → PAID', () => {
      const status = recalculateStatusAfterVoid(
        [p('a', 1000, dueDate), p('b', 500, beforeDue)],
        'b',
        amount,
        dueDate,
        new Date(),
      )
      expect(status).toBe('PAID')
    })

    test('latest remaining payment before due date → PAID', () => {
      const status = recalculateStatusAfterVoid(
        [p('a', 1000, beforeDue)],
        'NONEXISTENT',
        amount,
        dueDate,
        new Date(),
      )
      expect(status).toBe('PAID')
    })

    test('latest remaining payment after due date → LATE_PAID', () => {
      // void the on-time payment; remaining is the late one that covers the full amount
      const status = recalculateStatusAfterVoid(
        [p('a', 100, beforeDue), p('b', 1000, afterDue)],
        'a',
        amount,
        dueDate,
        new Date(),
      )
      expect(status).toBe('LATE_PAID')
    })

    test('multiple payments — latest determines PAID vs LATE_PAID', () => {
      // Two on-time payments together cover the amount, but void the later one
      // Remaining: only early payment (sum = 600 < 1000) → PARTIALLY_PAID
      const early = new Date('2025-03-10T20:00:00.000Z')
      const mid = new Date('2025-03-12T20:00:00.000Z')
      const payments = [p('a', 600, early), p('b', 400, mid)]
      const now = new Date('2025-03-14T00:00:00.000Z')
      const status = recalculateStatusAfterVoid(payments, 'b', amount, dueDate, now)
      expect(status).toBe('PARTIALLY_PAID')
    })

    test('the voided payment itself is excluded even though isVoided is still false in the array', () => {
      // Simulates the state at the moment of voiding: payment not yet marked in DB
      const payments = [p('target', 1000, beforeDue, false)]
      const now = new Date('2025-03-16T00:00:00.000Z')
      const status = recalculateStatusAfterVoid(payments, 'target', amount, dueDate, now)
      expect(status).toBe('OVERDUE') // no remaining → past due
    })
  })
})
