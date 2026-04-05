import api from './client'

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  address: {
    street: string | null
    city: string | null
    state: string | null
    postal_code: string | null
    country: string | null
  } | null
  payment_methods: { id: string; type: string }[] | null
  created_at: string
  updated_at: string
}

export interface UserListResponse {
  users: User[]
  pagination: {
    next_cursor: string | null
    has_more: boolean
    limit: number
  }
}

export async function fetchUsers(cursor?: string, limit = 20): Promise<UserListResponse> {
  const params: Record<string, string | number> = { limit }
  if (cursor) params.cursor = cursor
  const { data } = await api.get('/users/', { params })
  return data
}

export async function fetchUser(id: string): Promise<User> {
  const { data } = await api.get(`/users/${id}`)
  return data
}
