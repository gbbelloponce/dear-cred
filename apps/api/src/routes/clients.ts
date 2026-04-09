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
  const userId = c.get('user').id
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const data = await prisma.client.findMany({
    where: { userId, ...(includeDeleted ? {} : { deletedAt: null }) },
    orderBy: { lastName: 'asc' },
    include: {
      loans: {
        where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
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
  const userId = c.get('user').id
  const client = await prisma.client.create({ data: { ...body, userId } })
  return c.json(client, 201)
})

clients.get('/clients/:id', async (c) => {
  const client = await prisma.client.findFirstOrThrow({
    where: { id: c.req.param('id'), userId: c.get('user').id },
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
  const id = c.req.param('id')
  const body = c.req.valid('json')
  await prisma.client.findFirstOrThrow({ where: { id, userId: c.get('user').id } })
  const client = await prisma.client.update({ where: { id }, data: body })
  return c.json(client)
})

clients.delete('/clients/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('user').id

  const client = await prisma.client.findFirstOrThrow({ where: { id, userId } })

  if (client.deletedAt) {
    return c.json({ error: 'Client is already deleted' }, 409)
  }

  const activeLoan = await prisma.loan.findFirst({
    where: { clientId: id, status: { in: ['ACTIVE', 'OVERDUE'] } },
  })
  if (activeLoan) {
    return c.json({ error: 'El cliente tiene un préstamo activo. Anúlelo antes de eliminar el cliente.' }, 409)
  }

  const updated = await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } })
  return c.json(updated)
})

export default clients
