const API_URL = import.meta.env.VITE_API_URL as string
const TOKEN_KEY = 'token'

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) throw new Error('No session')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

export type ClientSummary = {
  id: string
  firstName: string
  lastName: string
  dni: string
  phone: string
  address: string
  notes: string | null
  createdAt: string
  loans: Array<{
    id: string
    status: string
    principal: number
    totalAmount: number
    installments: Array<{ id: string; status: string; dueDate: string; amount: number }>
  }>
}

export type PaymentMethod = 'CASH' | 'TRANSFER'
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type InstallmentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'LATE_PAID' | 'OVERDUE'
export type LoanStatus = 'ACTIVE' | 'COMPLETED' | 'OVERDUE'

export type Payment = {
  id: string
  amount: number
  paymentDate: string
  method: PaymentMethod
}

export type Installment = {
  id: string
  number: number
  dueDate: string
  amount: number
  status: InstallmentStatus
  isPenalty: boolean
  payments: Payment[]
}

export type LoanWithInstallments = {
  id: string
  clientId: string
  principal: number
  interestRate: number
  totalAmount: number
  installmentAmount: number
  installmentCount: number
  frequency: Frequency
  startDate: string
  status: LoanStatus
  createdAt: string
  installments: Installment[]
}

export type ClientDetail = {
  id: string
  firstName: string
  lastName: string
  dni: string
  phone: string
  address: string
  notes: string | null
  createdAt: string
  loans: LoanWithInstallments[]
}

export type DashboardData = {
  totalOwed: number
  collected: number
  overdueClients: Array<{ id: string; firstName: string; lastName: string }>
  onTimeRate: number
  cashVsTransfer: Record<string, number>
  debtPerClient: Array<{ clientId: string; clientName: string; loanId: string; remaining: number }>
}

export const api = {
  getClients: () => apiFetch<ClientSummary[]>('/clients'),

  createClient: (body: {
    firstName: string
    lastName: string
    dni: string
    phone: string
    address: string
    notes?: string
  }) =>
    apiFetch<{ id: string }>('/clients', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getClient: (id: string) => apiFetch<ClientDetail>(`/clients/${id}`),

  updateClient: (
    id: string,
    body: Partial<{ firstName: string; lastName: string; phone: string; address: string; notes: string }>,
  ) =>
    apiFetch<ClientDetail>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  createLoan: (
    clientId: string,
    body: {
      principal: number
      interestRate: number
      installmentCount: number
      frequency: Frequency
      startDate: string
    },
  ) =>
    apiFetch<LoanWithInstallments>(`/clients/${clientId}/loans`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getLoan: (id: string) => apiFetch<LoanWithInstallments>(`/loans/${id}`),

  createPayment: (installmentId: string, body: { amount: number; method: PaymentMethod }) =>
    apiFetch<{ success: boolean; status: InstallmentStatus }>(`/installments/${installmentId}/payments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resolveInstallment: (installmentId: string) =>
    apiFetch<{ success: boolean; status: InstallmentStatus }>(`/installments/${installmentId}/resolve`, {
      method: 'PATCH',
    }),

  getDashboard: (params?: { from?: Date; to?: Date }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from.toISOString().slice(0, 10))
    if (params?.to) qs.set('to', params.to.toISOString().slice(0, 10))
    const query = qs.toString() ? `?${qs}` : ''
    return apiFetch<DashboardData>(`/dashboard${query}`)
  },
}
