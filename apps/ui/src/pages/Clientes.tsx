import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserIcon, Search01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api, type ClientSummary } from '@/services/api'

const PAGE_SIZE = 10

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
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    api
      .getClients()
      .then(setClients)
      .catch(() => setError('No se pudieron cargar los clientes.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        `${c.lastName} ${c.firstName}`.toLowerCase().includes(q) ||
        c.dni.includes(q),
    )
  }, [clients, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Button size="sm" onClick={() => navigate('/clientes/nuevo')}>
          Nuevo cliente
        </Button>
      </div>

      {!loading && !error && clients.length > 0 && (
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} />
          </span>
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o DNI..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      )}

      {loading && <p className="text-muted-foreground">Cargando...</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && clients.length === 0 && (
        <p className="text-muted-foreground">No hay clientes registrados.</p>
      )}
      {!loading && !error && clients.length > 0 && filtered.length === 0 && (
        <p className="text-muted-foreground">No se encontraron clientes.</p>
      )}
      {!loading && !error && paginated.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {paginated.map((client) => {
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {filtered.length} clientes · página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
