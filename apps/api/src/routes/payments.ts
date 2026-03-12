import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
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

  // Recalculate installment status from remaining non-voided payments
  const remaining = installment.payments.filter((p) => p.id !== id && !p.isVoided)
  const sum = remaining.reduce((acc, p) => acc + p.amount, 0)

  let newStatus: string
  if (sum <= 0) {
    newStatus = installment.dueDate < now ? 'OVERDUE' : 'PENDING'
  } else if (sum < installment.amount) {
    newStatus = 'PARTIALLY_PAID'
  } else {
    const latestPayment = remaining.sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    )[0]
    newStatus = new Date(latestPayment.paymentDate) <= installment.dueDate ? 'PAID' : 'LATE_PAID'
  }

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
