import { describe, expect, test } from 'bun:test'
import { determinePaymentStatus } from '../lib/paymentUtils.ts'

const dueDate = new Date('2025-03-15T20:00:00.000Z')
const onTime = new Date('2025-03-15T19:00:00.000Z')  // 1 hour before due
const exactly = new Date('2025-03-15T20:00:00.000Z')  // exactly at due date
const late = new Date('2025-03-16T10:00:00.000Z')     // next day
const amount = 1000

describe('determinePaymentStatus', () => {
  test('full payment on time → PAID', () => {
    expect(determinePaymentStatus(amount, amount, onTime, dueDate)).toBe('PAID')
  })

  test('full payment exactly at due date → PAID (not strictly greater)', () => {
    expect(determinePaymentStatus(amount, amount, exactly, dueDate)).toBe('PAID')
  })

  test('full payment after due date → LATE_PAID', () => {
    expect(determinePaymentStatus(amount, amount, late, dueDate)).toBe('LATE_PAID')
  })

  test('partial payment on time → PARTIALLY_PAID', () => {
    expect(determinePaymentStatus(999, amount, onTime, dueDate)).toBe('PARTIALLY_PAID')
  })

  test('partial payment after due date → PARTIALLY_PAID (partial takes priority over timing)', () => {
    expect(determinePaymentStatus(1, amount, late, dueDate)).toBe('PARTIALLY_PAID')
  })

  test('payment of 0 → PARTIALLY_PAID', () => {
    // 0 < amount → partial, even if on time
    expect(determinePaymentStatus(0, amount, onTime, dueDate)).toBe('PARTIALLY_PAID')
  })

  test('payment above installment amount on time → PAID', () => {
    // overpayment — amount >= installmentAmount so not partial
    expect(determinePaymentStatus(1500, amount, onTime, dueDate)).toBe('PAID')
  })
})
