import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
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
  LATE_PAID: 'outline',
  OVERDUE: 'destructive',
}

const STATUS_CLASS: Partial<Record<string, string>> = {
  PARTIALLY_PAID: 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  LATE_PAID: 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`
}

function paidAmount(inst: Installment) {
  return inst.payments.filter((p) => !p.isVoided).reduce((s, p) => s + p.amount, 0)
}

function InstallmentTable({
  loan,
  onStartPaying,
  onStartResolving,
  onVoidPayment,
  onDeleteInstallment,
  allowVoid,
  payingId,
}: {
  loan: LoanWithInstallments
  onStartPaying: (inst: Installment) => void
  onStartResolving: (inst: Installment) => void
  onVoidPayment: (paymentId: string) => void
  onDeleteInstallment: (inst: Installment) => void
  allowVoid: boolean
  payingId?: string | null
}) {
  const [expandedInstIds, setExpandedInstIds] = useState<Set<string>>(new Set())

  function toggleInstallment(instId: string) {
    setExpandedInstIds((prev) => {
      const next = new Set(prev)
      if (next.has(instId)) next.delete(instId)
      else next.add(instId)
      return next
    })
  }

  return (
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
          {loan.installments.map((inst) => {
            const sourceNum = inst.penaltySourceId
              ? loan.installments.find((i) => i.id === inst.penaltySourceId)?.number
              : null
            const hasPayments = inst.payments.length > 0
            const isExpanded = expandedInstIds.has(inst.id)
            return (
              <>
                <tr key={inst.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">
                    <div>{inst.number}{inst.isPenalty && <span className="text-destructive ml-0.5">*</span>}</div>
                    {inst.isPenalty && sourceNum != null && (
                      <div className="text-xs text-muted-foreground">cuota #{sourceNum}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">{fmtDate(inst.dueDate)}</td>
                  <td className="py-2 pr-3 text-right">{fmt(inst.amount)}</td>
                  <td className="py-2 pr-3 text-center">
                    <Badge variant={STATUS_VARIANT[inst.status] ?? 'secondary'} className={STATUS_CLASS[inst.status]}>
                      {STATUS_LABEL[inst.status] ?? inst.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {hasPayments && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={() => toggleInstallment(inst.id)}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver pagos'}
                        </Button>
                      )}
                      {loan.status !== 'COMPLETED' && loan.status !== 'NULLIFIED' && onStartPaying && (inst.status === 'PENDING' || inst.status === 'OVERDUE') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onStartPaying(inst)}
                          disabled={payingId === inst.id}
                        >
                          Registrar pago
                        </Button>
                      )}
                      {loan.status !== 'COMPLETED' && loan.status !== 'NULLIFIED' && onStartResolving && inst.status === 'PARTIALLY_PAID' && (
                        <Button variant="outline" size="sm" onClick={() => onStartResolving(inst)}>
                          Saldar
                        </Button>
                      )}
                      {loan.status !== 'COMPLETED' && loan.status !== 'NULLIFIED' && inst.isPenalty && inst.status === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDeleteInstallment(inst)}
                        >
                          Eliminar penalidad
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && inst.payments.map((p) => (
                  <tr key={p.id} className="bg-muted/30 border-b last:border-0">
                    <td />
                    <td className="py-1.5 pr-3 text-xs text-muted-foreground pl-4" colSpan={1}>
                      <span className={p.isVoided ? 'line-through opacity-50' : ''}>
                        {fmtDate(p.paymentDate)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-xs">
                      <span className={p.isVoided ? 'line-through opacity-50' : ''}>
                        {fmt(p.amount)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-center text-xs">
                      <span className={p.isVoided ? 'opacity-50' : ''}>
                        {p.method === 'CASH' ? 'Efectivo' : 'Transferencia'}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      {allowVoid && !p.isVoided && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => onVoidPayment(p.id)}
                        >
                          Anular pago
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
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
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  // Resolve form
  const [resolveMethod, setResolveMethod] = useState<PaymentMethod>('CASH')
  const [resolveDate, setResolveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null)

  // Nullify loan dialog
  const [nullifyDialog, setNullifyDialog] = useState<{ loanId: string } | null>(null)
  const [nullifyVoidPayments, setNullifyVoidPayments] = useState(false)

  // Expanded past loans
  const [expandedLoanIds, setExpandedLoanIds] = useState<Set<string>>(new Set())

  const mountedRef = useRef(true)

  function load() {
    if (!id) return
    api
      .getClient(id)
      .then((c) => {
        if (!mountedRef.current) return
        setClient(c)
        setEditForm({
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          address: c.address,
          notes: c.notes ?? '',
        })
      })
      .catch(() => { if (mountedRef.current) setError('No se pudo cargar el cliente.') })
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [id])

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
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayError(null)
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault()
    if (!payingId) return
    setPayError(null)
    const inst = client?.loans.flatMap((l) => l.installments).find((i) => i.id === payingId)
    const amount = parseFloat(payAmount)
    if (inst && amount > inst.amount) {
      setPayError(`El monto no puede superar ${fmt(inst.amount)}.`)
      return
    }
    setPayLoading(true)
    try {
      await api.createPayment(payingId, {
        amount,
        method: payMethod,
        paymentDate: new Date(payDate).toISOString(),
      })
      setPayingId(null)
      setLoading(true)
      load()
    } catch {
      setPayError('No se pudo registrar el pago. Intentá de nuevo.')
    } finally {
      setPayLoading(false)
    }
  }

  function startResolving(inst: Installment) {
    setResolvingId(inst.id)
    setResolveMethod('CASH')
    setResolveDate(new Date().toISOString().slice(0, 10))
  }

  async function handleResolve(e: FormEvent) {
    e.preventDefault()
    if (!resolvingId) return
    try {
      await api.resolveInstallment(resolvingId, {
        method: resolveMethod,
        paymentDate: new Date(resolveDate).toISOString(),
      })
      setResolvingId(null)
      setLoading(true)
      load()
    } catch {
      // show nothing — silent reload failure is fine here
    }
  }

  function handleNullifyLoan(loanId: string) {
    setNullifyVoidPayments(false)
    setNullifyDialog({ loanId })
  }

  function handleVoidPayment(paymentId: string) {
    setConfirmDialog({
      message: '¿Anular este pago? El estado de la cuota se recalculará.',
      onConfirm: async () => {
        await api.voidPayment(paymentId)
        setLoading(true)
        load()
      },
    })
  }

  function handleDeleteInstallment(inst: Installment) {
    setConfirmDialog({
      message: `¿Eliminar la penalidad #${inst.number}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        await api.deleteInstallment(inst.id)
        setLoading(true)
        load()
      },
    })
  }

  function togglePastLoan(loanId: string) {
    setExpandedLoanIds((prev) => {
      const next = new Set(prev)
      if (next.has(loanId)) next.delete(loanId)
      else next.add(loanId)
      return next
    })
  }

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-muted-foreground">Cargando...</p></main>
  if (error || !client) return <main className="max-w-3xl mx-auto px-4 py-6"><p className="text-destructive">{error}</p></main>

  const activeLoan: LoanWithInstallments | undefined = client.loans.find(
    (l) => l.status === 'ACTIVE' || l.status === 'OVERDUE',
  )
  const pastLoans = client.loans.filter((l) => l.status === 'COMPLETED' || l.status === 'NULLIFIED')

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
              <div className="flex items-center gap-2">
                <Badge variant={activeLoan.status === 'OVERDUE' ? 'destructive' : 'default'}>
                  {activeLoan.status === 'OVERDUE' ? 'En mora' : 'Activo'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => handleNullifyLoan(activeLoan.id)}
                >
                  Anular préstamo
                </Button>
              </div>
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

            {/* Resolve form */}
            {resolvingId && (
              <div className="rounded-lg border bg-muted/30 p-4">
                {(() => {
                  const inst = activeLoan.installments.find((i) => i.id === resolvingId)
                  if (!inst) return null
                  const paid = paidAmount(inst)
                  const remaining = inst.amount - paid
                  return (
                    <form onSubmit={handleResolve} className="flex flex-col gap-3">
                      <p className="text-sm font-medium">
                        Cuota #{inst.number} — Saldar saldo restante ({fmt(remaining)})
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label>Método</Label>
                          <Select value={resolveMethod} onValueChange={(v) => setResolveMethod(v as PaymentMethod)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Efectivo</SelectItem>
                              <SelectItem value="TRANSFER">Transferencia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Fecha de pago</Label>
                          <Input
                            type="date"
                            value={resolveDate}
                            onChange={(e) => setResolveDate(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setResolvingId(null)}>
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm">
                          Saldar
                        </Button>
                      </div>
                    </form>
                  )
                })()}
              </div>
            )}

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
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground text-left"
                            onClick={() => setPayAmount(inst.amount.toString())}
                          >
                            Completar monto ({fmt(inst.amount)})
                          </button>
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
                      <div className="flex flex-col gap-1.5">
                        <Label>Fecha de pago</Label>
                        <Input
                          type="date"
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          required
                        />
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
            <InstallmentTable
              loan={activeLoan}
              onStartPaying={startPaying}
              onStartResolving={startResolving}
              onVoidPayment={handleVoidPayment}
              onDeleteInstallment={handleDeleteInstallment}
              allowVoid={true}
              payingId={payingId}
            />
            <p className="text-xs text-muted-foreground">* Penalidad — el número debajo indica la cuota que la originó</p>
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

      <AlertDialog open={!!nullifyDialog} onOpenChange={(open) => { if (!open) setNullifyDialog(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este préstamo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-3 px-1 py-2">
            <Checkbox
              id="void-payments"
              checked={nullifyVoidPayments}
              onCheckedChange={(v) => setNullifyVoidPayments(!!v)}
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="void-payments" className="text-sm font-medium cursor-pointer">
                Anular también los pagos registrados
              </label>
              <p className="text-xs text-muted-foreground">
                Los pagos no aparecerán en las estadísticas del dashboard.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await api.nullifyLoan(nullifyDialog!.loanId, { voidPayments: nullifyVoidPayments })
              setNullifyDialog(null)
              setLoading(true)
              load()
            }}>
              Anular préstamo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar acción?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await confirmDialog?.onConfirm(); setConfirmDialog(null) }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loan history */}
      {pastLoans.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historial de préstamos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pastLoans.map((loan) => {
              const isExpanded = expandedLoanIds.has(loan.id)
              return (
                <div key={loan.id} className="rounded-lg border text-sm">
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-muted/30 transition-colors rounded-lg cursor-pointer"
                    onClick={() => togglePastLoan(loan.id)}
                  >
                    <div>
                      <p className="font-medium">{fmtDate(loan.startDate)}</p>
                      <p className="text-muted-foreground">
                        {fmt(loan.principal)} · {loan.installmentCount} cuotas · {FREQ_LABEL[loan.frequency]}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="font-medium">{fmt(loan.totalAmount)}</p>
                      {loan.status === 'NULLIFIED' ? (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">Anulado</Badge>
                      ) : (
                        <Badge variant="secondary">Finalizado</Badge>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 flex flex-col gap-2">
                      <Separator />
                      <InstallmentTable
                        loan={loan}
                        onStartPaying={() => {}}
                        onStartResolving={() => {}}
                        onVoidPayment={() => {}}
                        onDeleteInstallment={() => {}}
                        allowVoid={false}
                      />
                      {loan.installments.some((i) => i.isPenalty) && (
                        <p className="text-xs text-muted-foreground">* Penalidad — el número debajo indica la cuota que la originó</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
