import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { appendPenaltyInstallment, checkLoanCompletion } from '../lib/loanService.ts'
import type { AppEnv } from '../lib/types.ts'

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'TRANSFER']),
})

const installments = new Hono<AppEnv>()

installments.use('/:id/payments', authMiddleware)
installments.use('/:id/resolve', authMiddleware)

installments.post('/:id/payments', zValidator('json', paymentSchema), async (c) => {
  const id = c.req.param('id')
  const { amount, method } = c.req.valid('json')

  const installment = await prisma.installment.findUniqueOrThrow({
    where: { id },
    include: {
      payments: true,
      loan: { select: { id: true, installmentAmount: true, frequency: true } },
    },
  })

  if (installment.status === 'PAID' || installment.status === 'LATE_PAID') {
    throw new HTTPException(409, { message: 'Installment is already paid' })
  }

  if (installment.status === 'PARTIALLY_PAID') {
    throw new HTTPException(409, { message: 'Use /resolve to pay the remaining balance' })
  }

  const now = new Date()
  const isOverdue = now > installment.dueDate
  const isPartial = amount < installment.amount

  let newStatus: 'PAID' | 'LATE_PAID' | 'PARTIALLY_PAID'
  if (isPartial) {
    newStatus = 'PARTIALLY_PAID'
  } else if (isOverdue) {
    newStatus = 'LATE_PAID'
  } else {
    newStatus = 'PAID'
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { installmentId: id, amount, method, paymentDate: now },
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
      )
    }
  })

  if (newStatus === 'PAID' || newStatus === 'LATE_PAID') {
    await checkLoanCompletion(installment.loan.id)
  }

  return c.json({ success: true, status: newStatus })
})

installments.patch('/:id/resolve', async (c) => {
  const id = c.req.param('id')

  const installment = await prisma.installment.findUniqueOrThrow({
    where: { id },
    include: {
      payments: true,
      loan: { select: { id: true } },
    },
  })

  if (installment.status !== 'PARTIALLY_PAID') {
    throw new HTTPException(409, { message: 'Installment is not partially paid' })
  }

  const paid = installment.payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = installment.amount - paid

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        installmentId: id,
        amount: remaining,
        method: 'CASH',
        paymentDate: new Date(),
      },
    })
    await tx.installment.update({
      where: { id },
      data: { status: 'LATE_PAID' },
    })
  })

  await checkLoanCompletion(installment.loan.id)

  return c.json({ success: true, status: 'LATE_PAID' })
})

export default installments
