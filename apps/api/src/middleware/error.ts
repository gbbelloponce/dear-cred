import { HTTPException } from 'hono/http-exception'
import type { ErrorHandler } from 'hono'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }

  // Prisma unique constraint violation
  if ((err as any)?.code === 'P2002') {
    return c.json({ error: 'Resource already exists' }, 409)
  }

  // Prisma record not found
  if ((err as any)?.code === 'P2025') {
    return c.json({ error: 'Resource not found' }, 404)
  }

  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
}
