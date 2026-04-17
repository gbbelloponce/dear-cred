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
  frequency: z.enum(['DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY']),
  startDate: z.string().datetime(),
  type: z.enum(['CASH', 'PRODUCT']).default('CASH'),
  productName: z.string().min(1).optional(),
  productDescription: z.string().optional(),
})

const loans = new Hono<AppEnv>()

loans.use('/clients/:id/loans', authMiddleware)
loans.use('/loans/:id', authMiddleware)
loans.use('/loans/:id/nullify', authMiddleware)
loans.use('/loans/:id/freeze', authMiddleware)
loans.use('/loans/:id/unfreeze', authMiddleware)

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

  if (body.type === 'PRODUCT' && !body.productName) {
    throw new HTTPException(400, { message: 'productName is required for PRODUCT loans' })
  }

  const activeLoan = await prisma.loan.findFirst({
    where: { clientId, type: body.type, status: { in: ['ACTIVE', 'OVERDUE', 'FROZEN'] }, client: { userId: c.get('user').id } },
  })
  if (activeLoan) {
    throw new HTTPException(409, { message: 'Client already has an active loan of this type' })
  }

  const totalAmount = body.principal * (1 + body.interestRate / 100)
  const installmentAmount = totalAmount / body.installmentCount
  const startDate = new Date(body.startDate)
  const dueDates = computeDueDates(startDate, body.installmentCount, body.frequency)

  const loan = await prisma.loan.create({
    data: {
      clientId,
      type: body.type,
      principal: body.principal,
      interestRate: body.interestRate,
      totalAmount,
      installmentAmount,
      installmentCount: body.installmentCount,
      frequency: body.frequency,
      startDate,
      ...(body.type === 'PRODUCT' ? { productName: body.productName, productDescription: body.productDescription ?? null } : {}),
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

  if (!['ACTIVE', 'OVERDUE', 'FROZEN'].includes(loan.status)) {
    throw new HTTPException(409, { message: 'Only ACTIVE, OVERDUE, or FROZEN loans can be nullified' })
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

loans.post('/loans/:id/freeze', async (c) => {
  const id = c.req.param('id')
  const loan = await prisma.loan.findFirstOrThrow({ where: { id, client: { userId: c.get('user').id } } })

  if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') {
    throw new HTTPException(409, { message: 'Only ACTIVE or OVERDUE loans can be frozen' })
  }

  const updated = await prisma.loan.update({ where: { id }, data: { status: 'FROZEN' } })
  return c.json(updated)
})

loans.post('/loans/:id/unfreeze', async (c) => {
  const id = c.req.param('id')
  const loan = await prisma.loan.findFirstOrThrow({
    where: { id, client: { userId: c.get('user').id } },
    include: { installments: { select: { status: true } } },
  })

  if (loan.status !== 'FROZEN') {
    throw new HTTPException(409, { message: 'Only FROZEN loans can be unfrozen' })
  }

  const hasOverdue = loan.installments.some((i) => i.status === 'OVERDUE')
  const updated = await prisma.loan.update({
    where: { id },
    data: { status: hasOverdue ? 'OVERDUE' : 'ACTIVE' },
  })
  return c.json(updated)
})

export default loans
