import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Link2,
  Pencil,
} from 'lucide-react'
import { fetchUser } from '@/api/users'
import { fetchUserConnections } from '@/api/relationships'
import type { TransactionLink, SharedLink } from '@/api/relationships'
import RelationshipGraph from '@/components/RelationshipGraph'
import UserFormDialog from '@/components/UserFormDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id!),
    enabled: !!id,
  })

  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ['user-connections', id],
    queryFn: () => fetchUserConnections(id!),
    enabled: !!id,
  })

  if (userLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Users
        </Button>
        <Card>
          <CardContent className="pt-6 text-muted-foreground">User not found.</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {user.first_name} {user.last_name}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">{user.id}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" /> Edit
        </Button>
      </div>

      <UserFormDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} user={user} />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{user.phone ?? 'No phone'}</span>
            </div>
            {user.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {[
                    user.address.street,
                    user.address.city,
                    user.address.state,
                    user.address.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1">
                {user.payment_methods?.map((pm) => (
                  <Badge key={pm.id} variant="secondary">
                    {pm.type} ({pm.id})
                  </Badge>
                )) ?? <span className="text-muted-foreground">No payment methods</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {connections && (
        <RelationshipGraph
          userId={user.id}
          userName={`${user.first_name} ${user.last_name}`}
          connections={connections}
        />
      )}

      {connectionsLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : connections && connections.shared_links.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Shared Attribute Links
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Link Type</TableHead>
                  <TableHead>Connected User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Transactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.shared_links.map((link: SharedLink, i: number) => (
                  <TableRow
                    key={`${link.link_type}-${link.user.id}-${i}`}
                    className="cursor-pointer"
                    onClick={() => navigate(`/users/${link.user.id}`)}
                  >
                    <TableCell>
                      <Badge variant={getLinkBadgeVariant(link.link_type)}>
                        {formatLinkType(link.link_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {link.user.first_name} {link.user.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{link.user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {link.transaction_count ? `${link.transaction_count} txns` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {connections && connections.credit_links.length > 0 && (
        <TransactionLinksCard
          title="Credit Links (Sent)"
          icon={<ArrowUpRight className="h-5 w-5 text-red-500" />}
          links={connections.credit_links}
          navigate={navigate}
        />
      )}

      {connections && connections.debit_links.length > 0 && (
        <TransactionLinksCard
          title="Debit Links (Received)"
          icon={<ArrowDownLeft className="h-5 w-5 text-green-500" />}
          links={connections.debit_links}
          navigate={navigate}
        />
      )}

      {connections &&
        connections.shared_links.length === 0 &&
        connections.credit_links.length === 0 &&
        connections.debit_links.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No connections found for this user.
            </CardContent>
          </Card>
        )}
    </div>
  )
}

function TransactionLinksCard({
  title,
  icon,
  links,
  navigate,
}: {
  title: string
  icon: React.ReactNode
  links: TransactionLink[]
  navigate: (path: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto">
            {links.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Counterparty</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow
                key={link.transaction.id}
                className="cursor-pointer"
                onClick={() => navigate(`/transactions/${link.transaction.id}`)}
              >
                <TableCell className="font-medium">
                  {link.counterparty.first_name} {link.counterparty.last_name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{link.transaction.transaction_type}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {link.transaction.amount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell className="text-muted-foreground">{link.transaction.currency}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(link.transaction.status)}>
                    {link.transaction.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function formatLinkType(type: string): string {
  return type
    .replace('SHARED_', '')
    .replace('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function getLinkBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type.includes('IP') || type.includes('DEVICE')) return 'destructive'
  if (type.includes('PAYMENT')) return 'default'
  return 'secondary'
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'SUCCESSFUL':
      return 'default'
    case 'DECLINED':
    case 'SUSPENDED':
      return 'destructive'
    default:
      return 'outline'
  }
}
