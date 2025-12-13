'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmployeesApi, DashboardApi, type Employee } from '@/lib/api-client'
import { UsersIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon, SpinnerIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
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

type SortField = 'employeeId' | 'name' | 'department' | 'joinDate'
type SortDirection = 'asc' | 'desc'

function EmployeeAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <div className="h-9 w-9 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm font-medium">
      {firstName?.charAt(0)}{lastName?.charAt(0)}
    </div>
  )
}

function formatDate(dateString: string): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function SortableHeader({
  children,
  field,
  currentSort,
  currentDirection,
  onSort,
}: {
  children: React.ReactNode
  field: SortField
  currentSort: SortField
  currentDirection: SortDirection
  onSort: (field: SortField) => void
}) {
  const isActive = currentSort === field
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-slate-900 transition-colors group"
    >
      {children}
      <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
        {isActive && currentDirection === 'asc' ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )}
      </span>
    </button>
  )
}

function TableRowSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
          <td className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-4 bg-slate-200 rounded w-28" />
                <div className="h-3 bg-slate-200 rounded w-36" />
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
  const [accessChecking, setAccessChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [sortField, setSortField] = useState<SortField>('employeeId')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Check if user has access (is a manager with direct reports)
  useEffect(() => {
    async function checkAccess() {
      try {
        const dashboardData = await DashboardApi.get()
        if (!dashboardData.isManager) {
          // Not a manager - redirect to their own profile
          const employeeId = dashboardData.currentEmployee?.id
          if (employeeId) {
            router.replace(`/employees/${employeeId}`)
          } else {
            router.replace('/')
          }
          return
        }
        setHasAccess(true)
      } catch (err) {
        console.error('Error checking access:', err)
        router.replace('/')
      } finally {
        setAccessChecking(false)
      }
    }
    checkAccess()
  }, [router])

  const load = useCallback(async () => {
    if (!hasAccess) return
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
  }, [q, hasAccess])

  useEffect(() => {
    if (hasAccess) {
      load()
    }
  }, [load, hasAccess])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sort items client-side
  const sortedItems = [...items].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1

    switch (sortField) {
      case 'employeeId': {
        // Extract numeric part for proper sorting (EMP-001, EMP-002, etc.)
        const numA = parseInt(a.employeeId.replace(/\D/g, ''), 10) || 0
        const numB = parseInt(b.employeeId.replace(/\D/g, ''), 10) || 0
        return (numA - numB) * direction
      }
      case 'name':
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) * direction
      case 'department':
        return (a.department || '').localeCompare(b.department || '') * direction
      case 'joinDate':
        return (new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()) * direction
      default:
        return 0
    }
  })

  // Show loading while checking access
  if (accessChecking) {
    return (
      <>
        <ListPageHeader
          title="Employees"
          description="Manage your team members"
          icon={<UsersIcon className="h-6 w-6 text-white" />}
        />
        <div className="flex items-center justify-center h-64">
          <SpinnerIcon className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      </>
    )
  }

  // Don't render content if user doesn't have access (will redirect)
  if (!hasAccess) {
    return null
  }

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
            <TableHead className="w-24">
              <SortableHeader
                field="employeeId"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                ID
              </SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader
                field="name"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                Employee
              </SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader
                field="department"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                Department
              </SortableHeader>
            </TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <SortableHeader
                field="joinDate"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                Join Date
              </SortableHeader>
            </TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowSkeleton />
            ) : sortedItems.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                icon={<UsersIcon className="h-10 w-10" />}
                title="No employees found"
                action={{
                  label: 'Add your first employee',
                  href: '/employees/add',
                }}
              />
            ) : (
              sortedItems.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={() => router.push(`/employees/${e.id}`)}
                >
                  <TableCell className="font-mono text-sm text-slate-600">
                    {e.employeeId}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} />
                      <div>
                        <p className="font-medium text-slate-900">{e.firstName} {e.lastName}</p>
                        <p className="text-xs text-slate-500">{e.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{e.department || '—'}</TableCell>
                  <TableCell className="text-slate-600">{e.position}</TableCell>
                  <TableCell>
                    <StatusBadge status={e.status.replace('_', ' ')} />
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(e.joinDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
