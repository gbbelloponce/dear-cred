import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, type ClientDetail, type LoanWithInstallments, type Installment, type PaymentMethod } from '@/services/api'

const FREQ_LABEL: Record<string, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  PARTIALLY_PAID: 'Pago parcial',
  LATE_PAID: 'Pagada tarde',
  OVERDUE: 'Vencida',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PAID: 'default',
  PARTIALLY_PAID: 'outline',
  LATE_PAID: 'secondary',
  OVERDUE: 'destructive',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR')
}

function paidAmount(inst: Installment) {
  return inst.payments.reduce((s, p) => s + p.amount, 0)
}

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit client
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', address: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Payment form
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH')
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  function load() {
    if (!id) return
    api
      .getClient(id)
      .then((c) => {
        setClient(c)
        setEditForm({
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          address: c.address,
          notes: c.notes ?? '',
        })
      })
      .catch(() => setError('No se pudo cargar el cliente.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setEditError(null)
    setSaving(true)
    try {
      await api.updateClient(id, { ...editForm, notes: editForm.notes || undefined })
      await api.getClient(id).then((c) => setClient(c))
      setEditing(false)
    } catch {
      setEditError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function startPaying(inst: Installment) {
    setPayingId(inst.id)
    setPayAmount('')
    setPayMethod('CASH')
    setPayError(null)
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault()
    if (!payingId) return
    setPayError(null)
    setPayLoading(true)
    try {
      await api.createPayment(payingId, { amount: parseFloat(payAmount), method: payMethod })
      setPayingId(null)
      setLoading(true)
      load()
    } catch {
      setPayError('No se pudo registrar el pago. Intentá de nuevo.')
    } finally {
      setPayLoading(false)
    }
  }

  async function handleResolve(installmentId: string) {
    try {
      await api.resolveInstallment(installmentId)
      setLoading(true)
      load()
    } catch {
      // show nothing — silent reload failure is fine here
    }
  }

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-muted-foreground">Cargando...</p></main>
  if (error || !client) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-destructive">{error}</p></main>

  const activeLoan: LoanWithInstallments | undefined = client.loans.find(
    (l) => l.status === 'ACTIVE' || l.status === 'OVERDUE',
  )
  const pastLoans = client.loans.filter((l) => l.status === 'COMPLETED')

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
          ← Volver
        </Button>
        <h1 className="text-xl font-semibold">
          {client.lastName}, {client.firstName}
        </h1>
      </div>

      {/* Client info card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Datos del cliente</CardTitle>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Nombre</Label>
                  <Input
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Apellido</Label>
                  <Input
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Dirección</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notas</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                />
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">DNI</dt>
                <dd>{client.dni}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Teléfono</dt>
                <dd>{client.phone}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Dirección</dt>
                <dd>{client.address}</dd>
              </div>
              {client.notes && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Notas</dt>
                  <dd>{client.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Active loan */}
      {activeLoan ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Préstamo activo</CardTitle>
              <Badge variant={activeLoan.status === 'OVERDUE' ? 'destructive' : 'default'}>
                {activeLoan.status === 'OVERDUE' ? 'En mora' : 'Activo'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital</span>
                <span>{fmt(activeLoan.principal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span>{fmt(activeLoan.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frecuencia</span>
                <span>{FREQ_LABEL[activeLoan.frequency]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inicio</span>
                <span>{fmtDate(activeLoan.startDate)}</span>
              </div>
            </div>

            <Separator />

            {/* Payment form */}
            {payingId && (
              <div className="rounded-lg border bg-muted/30 p-4">
                {(() => {
                  const inst = activeLoan.installments.find((i) => i.id === payingId)
                  if (!inst) return null
                  const remaining = inst.amount - paidAmount(inst)
                  return (
                    <form onSubmit={handlePay} className="flex flex-col gap-3">
                      <p className="text-sm font-medium">
                        Cuota #{inst.number} — Registrar pago
                        {inst.status === 'PARTIALLY_PAID' && (
                          <span className="text-muted-foreground ml-1">(restante: {fmt(remaining)})</span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label>Monto</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={inst.amount}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Método</Label>
                          <Select value={payMethod} onValueChange={(v) => setPayMethod(v as PaymentMethod)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Efectivo</SelectItem>
                              <SelectItem value="TRANSFER">Transferencia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {payError && <p className="text-sm text-destructive">{payError}</p>}
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setPayingId(null)}>
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm" disabled={payLoading}>
                          {payLoading ? 'Registrando...' : 'Registrar'}
                        </Button>
                      </div>
                    </form>
                  )
                })()}
              </div>
            )}

            {/* Installment table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Vencimiento</th>
                    <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Monto</th>
                    <th className="text-center py-2 pr-3 font-medium text-muted-foreground">Estado</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoan.installments.map((inst) => (
                    <tr key={inst.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground">
                        {inst.number}
                        {inst.isPenalty && <span className="text-destructive ml-0.5">*</span>}
                      </td>
                      <td className="py-2 pr-3">{fmtDate(inst.dueDate)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(inst.amount)}</td>
                      <td className="py-2 pr-3 text-center">
                        <Badge variant={STATUS_VARIANT[inst.status] ?? 'secondary'}>
                          {STATUS_LABEL[inst.status] ?? inst.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {(inst.status === 'PENDING' || inst.status === 'OVERDUE') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startPaying(inst)}
                            disabled={payingId === inst.id}
                          >
                            Registrar pago
                          </Button>
                        )}
                        {inst.status === 'PARTIALLY_PAID' && (
                          <Button variant="outline" size="sm" onClick={() => handleResolve(inst.id)}>
                            Saldar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">* Cuota de penalidad</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-muted-foreground text-sm">Sin préstamo activo</p>
            <Button size="sm" onClick={() => navigate(`/clientes/${client.id}/prestamo/nuevo`)}>
              Nuevo préstamo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loan history */}
      {pastLoans.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historial de préstamos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pastLoans.map((loan) => (
              <div key={loan.id} className="rounded-lg border px-4 py-3 text-sm flex justify-between items-center">
                <div>
                  <p className="font-medium">{fmtDate(loan.startDate)}</p>
                  <p className="text-muted-foreground">
                    {fmt(loan.principal)} · {loan.installmentCount} cuotas · {FREQ_LABEL[loan.frequency]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{fmt(loan.totalAmount)}</p>
                  <Badge variant="secondary">Finalizado</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
