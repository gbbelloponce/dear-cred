import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type DashboardData } from '@/services/api'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n)
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch(() => setError('No se pudieron cargar los datos.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-muted-foreground">Cargando...</p></main>
  if (error || !data) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-destructive">{error}</p></main>

  const cashTotal = data.cashVsTransfer['CASH'] ?? 0
  const transferTotal = data.cashVsTransfer['TRANSFER'] ?? 0

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total adeudado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(data.totalOwed)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cobrado este mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(data.collectedThisMonth)}</p>
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
            Efectivo vs Transferencia (total)
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
                {data.debtPerClient.map((row) => (
                  <tr key={row.loanId} className="border-b last:border-0">
                    <td className="px-4 py-2">{row.clientName}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(row.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
