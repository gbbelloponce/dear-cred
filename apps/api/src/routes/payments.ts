import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { recalculateStatusAfterVoid } from '../lib/paymentUtils.ts'
import type { AppEnv } from '../lib/types.ts'

const payments = new Hono<AppEnv>()

payments.use('/:id/void', authMiddleware)

payments.post('/:id/void', async (c) => {
  const id = c.req.param('id')

  const payment = await prisma.payment.findFirstOrThrow({
    where: { id, installment: { loan: { client: { userId: c.get('user').id } } } },
    include: {
      installment: {
        include: {
          loan: { select: { id: true, status: true } },
          payments: true,
        },
      },
    },
  })

  if (payment.isVoided) {
    throw new HTTPException(409, { message: 'Payment is already voided' })
  }

  if (payment.installment.loan.status === 'COMPLETED' || payment.installment.loan.status === 'NULLIFIED') {
    throw new HTTPException(409, { message: 'Cannot void a payment on a completed or nullified loan' })
  }

  const installment = payment.installment
  const now = new Date()

  await prisma.payment.update({ where: { id }, data: { isVoided: true } })

  const newStatus = recalculateStatusAfterVoid(
    installment.payments,
    id,
    installment.amount,
    installment.dueDate,
    now,
  )

  await prisma.installment.update({
    where: { id: installment.id },
    data: { status: newStatus as never },
  })

  // If installment reverted to OVERDUE, update loan status
  if (newStatus === 'OVERDUE' && installment.loan.status !== 'NULLIFIED') {
    await prisma.loan.update({
      where: { id: installment.loan.id },
      data: { status: 'OVERDUE' },
    })
  }

  return c.json({ success: true })
})

export default payments
