type PaymentLike = { id: string; amount: number; isVoided: boolean; paymentDate: Date | string }

export function recalculateStatusAfterVoid(
  payments: PaymentLike[],
  voidedId: string,
  installmentAmount: number,
  dueDate: Date,
  now: Date,
): 'OVERDUE' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'LATE_PAID' {
  const remaining = payments.filter((p) => p.id !== voidedId && !p.isVoided)
  const sum = remaining.reduce((acc, p) => acc + p.amount, 0)

  if (sum <= 0) {
    return dueDate < now ? 'OVERDUE' : 'PENDING'
  }
  if (sum < Math.round(installmentAmount * 100) / 100) {
    return 'PARTIALLY_PAID'
  }
  const latest = remaining.sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
  )[0]
  return new Date(latest.paymentDate) <= dueDate ? 'PAID' : 'LATE_PAID'
}

export function determinePaymentStatus(
  amount: number,
  installmentAmount: number,
  effectiveDate: Date,
  dueDate: Date,
): 'PAID' | 'LATE_PAID' | 'PARTIALLY_PAID' {
  if (amount < Math.round(installmentAmount * 100) / 100) return 'PARTIALLY_PAID'
  if (effectiveDate > dueDate) return 'LATE_PAID'
  return 'PAID'
}
