'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import {
  EmployeesApi,
  LeavesApi,
  PerformanceReviewsApi,
  DisciplinaryActionsApi,
  type Employee,
  type LeaveRequest,
  type PerformanceReview,
  type DisciplinaryAction,
} from '@/lib/api-client'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { DataTable, type FilterOption } from '@/components/ui/DataTable'
import { ResultsCount } from '@/components/ui/table'
import { TableEmptyContent } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  UsersIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  StarFilledIcon,
  ClockIcon,
} from '@/components/ui/Icons'
import {
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_OPTIONS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_OPTIONS,
} from '@/lib/domain/leave/constants'
import {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_OPTIONS,
  REVIEW_TYPE_LABELS,
  REVIEW_TYPE_OPTIONS,
} from '@/lib/domain/performance/constants'
import { DISCIPLINARY_STATUS_OPTIONS } from '@/lib/domain/disciplinary/constants'

// ============ EMPLOYEES TAB ============
function EmployeesTab() {
  const router = useRouter()
  const [items, setItems] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await EmployeesApi.list({})
      setItems(data.items)
    } catch (e) {
      console.error('Failed to load employees', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: 'employeeId',
        header: 'Employee',
        cell: ({ row }) => {
          const emp = row.original
          return (
            <div className="flex items-center gap-3">
              <Avatar src={emp.avatar} alt={`${emp.firstName} ${emp.lastName}`} size="sm" />
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">
                  {emp.firstName} {emp.lastName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {emp.employeeId} • {emp.email}
                </div>
              </div>
            </div>
          )
        },
        enableSorting: true,
      },
      {
        accessorFn: (row) => row.department ?? row.dept?.name ?? '',
        id: 'department',
        header: 'Department',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>() || '—'}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'position',
        header: 'Role',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>() || '—'}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
        enableSorting: true,
      },
    ],
    []
  )

  const handleRowClick = useCallback(
    (employee: Employee) => {
      router.push(`/employees/${employee.id}`)
    },
    [router]
  )

  return (
    <div className="space-y-4">
      <ResultsCount count={items.length} singular="employee" plural="employees" loading={loading} />
      <DataTable
        columns={columns}
        data={items}
        initialSorting={[{ id: 'employeeId', desc: false }]}
        loading={loading}
        skeletonRows={6}
        onRowClick={handleRowClick}
        emptyState={
          <TableEmptyContent icon={<UsersIcon className="h-10 w-10" />} title="No employees found" />
        }
      />
    </div>
  )
}

// ============ LEAVES TAB ============
const LEAVE_TYPE_FILTER_OPTIONS: FilterOption[] = LEAVE_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

const LEAVE_STATUS_FILTER_OPTIONS: FilterOption[] = LEAVE_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  }

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }

  return `${startDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function LeavesTab() {
  const router = useRouter()
  const [items, setItems] = useState<LeaveRequest[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await LeavesApi.list({
        status: filters.status || undefined,
      })
      setItems(data.items)
    } catch (e) {
      console.error('Failed to load leaves', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filters.status])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo<ColumnDef<LeaveRequest>[]>(
    () => [
      {
        id: 'employee',
        header: 'Employee',
        accessorFn: (row) => `${row.employee?.firstName} ${row.employee?.lastName}`,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar
              src={row.original.employee?.avatar}
              alt={`${row.original.employee?.firstName} ${row.original.employee?.lastName}`}
              size="sm"
            />
            <div>
              <p className="font-medium text-foreground">
                {row.original.employee?.firstName} {row.original.employee?.lastName}
              </p>
              {row.original.reason && (
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {row.original.reason}
                </p>
              )}
            </div>
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'leaveType',
        header: 'Type',
        meta: {
          filterKey: 'leaveType',
          filterOptions: LEAVE_TYPE_FILTER_OPTIONS,
        },
        cell: ({ getValue }) => {
          const type = getValue<string>()
          return (
            <span className="text-muted-foreground">
              {LEAVE_TYPE_LABELS[type as keyof typeof LEAVE_TYPE_LABELS] ?? type}
            </span>
          )
        },
        enableSorting: true,
      },
      {
        accessorKey: 'startDate',
        header: 'Dates',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateRange(row.original.startDate, row.original.endDate)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'totalDays',
        header: 'Days',
        cell: ({ getValue }) => {
          const days = getValue<number>()
          return (
            <span className="text-muted-foreground">
              {days} day{days !== 1 ? 's' : ''}
            </span>
          )
        },
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: {
          filterKey: 'status',
          filterOptions: LEAVE_STATUS_FILTER_OPTIONS,
        },
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return (
            <StatusBadge
              status={LEAVE_STATUS_LABELS[status as keyof typeof LEAVE_STATUS_LABELS] ?? status}
            />
          )
        },
        enableSorting: true,
      },
    ],
    []
  )

  const handleRowClick = useCallback(
    (item: LeaveRequest) => {
      router.push(`/leaves/${item.id}`)
    },
    [router]
  )

  return (
    <div className="space-y-4">
      <ResultsCount count={items.length} singular="request" plural="requests" loading={loading} />
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        skeletonRows={5}
        onRowClick={handleRowClick}
        filters={filters}
        onFilterChange={setFilters}
        emptyState={
          <TableEmptyContent
            icon={<CalendarDaysIcon className="h-10 w-10" />}
            title="No leave requests found"
          />
        }
      />
    </div>
  )
}

// ============ REVIEWS TAB ============
const REVIEW_TYPE_FILTER_OPTIONS: FilterOption[] = REVIEW_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

const REVIEW_STATUS_FILTER_OPTIONS: FilterOption[] = REVIEW_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

function RatingStars({ rating }: { rating: number }) {
  const safeRating = Number.isFinite(rating) ? rating : 0
  if (safeRating <= 0) {
    return <span className="text-xs text-muted-foreground tabular-nums">—</span>
  }
  return (
    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums">
      <StarFilledIcon className="h-3.5 w-3.5 text-warning-500" />
      <span>{safeRating}/10</span>
    </div>
  )
}

function DeadlineBadge({ review }: { review: PerformanceReview }) {
  const deadline =
    review.deadline ?? (review as { quarterlyCycle?: { deadline?: string } }).quarterlyCycle?.deadline
  if (!deadline) return null

  const now = new Date()
  const deadlineDate = new Date(deadline)
  const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (review.status !== 'DRAFT') return null

  if (review.escalatedToHR) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-800">
        <ExclamationTriangleIcon className="h-3 w-3" />
        Escalated
      </span>
    )
  }

  if (daysUntil < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-800">
        <ClockIcon className="h-3 w-3" />
        {Math.abs(daysUntil)}d overdue
      </span>
    )
  }

  if (daysUntil <= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
        <ClockIcon className="h-3 w-3" />
        {daysUntil}d left
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
      <ClockIcon className="h-3 w-3" />
      {daysUntil}d left
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ReviewsTab() {
  const router = useRouter()
  const [items, setItems] = useState<PerformanceReview[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await PerformanceReviewsApi.list({
        status: filters.status || undefined,
        reviewType: filters.reviewType || undefined,
      })
      setItems(data.items)
    } catch (err) {
      console.error('Error fetching reviews:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.reviewType])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo<ColumnDef<PerformanceReview>[]>(
    () => [
      {
        accessorFn: (row) => `${row.employee?.firstName} ${row.employee?.lastName}`,
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.employee?.firstName} {row.original.employee?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{row.original.employee?.department}</p>
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'reviewerName',
        header: 'Reviewer',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'reviewType',
        header: 'Type',
        meta: {
          filterKey: 'reviewType',
          filterOptions: REVIEW_TYPE_FILTER_OPTIONS,
        },
        cell: ({ getValue }) => {
          const type = getValue<string>()
          return (
            <span className="text-muted-foreground">
              {REVIEW_TYPE_LABELS[type as keyof typeof REVIEW_TYPE_LABELS] ?? type}
            </span>
          )
        },
        enableSorting: true,
      },
      {
        accessorKey: 'reviewDate',
        header: 'Date',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'overallRating',
        header: 'Rating',
        cell: ({ getValue }) => <RatingStars rating={getValue<number>()} />,
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: {
          filterKey: 'status',
          filterOptions: REVIEW_STATUS_FILTER_OPTIONS,
        },
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return (
            <StatusBadge
              status={REVIEW_STATUS_LABELS[status as keyof typeof REVIEW_STATUS_LABELS] ?? status}
            />
          )
        },
        enableSorting: true,
      },
      {
        id: 'deadline',
        header: 'Deadline',
        cell: ({ row }) => <DeadlineBadge review={row.original} />,
        enableSorting: false,
      },
    ],
    []
  )

  const handleRowClick = useCallback(
    (review: PerformanceReview) => {
      router.push(`/performance/reviews/${review.id}`)
    },
    [router]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ResultsCount count={items.length} singular="review" plural="reviews" loading={loading} />
        <Button href="/performance/reviews/add" size="sm" icon={<PlusIcon className="h-4 w-4" />}>
          New Review
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        skeletonRows={5}
        onRowClick={handleRowClick}
        filters={filters}
        onFilterChange={setFilters}
        emptyState={
          <TableEmptyContent
            icon={<ClipboardDocumentCheckIcon className="h-10 w-10" />}
            title="No reviews found"
          />
        }
      />
    </div>
  )
}

// ============ VIOLATIONS TAB ============
const SEVERITY_OPTIONS: FilterOption[] = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'CRITICAL', label: 'Critical' },
]

const VIOLATION_STATUS_OPTIONS: FilterOption[] = [...DISCIPLINARY_STATUS_OPTIONS]

const SEVERITY_LABELS: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label])
)

const VIOLATION_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  VIOLATION_STATUS_OPTIONS.map((o) => [o.value, o.label])
)

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-muted text-muted-foreground',
  MODERATE: 'bg-warning-100 text-warning-800',
  MAJOR: 'bg-danger-100 text-danger-700',
  CRITICAL: 'bg-danger-500 text-white',
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.MINOR}`}
    >
      {SEVERITY_LABELS[severity] ?? severity}
    </span>
  )
}

function ViolationsTab() {
  const router = useRouter()
  const [items, setItems] = useState<DisciplinaryAction[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await DisciplinaryActionsApi.list({
        status: filters.status || undefined,
        severity: filters.severity || undefined,
      })
      setItems(data.items)
    } catch (err) {
      console.error('Error fetching violations:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.severity])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo<ColumnDef<DisciplinaryAction>[]>(
    () => [
      {
        accessorFn: (row) => `${row.employee?.firstName} ${row.employee?.lastName}`,
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.employee?.firstName} {row.original.employee?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{row.original.employee?.department}</p>
          </div>
        ),
        enableSorting: true,
      },
      {
        id: 'reportedBy',
        header: 'Reported By',
        accessorFn: (row) => {
          if (row.createdBy) {
            return `${row.createdBy.firstName} ${row.createdBy.lastName}`
          }
          return row.reportedBy
        },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'violationType',
        header: 'Type',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        meta: {
          filterKey: 'severity',
          filterOptions: SEVERITY_OPTIONS,
        },
        cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} />,
        enableSorting: true,
      },
      {
        accessorKey: 'incidentDate',
        header: 'Incident Date',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: {
          filterKey: 'status',
          filterOptions: VIOLATION_STATUS_OPTIONS,
        },
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return <StatusBadge status={VIOLATION_STATUS_LABELS[status] ?? status} />
        },
        enableSorting: true,
      },
    ],
    []
  )

  const handleRowClick = useCallback(
    (action: DisciplinaryAction) => {
      router.push(`/performance/violations/${action.id}`)
    },
    [router]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ResultsCount
          count={items.length}
          singular="violation"
          plural="violations"
          loading={loading}
        />
        <Button href="/performance/violations/add" size="sm" icon={<PlusIcon className="h-4 w-4" />}>
          New Violation
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        skeletonRows={5}
        onRowClick={handleRowClick}
        filters={filters}
        onFilterChange={setFilters}
        emptyState={
          <TableEmptyContent
            icon={<ExclamationTriangleIcon className="h-10 w-10" />}
            title="No violations found"
          />
        }
      />
    </div>
  )
}

// ============ MAIN HR PAGE ============
export default function HRPage() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') ?? 'employees'

  return (
    <>
      <ListPageHeader
        title="HR"
        description="Manage employees, leave requests, reviews, and violations"
        icon={<UsersIcon className="h-6 w-6 text-white" />}
      />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="employees" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2">
            <CalendarDaysIcon className="h-4 w-4" />
            Leaves
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2">
            <ClipboardDocumentCheckIcon className="h-4 w-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="violations" className="gap-2">
            <ExclamationTriangleIcon className="h-4 w-4" />
            Violations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeesTab />
        </TabsContent>

        <TabsContent value="leaves">
          <LeavesTab />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsTab />
        </TabsContent>

        <TabsContent value="violations">
          <ViolationsTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
