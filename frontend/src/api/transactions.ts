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
}

export interface TransactionListResponse {
  transactions: Transaction[]
  pagination: {
    next_cursor: string | null
    has_more: boolean
    limit: number
  }
}

export async function fetchTransactions(
  cursor?: string,
  limit = 20,
): Promise<TransactionListResponse> {
  const params: Record<string, string | number> = { limit }
  if (cursor) params.cursor = cursor
  const { data } = await api.get('/transactions/', { params })
  return data
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  const { data } = await api.get(`/transactions/${id}`)
  return data
}
