import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, CreditCard } from 'lucide-react'
import { fetchTransactions } from '@/api/transactions'
import type { TransactionStatus, TransactionType } from '@/api/transactions'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
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
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transactions', currentCursor],
    queryFn: () => fetchTransactions(currentCursor, PAGE_SIZE),
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">Browse and filter transactions</p>
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
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {tx.sender_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {tx.receiver_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(tx.created_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
