import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { computeDueDates } from '../lib/dateUtils.ts'
import type { AppEnv } from '../lib/types.ts'

const createLoanSchema = z.object({
  principal: z.number().positive(),
  interestRate: z.number().min(0),
  installmentCount: z.number().int().positive(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  startDate: z.string().datetime(),
})

const loans = new Hono<AppEnv>()

loans.use('/clients/:id/loans', authMiddleware)
loans.use('/loans/:id', authMiddleware)
loans.use('/loans/:id/nullify', authMiddleware)

loans.get('/clients/:id/loans', async (c) => {
  const data = await prisma.loan.findMany({
    where: { clientId: c.req.param('id'), client: { userId: c.get('user').id } },
    orderBy: { createdAt: 'desc' },
    include: {
      installments: {
        orderBy: { number: 'asc' },
        include: { payments: { orderBy: { paymentDate: 'asc' } } },
      },
    },
  })
  return c.json(data)
})

loans.post('/clients/:id/loans', zValidator('json', createLoanSchema), async (c) => {
  const clientId = c.req.param('id')
  const body = c.req.valid('json')

  const activeLoan = await prisma.loan.findFirst({
    where: { clientId, status: { in: ['ACTIVE', 'OVERDUE'] }, client: { userId: c.get('user').id } },
  })
  if (activeLoan) {
    throw new HTTPException(409, { message: 'Client already has an active loan' })
  }

  const totalAmount = body.principal * (1 + body.interestRate / 100)
  const installmentAmount = totalAmount / body.installmentCount
  const startDate = new Date(body.startDate)
  const dueDates = computeDueDates(startDate, body.installmentCount, body.frequency)

  const loan = await prisma.loan.create({
    data: {
      clientId,
      principal: body.principal,
      interestRate: body.interestRate,
      totalAmount,
      installmentAmount,
      installmentCount: body.installmentCount,
      frequency: body.frequency,
      startDate,
      installments: {
        create: dueDates.map((dueDate, i) => ({
          number: i + 1,
          dueDate,
          amount: installmentAmount,
        })),
      },
    },
    include: {
      installments: { orderBy: { number: 'asc' } },
    },
  })

  return c.json(loan, 201)
})

loans.get('/loans/:id', async (c) => {
  const loan = await prisma.loan.findFirstOrThrow({
    where: { id: c.req.param('id'), client: { userId: c.get('user').id } },
    include: {
      client: true,
      installments: {
        orderBy: { number: 'asc' },
        include: { payments: { orderBy: { paymentDate: 'asc' } } },
      },
    },
  })
  return c.json(loan)
})

const nullifySchema = z.object({
  voidPayments: z.boolean().optional(),
})

loans.post('/loans/:id/nullify', zValidator('json', nullifySchema), async (c) => {
  const id = c.req.param('id')
  const { voidPayments } = c.req.valid('json')

  const loan = await prisma.loan.findFirstOrThrow({ where: { id, client: { userId: c.get('user').id } } })

  if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') {
    throw new HTTPException(409, { message: 'Only ACTIVE or OVERDUE loans can be nullified' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (voidPayments) {
      await tx.payment.updateMany({
        where: { isVoided: false, installment: { loanId: id } },
        data: { isVoided: true },
      })
    }
    return tx.loan.update({ where: { id }, data: { status: 'NULLIFIED' } })
  })

  return c.json(updated)
})

export default loans
