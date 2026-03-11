import { Hono } from 'hono'
import { prisma } from '../shared/db/index.ts'
import { appendPenaltyInstallment } from '../lib/loanService.ts'

const internal = new Hono()

internal.post('/process-overdue', async (c) => {
  const secret = c.req.header('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json().catch(() => ({}))
  const now = body.asOf ? new Date(body.asOf) : new Date()

  const overdueInstallments = await prisma.installment.findMany({
    where: { status: 'PENDING', dueDate: { lt: now }, loan: { status: { notIn: ['NULLIFIED'] } } },
    include: {
      loan: { select: { id: true, installmentAmount: true, frequency: true, status: true } },
    },
  })

  await prisma.$transaction(async (tx) => {
    for (const installment of overdueInstallments) {
      await tx.installment.update({
        where: { id: installment.id },
        data: { status: 'OVERDUE' },
      })

      await appendPenaltyInstallment(
        tx,
        installment.loan.id,
        installment.loan.installmentAmount,
        installment.loan.frequency,
        installment.id,
      )

      if (installment.loan.status !== 'OVERDUE') {
        await tx.loan.update({
          where: { id: installment.loan.id },
          data: { status: 'OVERDUE' },
        })
      }
    }
  })

  return c.json({ processed: overdueInstallments.length })
})

export default internal
