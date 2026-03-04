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

loans.get('/clients/:id/loans', async (c) => {
  const data = await prisma.loan.findMany({
    where: { clientId: c.req.param('id') },
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
    where: { clientId, status: 'ACTIVE' },
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
  const loan = await prisma.loan.findUniqueOrThrow({
    where: { id: c.req.param('id') },
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

export default loans
