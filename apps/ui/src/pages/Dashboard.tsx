import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar01Icon } from '@hugeicons/core-free-icons'
import { api, type DashboardData } from '@/services/api'

const DEBT_PAGE_SIZE = 8

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n)
}

function defaultFrom() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function DatePicker({ value, onChange, label }: { value: Date; onChange: (d: Date) => void; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-36 justify-start font-normal">
            <HugeiconsIcon icon={Calendar01Icon} size={14} className="mr-2" />
            {value.toLocaleDateString('es-AR')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              if (d) {
                onChange(d)
                setOpen(false)
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debtPage, setDebtPage] = useState(1)
  const [from, setFrom] = useState<Date>(defaultFrom)
  const [to, setTo] = useState<Date>(new Date())

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .getDashboard({ from, to })
      .then(setData)
      .catch(() => setError('No se pudieron cargar los datos.'))
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-muted-foreground">Cargando...</p></main>
  if (error || !data) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-destructive">{error}</p></main>

  const cashTotal = data.cashVsTransfer['CASH'] ?? 0
  const transferTotal = data.cashVsTransfer['TRANSFER'] ?? 0

  const debtTotalPages = Math.max(1, Math.ceil(data.debtPerClient.length / DEBT_PAGE_SIZE))
  const debtCurrentPage = Math.min(debtPage, debtTotalPages)
  const paginatedDebt = data.debtPerClient.slice(
    (debtCurrentPage - 1) * DEBT_PAGE_SIZE,
    debtCurrentPage * DEBT_PAGE_SIZE,
  )

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Dashboard</h1>

      <div className="flex gap-4 mb-6">
        <DatePicker value={from} onChange={setFrom} label="Desde" />
        <DatePicker value={to} onChange={setTo} label="Hasta" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total adeudado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(data.totalOwed)}</p>
            {(data.owedByType?.CASH > 0 || data.owedByType?.PRODUCT > 0) && (
              <div className="flex gap-3 mt-1">
                {data.owedByType?.CASH > 0 && (
                  <p className="text-xs text-muted-foreground">Préstamos: {fmt(data.owedByType.CASH)}</p>
                )}
                {data.owedByType?.PRODUCT > 0 && (
                  <p className="text-xs text-muted-foreground">Ventas: {fmt(data.owedByType.PRODUCT)}</p>
                )}
              </div>
            )}
            {data.totalOwed > 0 && (
              <div className="flex gap-3 mt-1">
                <p className="text-xs text-muted-foreground">Capital: {fmt(data.totalPrincipalOwed)}</p>
                <p className="text-xs text-muted-foreground">Interés: {fmt(data.totalOwed - data.totalPrincipalOwed)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cobrado en el período</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(data.collected)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Puntualidad</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.onTimeRate}%</p>
            <p className="text-xs text-muted-foreground">de clientes activos al día</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes en mora</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.overdueClients.length}</p>
            {data.overdueClients.length > 0 && (
              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {data.overdueClients.map((c) => (
                  <li key={c.id}>
                    {c.lastName}, {c.firstName}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Efectivo vs Transferencia (período)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-8">
          <div>
            <p className="text-lg font-semibold">{fmt(cashTotal)}</p>
            <p className="text-xs text-muted-foreground">Efectivo</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{fmt(transferTotal)}</p>
            <p className="text-xs text-muted-foreground">Transferencia</p>
          </div>
        </CardContent>
      </Card>

      {data.debtPerClient.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deuda por cliente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Saldo pendiente</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDebt.map((row) => (
                  <tr key={row.loanId} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <span>{row.clientName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.type === 'PRODUCT' ? `Venta — ${row.productName}` : 'Préstamo'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <p className="font-medium">{fmt(row.remaining)}</p>
                      <p className="text-xs text-muted-foreground">capital {fmt(row.remainingPrincipal)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {debtTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {data.debtPerClient.length} activos · página {debtCurrentPage} de {debtTotalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={debtCurrentPage === 1}
                    onClick={() => setDebtPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={debtCurrentPage === debtTotalPages}
                    onClick={() => setDebtPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
