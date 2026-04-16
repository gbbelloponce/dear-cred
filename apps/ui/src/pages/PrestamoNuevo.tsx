import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { api, type Frequency, type LoanType } from '@/services/api'
import { argentinaDateInputToIsoStart } from '@/lib/date'

const FREQUENCY_LABEL: Record<Frequency, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  FORTNIGHTLY: 'Quincenal',
  MONTHLY: 'Mensual',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(n)
}

export default function PrestamoNuevo() {
  const { id: clientId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initialType = (searchParams.get('type') === 'PRODUCT' ? 'PRODUCT' : 'CASH') as LoanType

  const [loanType, setLoanType] = useState<LoanType>(initialType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [principal, setPrincipal] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [installmentCount, setInstallmentCount] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('DAILY')
  const [startDate, setStartDate] = useState('')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')

  const principalNum = parseFloat(principal) || 0
  const rateNum = parseFloat(interestRate) || 0
  const countNum = parseInt(installmentCount) || 0
  const totalAmount = principalNum * (1 + rateNum / 100)
  const installmentAmount = countNum > 0 ? totalAmount / countNum : 0

  const isProduct = loanType === 'PRODUCT'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clientId) return
    setError(null)
    setLoading(true)
    try {
      await api.createLoan(clientId, {
        principal: principalNum,
        interestRate: rateNum,
        installmentCount: countNum,
        frequency,
        startDate: argentinaDateInputToIsoStart(startDate),
        type: loanType,
        ...(isProduct ? { productName, productDescription: productDescription || undefined } : {}),
      })
      navigate(`/clientes/${clientId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('409')) {
        setError(
          isProduct
            ? 'Este cliente ya tiene una venta activa.'
            : 'Este cliente ya tiene un préstamo activo.',
        )
      } else {
        setError(
          isProduct
            ? 'No se pudo crear la venta. Intentá de nuevo.'
            : 'No se pudo crear el préstamo. Intentá de nuevo.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clientes/${clientId}`)}>
          ← Volver
        </Button>
        <h1 className="text-xl font-semibold">{isProduct ? 'Nueva venta' : 'Nuevo préstamo'}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isProduct ? 'Condiciones de la venta' : 'Condiciones del préstamo'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={loanType} onValueChange={(v) => setLoanType(v as LoanType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Préstamo en efectivo</SelectItem>
                  <SelectItem value="PRODUCT">Venta de producto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isProduct && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="productName">Nombre del producto</Label>
                  <Input
                    id="productName"
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="productDescription">Descripción</Label>
                  <Textarea
                    id="productDescription"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="principal">{isProduct ? 'Costo del producto ($)' : 'Capital ($)'}</Label>
                <Input
                  id="principal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="interestRate">{isProduct ? 'Interés / ganancia (%)' : 'Interés (%)'}</Label>
                <Input
                  id="interestRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="installmentCount">Cantidad de cuotas</Label>
                <Input
                  id="installmentCount"
                  type="number"
                  min="1"
                  step="1"
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Frecuencia</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {FREQUENCY_LABEL[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Fecha de inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            {principalNum > 0 && countNum > 0 && (
              <>
                <Separator />
                <div className="rounded-lg bg-muted/50 p-4 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total a {isProduct ? 'cobrar' : 'devolver'}</span>
                    <span className="font-medium">{fmt(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Valor de cada cuota ({countNum} × {FREQUENCY_LABEL[frequency].toLowerCase()})
                    </span>
                    <span className="font-medium">{fmt(installmentAmount)}</span>
                  </div>
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/clientes/${clientId}`)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : isProduct ? 'Crear venta' : 'Crear préstamo'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
