import api from './client'

export interface RelatedUser {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface TransactionSummary {
  id: string
  transaction_type: string
  status: string
  sender_id: string
  receiver_id: string
  amount: number
  currency: string
  created_at: string
}

export interface TransactionLink {
  transaction: TransactionSummary
  counterparty: RelatedUser
}

export interface SharedLink {
  link_type: string
  user: RelatedUser
  transaction_count: number | null
}

export interface UserConnections {
  credit_links: TransactionLink[]
  debit_links: TransactionLink[]
  shared_links: SharedLink[]
}

export interface LinkedTransaction {
  link_type: string
  transaction: TransactionSummary
  sender: RelatedUser | null
  receiver: RelatedUser | null
}

export interface TransactionConnections {
  sender: RelatedUser
  receiver: RelatedUser
  linked_transactions: LinkedTransaction[]
}

export async function fetchUserConnections(userId: string): Promise<UserConnections> {
  const { data } = await api.get(`/relationships/user/${userId}`)
  return data
}

export async function fetchTransactionConnections(txId: string): Promise<TransactionConnections> {
  const { data } = await api.get(`/relationships/transaction/${txId}`)
  return data
}
