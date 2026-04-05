import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, CreditCard, Search, Plus } from 'lucide-react'
import { fetchTransactions } from '@/api/transactions'
import type { TransactionStatus, TransactionType, TransactionFilters } from '@/api/transactions'
import TransactionFormDialog from '@/components/TransactionFormDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 15

const typeConfig: Record<TransactionType, { icon: typeof ArrowUpRight; label: string }> = {
  DEPOSIT: { icon: ArrowDownLeft, label: 'Deposit' },
  WITHDRAWAL: { icon: ArrowUpRight, label: 'Withdrawal' },
  TRANSFER: { icon: ArrowLeftRight, label: 'Transfer' },
  PAYMENT: { icon: CreditCard, label: 'Payment' },
}

const statusVariant: Record<
  TransactionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  CREATED: 'secondary',
  SUCCESSFUL: 'default',
  DECLINED: 'destructive',
  SUSPENDED: 'outline',
  REFUNDED: 'outline',
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TransactionsPage() {
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined)
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const navigate = useNavigate()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetPagination = () => {
    setCursorStack([])
    setCurrentCursor(undefined)
  }

  const handleSearch = (value: string) => {
    setSearchInput(value)
    resetPagination()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(
      () => setFilters((f) => ({ ...f, search: value || undefined })),
      300,
    )
  }

  const handleFilterChange = (key: keyof TransactionFilters, value: string | undefined) => {
    resetPagination()
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transactions', currentCursor, filters],
    queryFn: () => fetchTransactions(currentCursor, PAGE_SIZE, filters),
  })

  const goNext = () => {
    if (data?.pagination.next_cursor) {
      setCursorStack((prev) => [...prev, currentCursor ?? ''])
      setCurrentCursor(data.pagination.next_cursor)
    }
  }

  const goPrevious = () => {
    setCursorStack((prev) => {
      const newStack = [...prev]
      const prevCursor = newStack.pop()
      setCurrentCursor(prevCursor || undefined)
      return newStack
    })
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Browse and filter transactions
            {activeFilterCount > 0 &&
              ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Transaction
        </Button>
      </div>

      <TransactionFormDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.transaction_type ?? 'all'}
          onValueChange={(v) => handleFilterChange('transaction_type', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
            <SelectItem value="PAYMENT">Payment</SelectItem>
            <SelectItem value="DEPOSIT">Deposit</SelectItem>
            <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status ?? 'all'}
          onValueChange={(v) => handleFilterChange('status', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="SUCCESSFUL">Successful</SelectItem>
            <SelectItem value="CREATED">Created</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Min $"
          className="w-28"
          onChange={(e) =>
            handleFilterChange('min_amount', e.target.value ? e.target.value : undefined)
          }
        />
        <Input
          type="number"
          placeholder="Max $"
          className="w-28"
          onChange={(e) =>
            handleFilterChange('max_amount', e.target.value ? e.target.value : undefined)
          }
        />

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({})
              setSearchInput('')
              resetPagination()
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive text-sm">
            Failed to load transactions. Is the backend running on port 8001?
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Receiver</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.transactions.map((tx) => {
                    const TypeIcon = typeConfig[tx.transaction_type].icon
                    return (
                      <TableRow
                        key={tx.id}
                        onClick={() => navigate(`/transactions/${tx.id}`)}
                        className="cursor-pointer h-14"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {typeConfig[tx.transaction_type].label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[tx.status]}>{tx.status}</Badge>
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {tx.sender_name ?? tx.sender_id.slice(0, 8) + '...'}
                            </p>
                            {tx.sender_email && (
                              <p className="text-xs text-muted-foreground">{tx.sender_email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {tx.receiver_name ?? tx.receiver_id.slice(0, 8) + '...'}
                            </p>
                            {tx.receiver_email && (
                              <p className="text-xs text-muted-foreground">{tx.receiver_email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(tx.created_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}

              {!isLoading && data?.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No transactions found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        {data && (
          <div className="border-t px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {cursorStack.length + 1}
              {data.pagination.has_more ? '' : ' (last page)'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrevious}
                disabled={cursorStack.length === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={!data.pagination.has_more}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
