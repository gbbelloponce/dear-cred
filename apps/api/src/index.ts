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

app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
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
