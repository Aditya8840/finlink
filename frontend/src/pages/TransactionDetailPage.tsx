import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  CreditCard,
  User,
  Globe,
  Smartphone,
  Calendar,
  DollarSign,
} from 'lucide-react'
import { fetchTransaction } from '@/api/transactions'
import type { TransactionType, TransactionStatus } from '@/api/transactions'
import { fetchUser } from '@/api/users'
import { fetchTransactionConnections } from '@/api/relationships'
import TransactionGraph from '@/components/TransactionGraph'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

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
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: transaction, isLoading: txLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => fetchTransaction(id!),
    enabled: !!id,
  })

  const { data: sender } = useQuery({
    queryKey: ['user', transaction?.sender_id],
    queryFn: () => fetchUser(transaction!.sender_id),
    enabled: !!transaction?.sender_id,
  })

  const { data: receiver } = useQuery({
    queryKey: ['user', transaction?.receiver_id],
    queryFn: () => fetchUser(transaction!.receiver_id),
    enabled: !!transaction?.receiver_id,
  })

  const { data: connections } = useQuery({
    queryKey: ['transaction-connections', id],
    queryFn: () => fetchTransactionConnections(id!),
    enabled: !!id,
  })

  if (txLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Transactions
        </Button>
        <Card>
          <CardContent className="pt-6 text-muted-foreground">Transaction not found.</CardContent>
        </Card>
      </div>
    )
  }

  const TypeIcon = typeConfig[transaction.transaction_type].icon

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">
              {typeConfig[transaction.transaction_type].label}
            </h1>
            <Badge variant={statusVariant[transaction.status]} className="ml-2">
              {transaction.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{transaction.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {formatCurrency(transaction.amount, transaction.currency)}
              </p>
              <p className="text-sm text-muted-foreground">{transaction.currency}</p>
            </div>
            {transaction.destination_amount && transaction.destination_currency && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Destination Amount</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatCurrency(transaction.destination_amount, transaction.destination_currency)}
                </p>
              </div>
            )}
            {transaction.description && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{transaction.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm font-medium">{formatDate(transaction.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-sm font-medium">{formatDate(transaction.updated_at)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Sender
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sender ? (
              <div
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/users/${sender.id}`)}
              >
                <div>
                  <p className="font-medium">
                    {sender.first_name} {sender.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{sender.email}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="p-3 rounded-lg border">
                <p className="font-mono text-sm text-muted-foreground">{transaction.sender_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Receiver
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receiver ? (
              <div
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/users/${receiver.id}`)}
              >
                <div>
                  <p className="font-medium">
                    {receiver.first_name} {receiver.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{receiver.email}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="p-3 rounded-lg border">
                <p className="font-mono text-sm text-muted-foreground">{transaction.receiver_id}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {connections && <TransactionGraph transaction={transaction} connections={connections} />}

      {(transaction.device_info || transaction.payment_method) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {transaction.device_info && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Device Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {transaction.device_info.device_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Device ID</p>
                    <p className="text-sm font-mono">{transaction.device_info.device_id}</p>
                  </div>
                )}
                {transaction.device_info.ip_address && (
                  <div>
                    <p className="text-sm text-muted-foreground">IP Address</p>
                    <p className="text-sm font-mono">{transaction.device_info.ip_address}</p>
                  </div>
                )}
                {transaction.device_info.geolocation && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {[
                        transaction.device_info.geolocation.state,
                        transaction.device_info.geolocation.country,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Unknown location'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {transaction.payment_method && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <Badge variant="secondary">{transaction.payment_method.type}</Badge>
                  <span className="font-mono text-sm">{transaction.payment_method.id}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
