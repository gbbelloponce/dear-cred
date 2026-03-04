import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
import type { AppEnv } from '../lib/types.ts'

const createClientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  dni: z.string().min(1),
  notes: z.string().optional(),
})

const clients = new Hono<AppEnv>()

clients.use('/clients/*', authMiddleware)

clients.get('/clients', async (c) => {
  const data = await prisma.client.findMany({
    orderBy: { lastName: 'asc' },
    include: {
      loans: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: {
          installments: {
            where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
            select: { id: true, status: true, dueDate: true, amount: true },
          },
        },
      },
    },
  })

  return c.json(data)
})

clients.post('/clients', zValidator('json', createClientSchema), async (c) => {
  const body = c.req.valid('json')
  const client = await prisma.client.create({ data: body })
  return c.json(client, 201)
})

clients.get('/clients/:id', async (c) => {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: c.req.param('id') },
    include: {
      loans: {
        orderBy: { createdAt: 'desc' },
        include: {
          installments: {
            orderBy: { number: 'asc' },
            include: { payments: { orderBy: { paymentDate: 'asc' } } },
          },
        },
      },
    },
  })

  return c.json(client)
})

clients.put('/clients/:id', zValidator('json', createClientSchema.partial()), async (c) => {
  const body = c.req.valid('json')
  const client = await prisma.client.update({
    where: { id: c.req.param('id') },
    data: body,
  })
  return c.json(client)
})

export default clients
