import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchUsers } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

const PAGE_SIZE = 10

export default function UsersPage() {
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined)
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', currentCursor],
    queryFn: () => fetchUsers(currentCursor, PAGE_SIZE),
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
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Click on a user to view their relationships and connections
        </p>
      </div>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive text-sm">
            Failed to load users. Is the backend running on port 8001?
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Payment</TableHead>
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
                : data?.users.map((user) => (
                    <TableRow
                      key={user.id}
                      onClick={() => navigate(`/users/${user.id}`)}
                      className="cursor-pointer h-14"
                    >
                      <TableCell className="font-medium text-base">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-muted-foreground">{user.phone ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.address?.city ?? '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.address?.country ?? '-'}
                      </TableCell>
                      <TableCell>
                        {user.payment_methods?.map((pm) => (
                          <Badge key={pm.id} variant="secondary" className="mr-1">
                            {pm.type}
                          </Badge>
                        )) ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
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
