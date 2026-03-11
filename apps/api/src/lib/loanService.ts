import { prisma } from '../shared/db/index.ts'
import { computeNextDueDate } from './dateUtils.ts'
import type { Frequency } from '../shared/db/generated/prisma/enums.ts'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function appendPenaltyInstallment(
  tx: TransactionClient,
  loanId: string,
  installmentAmount: number,
  frequency: Frequency,
  sourceInstallmentId?: string,
): Promise<void> {
  const last = await tx.installment.findFirst({
    where: { loanId },
    orderBy: { number: 'desc' },
  })
  if (!last) return

  const nextDueDate = computeNextDueDate(last.dueDate, frequency)

  await tx.installment.create({
    data: {
      loanId,
      number: last.number + 1,
      dueDate: nextDueDate,
      amount: installmentAmount,
      isPenalty: true,
      penaltySourceId: sourceInstallmentId ?? null,
    },
  })
}

export async function checkLoanCompletion(loanId: string): Promise<void> {
  const installments = await prisma.installment.findMany({
    where: { loanId },
    select: { status: true },
  })

  const allDone = installments.every(
    (i) => i.status === 'PAID' || i.status === 'LATE_PAID',
  )

  if (allDone) {
    await prisma.loan.update({
      where: { id: loanId },
      data: { status: 'COMPLETED' },
    })
  }
}

export async function restoreActiveLoanStatus(loanId: string): Promise<void> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { status: true },
  })
  if (loan?.status !== 'OVERDUE') return

  const overdueCount = await prisma.installment.count({
    where: { loanId, status: 'OVERDUE' },
  })

  if (overdueCount === 0) {
    await prisma.loan.update({
      where: { id: loanId },
      data: { status: 'ACTIVE' },
    })
  }
}
