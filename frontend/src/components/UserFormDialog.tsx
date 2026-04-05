import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { createUser, updateUser } from '@/api/users'
import type { User, CreateUserPayload, UpdateUserPayload } from '@/api/users'
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
  user?: User
}

const PAYMENT_TYPES = ['CARD', 'BANK_ACCOUNT', 'WALLET', 'CASH']

export default function UserFormDialog({ open, onOpenChange, user }: Props) {
  const isEdit = !!user
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [street, setStreet] = useState(user?.address?.street ?? '')
  const [city, setCity] = useState(user?.address?.city ?? '')
  const [state, setState] = useState(user?.address?.state ?? '')
  const [postalCode, setPostalCode] = useState(user?.address?.postal_code ?? '')
  const [country, setCountry] = useState(user?.address?.country ?? '')
  const [pmId, setPmId] = useState(user?.payment_methods?.[0]?.id ?? '')
  const [pmType, setPmType] = useState(user?.payment_methods?.[0]?.type ?? 'CARD')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setError(err.response?.data?.detail ?? 'Failed to create user. Please try again.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser(user!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', user!.id] })
      onOpenChange(false)
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setError(err.response?.data?.detail ?? 'Failed to update user')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const hasAddress = street || city || state || postalCode || country
    const hasPayment = pmId

    if (isEdit) {
      // Only send fields that actually changed
      const changes: Record<string, unknown> = {}

      if (firstName !== user.first_name) changes.first_name = firstName
      if (lastName !== user.last_name) changes.last_name = lastName
      if (email !== user.email) changes.email = email
      if (phone !== (user.phone ?? '')) changes.phone = phone || undefined

      // Check if address changed
      const origAddr = user.address
      const addrChanged =
        street !== (origAddr?.street ?? '') ||
        city !== (origAddr?.city ?? '') ||
        state !== (origAddr?.state ?? '') ||
        postalCode !== (origAddr?.postal_code ?? '') ||
        country !== (origAddr?.country ?? '')
      if (addrChanged) {
        changes.address = hasAddress
          ? { street, city, state, postal_code: postalCode, country }
          : null
      }

      // Check if payment method changed
      const origPm = user.payment_methods?.[0]
      const pmChanged = pmId !== (origPm?.id ?? '') || pmType !== (origPm?.type ?? 'CARD')
      if (pmChanged) {
        changes.payment_methods = hasPayment ? [{ id: pmId, type: pmType }] : null
      }

      if (Object.keys(changes).length === 0) {
        onOpenChange(false) // nothing changed, just close
        return
      }

      updateMutation.mutate(changes)
    } else {
      // Create: send everything
      const payload = {
        first_name: firstName,
        last_name: lastName,
        email,
        ...(phone && { phone }),
        ...(hasAddress && {
          address: {
            ...(street && { street }),
            ...(city && { city }),
            ...(state && { state }),
            ...(postalCode && { postal_code: postalCode }),
            ...(country && { country }),
          },
        }),
        ...(hasPayment && {
          payment_methods: [{ id: pmId, type: pmType }],
        }),
      }
      createMutation.mutate(payload as CreateUserPayload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Create User'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Address</Label>
            <Input
              placeholder="Street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Postal Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
              <Input
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
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
