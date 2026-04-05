import api from './client'

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT'
export type TransactionStatus = 'CREATED' | 'SUCCESSFUL' | 'DECLINED' | 'SUSPENDED' | 'REFUNDED'

export interface PaymentMethod {
  id: string
  type: 'CARD' | 'BANK_ACCOUNT' | 'WALLET' | 'CASH'
}

export interface DeviceData {
  device_id: string | null
  ip_address: string | null
  geolocation: {
    country: string | null
    state: string | null
  } | null
}

export interface Transaction {
  id: string
  transaction_type: TransactionType
  status: TransactionStatus
  sender_id: string
  receiver_id: string
  amount: number
  currency: string
  destination_amount: number | null
  destination_currency: string | null
  description: string | null
  device_info: DeviceData | null
  payment_method: PaymentMethod | null
  created_at: string
  updated_at: string
  sender_name: string | null
  sender_email: string | null
  receiver_name: string | null
  receiver_email: string | null
}

export interface TransactionListResponse {
  transactions: Transaction[]
  pagination: {
    next_cursor: string | null
    has_more: boolean
    limit: number
  }
}

export interface TransactionFilters {
  search?: string
  transaction_type?: string
  status?: string
  min_amount?: number
  max_amount?: number
}

export async function fetchTransactions(
  cursor?: string,
  limit = 20,
  filters?: TransactionFilters,
): Promise<TransactionListResponse> {
  const params: Record<string, string | number> = { limit }
  if (cursor) params.cursor = cursor
  if (filters?.search) params.search = filters.search
  if (filters?.transaction_type) params.transaction_type = filters.transaction_type
  if (filters?.status) params.status = filters.status
  if (filters?.min_amount !== undefined) params.min_amount = filters.min_amount
  if (filters?.max_amount !== undefined) params.max_amount = filters.max_amount
  const { data } = await api.get('/transactions/', { params })
  return data
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  const { data } = await api.get(`/transactions/${id}`)
  return data
}

export interface CreateTransactionPayload {
  transaction_type: TransactionType
  status?: TransactionStatus
  sender_id: string
  receiver_id: string
  amount: number
  currency?: string
  destination_amount?: number
  destination_currency?: string
  description?: string
  device_info?: {
    device_id?: string
    ip_address?: string
    geolocation?: { country?: string; state?: string }
  }
  payment_method?: { id: string; type: string }
}

export interface UpdateTransactionPayload {
  transaction_type?: TransactionType
  status?: TransactionStatus
  amount?: number
  currency?: string
  description?: string
  device_info?: {
    device_id?: string
    ip_address?: string
    geolocation?: { country?: string; state?: string }
  } | null
  payment_method?: { id: string; type: string } | null
}

export async function createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
  const { data } = await api.post('/transactions/', payload)
  return data
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionPayload,
): Promise<Transaction> {
  const { data } = await api.put(`/transactions/${id}`, payload)
  return data
}
