import { Hono } from 'hono'
import { prisma } from '../shared/db/index.ts'
import { authMiddleware } from '../middleware/auth.ts'
import type { AppEnv } from '../lib/types.ts'

const dashboard = new Hono<AppEnv>()
const ARGENTINA_UTC_OFFSET_HOURS = 3

function parseArgentinaDateStart(dateInput: string): Date {
  const [year, month, day] = dateInput.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, ARGENTINA_UTC_OFFSET_HOURS, 0, 0, 0))
}

function parseArgentinaDateEnd(dateInput: string): Date {
  const [year, month, day] = dateInput.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1, ARGENTINA_UTC_OFFSET_HOURS - 1, 59, 59, 999))
}

function getArgentinaMonthStart(now: Date): Date {
  const argentinaNow = new Date(now.getTime() - ARGENTINA_UTC_OFFSET_HOURS * 60 * 60 * 1000)

  return new Date(
    Date.UTC(argentinaNow.getUTCFullYear(), argentinaNow.getUTCMonth(), 1, ARGENTINA_UTC_OFFSET_HOURS, 0, 0, 0),
  )
}

dashboard.use('*', authMiddleware)

dashboard.get('/', async (c) => {
  const userId = c.get('user').id
  const now = new Date()
  const fromParam = c.req.query('from')
  const toParam = c.req.query('to')
  const rangeStart = fromParam ? parseArgentinaDateStart(fromParam) : getArgentinaMonthStart(now)
  const rangeEnd = toParam ? parseArgentinaDateEnd(toParam) : now

  const [
    pendingInstallments,
    paymentsInPeriod,
    overdueInstallmentsWithClients,
    allActiveLoans,
    paymentsByMethod,
  ] = await Promise.all([
    // totalOwed: sum of pending balances
    prisma.installment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] },
        loan: { status: { notIn: ['NULLIFIED'] }, client: { userId, deletedAt: null } },
      },
      select: { amount: true, payments: { select: { amount: true, isVoided: true } }, loan: { select: { type: true } } },
    }),

    // collected in period (includes payments from deleted clients — money was received)
    prisma.payment.aggregate({
      where: { paymentDate: { gte: rangeStart, lte: rangeEnd }, isVoided: false, installment: { loan: { client: { userId } } } },
      _sum: { amount: true },
    }),

    // overdueClients
    prisma.installment.findMany({
      where: { status: 'OVERDUE', loan: { status: { notIn: ['NULLIFIED'] }, client: { userId, deletedAt: null } } },
      select: { loan: { select: { client: { select: { id: true, firstName: true, lastName: true } } } } },
    }),

    // for onTimeRate and debtPerClient
    prisma.loan.findMany({
      where: { status: { in: ['ACTIVE', 'OVERDUE', 'FROZEN'] }, client: { userId, deletedAt: null } },
      select: {
        id: true,
        type: true,
        productName: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        installments: {
          select: { status: true, amount: true, payments: { select: { amount: true, isVoided: true } } },
        },
      },
    }),

    // cashVsTransfer in period (includes payments from deleted clients — money was received)
    prisma.payment.groupBy({
      by: ['method'],
      where: { paymentDate: { gte: rangeStart, lte: rangeEnd }, isVoided: false, installment: { loan: { client: { userId } } } },
      _sum: { amount: true },
    }),
  ])

  // totalOwed: for each pending installment, owed = amount - sum(payments)
  const owedByType = { CASH: 0, PRODUCT: 0 }
  const totalOwed = pendingInstallments.reduce((sum, inst) => {
    const paid = inst.payments.filter((p) => !p.isVoided).reduce((s, p) => s + p.amount, 0)
    const owed = inst.amount - paid
    owedByType[inst.loan.type] += owed
    return sum + owed
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
        const paid = i.payments.filter((p) => !p.isVoided).reduce((s, p) => s + p.amount, 0)
        return sum + (i.amount - paid)
      }, 0)

    return {
      clientId: loan.client.id,
      clientName: `${loan.client.firstName} ${loan.client.lastName}`,
      loanId: loan.id,
      type: loan.type,
      productName: loan.productName,
      remaining,
    }
  })

  return c.json({
    totalOwed,
    owedByType,
    collected,
    overdueClients,
    onTimeRate,
    cashVsTransfer,
    debtPerClient,
  })
})

export default dashboard
