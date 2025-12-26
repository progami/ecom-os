'use client'

import { useCallback, useEffect, useState } from 'react'
import { EmployeesApi, type Employee } from '@/lib/api-client'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchForm } from '@/components/ui/SearchForm'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSkeleton,
  ResultsCount,
} from '@/components/ui/Table'
import { UsersIcon, FolderIcon } from '@/components/ui/Icons'
import { TableEmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/Badge'

function fullName(emp: Pick<Employee, 'firstName' | 'lastName'>) {
  return `${emp.firstName} ${emp.lastName}`.trim()
}

export function EmployeesClientPage(props: { initialQuery?: string }) {
  const [items, setItems] = useState<Employee[]>([])
  const [q, setQ] = useState(props.initialQuery ?? '')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await EmployeesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load employees', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <ListPageHeader
        title="Employees"
        description="Open employee profiles to view documents like offer letters, contracts, and IDs."
        icon={<UsersIcon className="h-6 w-6 text-white" />}
      />

      <div className="space-y-6">
        <Card padding="md">
          <SearchForm
            value={q}
            onChange={setQ}
            onSubmit={load}
            placeholder="Search by name, email, or employee ID..."
          />
        </Card>

        <ResultsCount count={items.length} singular="employee" plural="employees" loading={loading} />

        <Table>
          <TableHeader>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead align="right">Actions</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={6} columns={5} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                icon={<UsersIcon className="h-10 w-10" />}
                title="No employees found"
                description="Try a different search term."
              />
            ) : (
              items.map((emp) => (
                <TableRow key={emp.id} hoverable={false}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={emp.avatar} alt={fullName(emp)} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{fullName(emp)}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {emp.employeeId} • {emp.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700">{emp.department || emp.dept?.name || '—'}</TableCell>
                  <TableCell className="text-gray-700">{emp.position || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={emp.status} />
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" size="sm" href={`/employees/${emp.id}`}>
                        Profile
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        href={`/employees/${emp.id}?tab=documents`}
                        icon={<FolderIcon className="h-4 w-4" />}
                      >
                        Documents
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
