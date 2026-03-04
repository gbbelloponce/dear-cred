import { createClient } from '@supabase/supabase-js'
import { HTTPException } from 'hono/http-exception'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../lib/types.ts'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) throw new HTTPException(401, { message: 'Missing token' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new HTTPException(401, { message: 'Invalid token' })

  c.set('user', data.user)
  await next()
}
