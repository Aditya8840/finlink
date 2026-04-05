import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { createTransaction, updateTransaction } from '@/api/transactions'
import type {
  Transaction,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  TransactionType,
  TransactionStatus,
} from '@/api/transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction
}

const TRANSACTION_TYPES: TransactionType[] = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT']
const TRANSACTION_STATUSES: TransactionStatus[] = [
  'CREATED',
  'SUCCESSFUL',
  'DECLINED',
  'SUSPENDED',
  'REFUNDED',
]
const PAYMENT_TYPES = ['CARD', 'BANK_ACCOUNT', 'WALLET', 'CASH']

export default function TransactionFormDialog({ open, onOpenChange, transaction }: Props) {
  const isEdit = !!transaction
  const queryClient = useQueryClient()

  const [transactionType, setTransactionType] = useState<TransactionType>(
    transaction?.transaction_type ?? 'TRANSFER',
  )
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? 'CREATED')
  const [senderId, setSenderId] = useState(transaction?.sender_id ?? '')
  const [receiverId, setReceiverId] = useState(transaction?.receiver_id ?? '')
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState(transaction?.currency ?? 'USD')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [deviceId, setDeviceId] = useState(transaction?.device_info?.device_id ?? '')
  const [ipAddress, setIpAddress] = useState(transaction?.device_info?.ip_address ?? '')
  const [geoCountry, setGeoCountry] = useState(transaction?.device_info?.geolocation?.country ?? '')
  const [geoState, setGeoState] = useState(transaction?.device_info?.geolocation?.state ?? '')
  const [pmId, setPmId] = useState(transaction?.payment_method?.id ?? '')
  const [pmType, setPmType] = useState<string>(transaction?.payment_method?.type ?? 'CARD')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload: CreateTransactionPayload) => createTransaction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      onOpenChange(false)
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setError(err.response?.data?.detail ?? 'Failed to create transaction')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateTransactionPayload) => updateTransaction(transaction!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['transaction', transaction!.id] })
      onOpenChange(false)
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setError(err.response?.data?.detail ?? 'Failed to update transaction')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const hasDevice = deviceId || ipAddress || geoCountry || geoState
    const hasPayment = pmId

    if (isEdit) {
      const changes: UpdateTransactionPayload = {}

      if (transactionType !== transaction.transaction_type) {
        changes.transaction_type = transactionType
      }
      if (status !== transaction.status) changes.status = status
      if (parseFloat(amount) !== transaction.amount) changes.amount = parseFloat(amount)
      if (currency !== transaction.currency) changes.currency = currency
      if (description !== (transaction.description ?? '')) {
        changes.description = description || undefined
      }

      const origDevice = transaction.device_info
      const deviceChanged =
        deviceId !== (origDevice?.device_id ?? '') ||
        ipAddress !== (origDevice?.ip_address ?? '') ||
        geoCountry !== (origDevice?.geolocation?.country ?? '') ||
        geoState !== (origDevice?.geolocation?.state ?? '')
      if (deviceChanged) {
        changes.device_info = hasDevice
          ? {
              device_id: deviceId || undefined,
              ip_address: ipAddress || undefined,
              geolocation:
                geoCountry || geoState
                  ? { country: geoCountry || undefined, state: geoState || undefined }
                  : undefined,
            }
          : null
      }

      const origPm = transaction.payment_method
      const pmChanged = pmId !== (origPm?.id ?? '') || pmType !== (origPm?.type ?? 'CARD')
      if (pmChanged) {
        changes.payment_method = hasPayment ? { id: pmId, type: pmType } : null
      }

      if (Object.keys(changes).length === 0) {
        onOpenChange(false)
        return
      }

      updateMutation.mutate(changes)
    } else {
      const payload: CreateTransactionPayload = {
        transaction_type: transactionType,
        status,
        sender_id: senderId,
        receiver_id: receiverId,
        amount: parseFloat(amount),
        currency,
        ...(description && { description }),
        ...(hasDevice && {
          device_info: {
            ...(deviceId && { device_id: deviceId }),
            ...(ipAddress && { ip_address: ipAddress }),
            ...((geoCountry || geoState) && {
              geolocation: {
                ...(geoCountry && { country: geoCountry }),
                ...(geoState && { state: geoState }),
              },
            }),
          },
        }),
        ...(hasPayment && { payment_method: { id: pmId, type: pmType } }),
      }
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Transaction' : 'Create Transaction'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type *</Label>
              <Select
                value={transactionType}
                onValueChange={(v) => setTransactionType(v as TransactionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TransactionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="senderId">Sender ID *</Label>
                <Input
                  id="senderId"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="User ID"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="receiverId">Receiver ID *</Label>
                <Input
                  id="receiverId"
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  placeholder="User ID"
                  required
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Device Info
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Device ID"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
              <Input
                placeholder="IP Address"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Country"
                value={geoCountry}
                onChange={(e) => setGeoCountry(e.target.value)}
              />
              <Input
                placeholder="State"
                value={geoState}
                onChange={(e) => setGeoState(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Payment Method
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Card/Account ID"
                value={pmId}
                onChange={(e) => setPmId(e.target.value)}
              />
              <Select value={pmType} onValueChange={setPmType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
