import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type ClientSummary } from '@/services/api'

const LOAN_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  OVERDUE: 'En mora',
  COMPLETED: 'Finalizado',
}

const LOAN_STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'secondary'> = {
  ACTIVE: 'default',
  OVERDUE: 'destructive',
  COMPLETED: 'secondary',
}

export default function Clientes() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getClients()
      .then(setClients)
      .catch(() => setError('No se pudieron cargar los clientes.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Button size="sm" onClick={() => navigate('/clientes/nuevo')}>
          Nuevo cliente
        </Button>
      </div>
      {loading && <p className="text-muted-foreground">Cargando...</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && clients.length === 0 && (
        <p className="text-muted-foreground">No hay clientes registrados.</p>
      )}
      {!loading && !error && clients.length > 0 && (
        <ul className="flex flex-col gap-2">
          {clients.map((client) => {
            const activeLoan = client.loans[0] ?? null
            return (
              <li
                key={client.id}
                className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/clientes/${client.id}`)}
              >
                <div className="flex-shrink-0 text-muted-foreground">
                  <HugeiconsIcon icon={UserIcon} size={20} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {client.lastName}, {client.firstName}
                  </p>
                  <p className="text-sm text-muted-foreground">DNI {client.dni}</p>
                </div>
                {activeLoan && (
                  <Badge variant={LOAN_STATUS_VARIANT[activeLoan.status] ?? 'secondary'}>
                    {LOAN_STATUS_LABEL[activeLoan.status] ?? activeLoan.status}
                  </Badge>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
