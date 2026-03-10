import { Hono } from 'hono'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
import type { AppEnv } from '../lib/types.ts'

const dashboard = new Hono<AppEnv>()

dashboard.use('*', authMiddleware)

dashboard.get('/', async (c) => {
  const now = new Date()
  const fromParam = c.req.query('from')
  const toParam = c.req.query('to')
  const rangeStart = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1)
  const rangeEnd = toParam
    ? new Date(`${toParam}T23:59:59.999Z`)
    : now

  const [
    pendingInstallments,
    paymentsInPeriod,
    overdueInstallmentsWithClients,
    allActiveLoans,
    paymentsByMethod,
  ] = await Promise.all([
    // totalOwed: sum of pending balances
    prisma.installment.findMany({
      where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
      select: { amount: true, payments: { select: { amount: true } } },
    }),

    // collected in period
    prisma.payment.aggregate({
      where: { paymentDate: { gte: rangeStart, lte: rangeEnd } },
      _sum: { amount: true },
    }),

    // overdueClients
    prisma.installment.findMany({
      where: { status: 'OVERDUE' },
      select: { loan: { select: { client: { select: { id: true, firstName: true, lastName: true } } } } },
    }),

    // for onTimeRate and debtPerClient
    prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        installments: {
          select: { status: true, amount: true, payments: { select: { amount: true } } },
        },
      },
    }),

    // cashVsTransfer in period
    prisma.payment.groupBy({
      by: ['method'],
      where: { paymentDate: { gte: rangeStart, lte: rangeEnd } },
      _sum: { amount: true },
    }),
  ])

  // totalOwed: for each pending installment, owed = amount - sum(payments)
  const totalOwed = pendingInstallments.reduce((sum, inst) => {
    const paid = inst.payments.reduce((s, p) => s + p.amount, 0)
    return sum + (inst.amount - paid)
  }, 0)

  const collected = paymentsInPeriod._sum.amount ?? 0

  // overdueClients: unique clients
  const overdueMap = new Map<string, { id: string; firstName: string; lastName: string }>()
  for (const inst of overdueInstallmentsWithClients) {
    const client = inst.loan.client
    overdueMap.set(client.id, client)
  }
  const overdueClients = Array.from(overdueMap.values())

  // onTimeRate: % of active-loan clients with no OVERDUE installments
  const overdueClientIds = new Set(overdueClients.map((c) => c.id))
  const totalActiveClients = new Set(allActiveLoans.map((l) => l.client.id)).size
  const onTimeRate =
    totalActiveClients === 0
      ? 100
      : Math.round(((totalActiveClients - overdueClientIds.size) / totalActiveClients) * 100)

  const cashVsTransfer: Record<string, number> = {}
  for (const row of paymentsByMethod) {
    cashVsTransfer[row.method] = row._sum.amount ?? 0
  }

  // debtPerClient: remaining balance per active loan
  const debtPerClient = allActiveLoans.map((loan) => {
    const remaining = loan.installments
      .filter((i) => ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(i.status))
      .reduce((sum, i) => {
        const paid = i.payments.reduce((s, p) => s + p.amount, 0)
        return sum + (i.amount - paid)
      }, 0)

    return {
      clientId: loan.client.id,
      clientName: `${loan.client.firstName} ${loan.client.lastName}`,
      loanId: loan.id,
      remaining,
    }
  })

  return c.json({
    totalOwed,
    collected,
    overdueClients,
    onTimeRate,
    cashVsTransfer,
    debtPerClient,
  })
})

export default dashboard
