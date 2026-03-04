import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const auth = new Hono()

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    return c.json({ error: error?.message ?? 'Login failed' }, 401)
  }

  return c.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: data.user,
  })
})

auth.post('/logout', (c) => {
  return c.json({ success: true })
})

export default auth
