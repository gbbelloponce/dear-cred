import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { errorHandler } from './middleware/error.ts'
import auth from './routes/auth.ts'
import clients from './routes/clients.ts'
import loans from './routes/loans.ts'
import installments from './routes/installments.ts'
import dashboard from './routes/dashboard.ts'
import internal from './routes/internal.ts'
import payments from './routes/payments.ts'

const app = new Hono()

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',')
const vercelPreviewPattern = process.env.CORS_VERCEL_PATTERN
  ? new RegExp(process.env.CORS_VERCEL_PATTERN)
  : null

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) return origin
      if (vercelPreviewPattern?.test(origin)) return origin
      return null
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

app.route('/auth', auth)
app.route('/', clients)
app.route('/', loans)
app.route('/installments', installments)
app.route('/payments', payments)
app.route('/dashboard', dashboard)
app.route('/internal', internal)

app.onError(errorHandler)

export default {
  port: parseInt(process.env.PORT ?? '3000'),
  fetch: app.fetch,
}
