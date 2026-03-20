import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { appendPenaltyInstallment, checkLoanCompletion, restoreActiveLoanStatus } from '../lib/loanService.ts'
import { determinePaymentStatus } from '../lib/paymentUtils.ts'
import type { AppEnv } from '../lib/types.ts'

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'TRANSFER']),
  paymentDate: z.string().datetime().optional(),
})

const resolveSchema = z.object({
  method: z.enum(['CASH', 'TRANSFER']).optional(),
  paymentDate: z.string().datetime().optional(),
})

const installments = new Hono<AppEnv>()

installments.use('/:id/payments', authMiddleware)
installments.use('/:id/resolve', authMiddleware)

installments.post('/:id/payments', zValidator('json', paymentSchema), async (c) => {
  const id = c.req.param('id')
  const { amount, method, paymentDate } = c.req.valid('json')

  const installment = await prisma.installment.findFirstOrThrow({
    where: { id, loan: { client: { userId: c.get('user').id } } },
    include: {
      payments: true,
      loan: { select: { id: true, installmentAmount: true, frequency: true, status: true } },
    },
  })

  if (installment.loan.status === 'NULLIFIED') {
    throw new HTTPException(409, { message: 'Cannot register a payment on a nullified loan' })
  }

  if (installment.status === 'PAID' || installment.status === 'LATE_PAID') {
    throw new HTTPException(409, { message: 'Installment is already paid' })
  }

  if (installment.status === 'PARTIALLY_PAID') {
    throw new HTTPException(409, { message: 'Use /resolve to pay the remaining balance' })
  }

  const effectiveDate = paymentDate ? new Date(paymentDate) : new Date()
  const newStatus = determinePaymentStatus(amount, installment.amount, effectiveDate, installment.dueDate)

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { installmentId: id, amount, method, paymentDate: effectiveDate },
    })
    await tx.installment.update({
      where: { id },
      data: { status: newStatus },
    })
    if (newStatus === 'PARTIALLY_PAID') {
      await appendPenaltyInstallment(
        tx,
        installment.loan.id,
        installment.loan.installmentAmount,
        installment.loan.frequency,
        id,
      )
    }
    if (newStatus === 'LATE_PAID') {
      const existingPenalty = await tx.installment.findFirst({
        where: { loanId: installment.loan.id, penaltySourceId: id },
      })
      if (!existingPenalty) {
        await appendPenaltyInstallment(
          tx,
          installment.loan.id,
          installment.loan.installmentAmount,
          installment.loan.frequency,
          id,
        )
      }
    }
  })

  if (newStatus === 'PAID' || newStatus === 'LATE_PAID') {
    await checkLoanCompletion(installment.loan.id)
    await restoreActiveLoanStatus(installment.loan.id)
  }

  return c.json({ success: true, status: newStatus })
})

installments.patch('/:id/resolve', zValidator('json', resolveSchema), async (c) => {
  const id = c.req.param('id')
  const { method, paymentDate } = c.req.valid('json')

  const installment = await prisma.installment.findFirstOrThrow({
    where: { id, loan: { client: { userId: c.get('user').id } } },
    include: {
      payments: true,
      loan: { select: { id: true } },
    },
  })

  if (installment.status !== 'PARTIALLY_PAID') {
    throw new HTTPException(409, { message: 'Installment is not partially paid' })
  }

  const paid = installment.payments.filter((p) => !p.isVoided).reduce((sum, p) => sum + p.amount, 0)
  const remaining = installment.amount - paid
  const effectiveDate = paymentDate ? new Date(paymentDate) : new Date()

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        installmentId: id,
        amount: remaining,
        method: method ?? 'CASH',
        paymentDate: effectiveDate,
      },
    })
    await tx.installment.update({
      where: { id },
      data: { status: 'LATE_PAID' },
    })
  })

  await checkLoanCompletion(installment.loan.id)
  await restoreActiveLoanStatus(installment.loan.id)

  return c.json({ success: true, status: 'LATE_PAID' })
})

installments.use('/:id', authMiddleware)

installments.delete('/:id', async (c) => {
  const id = c.req.param('id')

  const installment = await prisma.installment.findFirstOrThrow({
    where: { id, loan: { client: { userId: c.get('user').id } } },
    include: { loan: { select: { id: true, status: true } } },
  })

  if (!installment.isPenalty)
    throw new HTTPException(409, { message: 'Only penalty installments can be deleted' })
  if (installment.status !== 'PENDING')
    throw new HTTPException(409, { message: 'Only PENDING penalty installments can be deleted' })
  if (installment.loan.status === 'NULLIFIED' || installment.loan.status === 'COMPLETED')
    throw new HTTPException(409, { message: 'Cannot modify installments on a completed or nullified loan' })

  await prisma.$transaction(async (tx) => {
    await tx.installment.delete({ where: { id } })
    await tx.installment.updateMany({
      where: { loanId: installment.loanId, number: { gt: installment.number } },
      data: { number: { decrement: 1 } },
    })
  })

  await restoreActiveLoanStatus(installment.loan.id)
  await checkLoanCompletion(installment.loan.id)

  return c.json({ success: true })
})

export default installments
