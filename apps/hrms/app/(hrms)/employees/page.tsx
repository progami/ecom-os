'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmployeesApi, type Employee } from '@/lib/api-client'
import { UsersIcon, PlusIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge, getStatusVariant } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SearchForm } from '@/components/ui/SearchForm'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

function EmployeeAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <div className="h-9 w-9 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm font-medium">
      {firstName?.charAt(0)}{lastName?.charAt(0)}
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-4 bg-slate-200 rounded w-28" />
                <div className="h-3 bg-slate-200 rounded w-16" />
              </div>
            </div>
          </td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-28" /></td>
          <td className="px-4 py-4"><div className="h-5 bg-slate-200 rounded w-16" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
        </tr>
      ))}
    </>
  )
}

export default function EmployeesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Employee[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await EmployeesApi.list({ q })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error fetching employees:', err)
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
        description="Manage your team members"
        icon={<UsersIcon className="h-6 w-6 text-white" />}
        action={
          <Button href="/employees/add" icon={<PlusIcon className="h-4 w-4" />}>
            Add Employee
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Search */}
        <Card padding="md">
          <SearchForm
            value={q}
            onChange={setQ}
            onSubmit={load}
            placeholder="Search by name, email, or ID..."
          />
        </Card>

        {/* Results count */}
        <ResultsCount
          count={items.length}
          singular="employee"
          plural="employees"
          loading={loading}
        />

        {/* Table */}
        <Table>
          <TableHeader>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Join Date</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowSkeleton />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                icon={<UsersIcon className="h-10 w-10" />}
                title="No employees found"
                action={{
                  label: 'Add your first employee',
                  href: '/employees/add',
                }}
              />
            ) : (
              items.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={() => router.push(`/employees/${e.id}/edit`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} />
                      <div>
                        <p className="font-medium text-slate-900">{e.firstName} {e.lastName}</p>
                        <p className="text-xs text-slate-500">{e.employeeId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{e.department || '—'}</TableCell>
                  <TableCell className="text-slate-600">{e.position}</TableCell>
                  <TableCell>
                    <StatusBadge status={e.status.replace('_', ' ')} />
                  </TableCell>
                  <TableCell className="text-slate-500">{e.joinDate}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
