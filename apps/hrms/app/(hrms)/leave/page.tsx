'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import {
  DashboardApi,
  LeavesApi,
  type DashboardData,
  type LeaveBalance,
  type LeaveRequest,
} from '@/lib/api-client'
import {
  CalendarDaysIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
  ClockIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { SearchForm } from '@/components/ui/SearchForm'
import { DataTable } from '@/components/ui/DataTable'
import { ResultsCount } from '@/components/ui/table'
import { TableEmptyContent } from '@/components/ui/EmptyState'
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'
import { NativeSelect } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PTO: 'PTO',
  PARENTAL: 'Parental Leave',
  BEREAVEMENT_IMMEDIATE: 'Bereavement',
  UNPAID: 'Unpaid Leave',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(start)
  }

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }

  return `${formatDate(start)} - ${formatDate(end)}`
}

type LeaveItem = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
  reason?: string | null
  createdAt?: string
  employee: { id: string; firstName: string; lastName: string; avatar?: string | null }
  reviewedBy?: { id: string; firstName: string; lastName: string } | null
  isOwn: boolean
}

function RequestLeavePanel({
  isOpen,
  onClose,
  employeeId,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  employeeId: string
  onSuccess: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="relative z-50">
      <div
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Request Leave</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <LeaveRequestForm
                employeeId={employeeId}
                onSuccess={() => {
                  onSuccess()
                  onClose()
                }}
                onCancel={onClose}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LeavePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [leaveLoading, setLeaveLoading] = useState(true)
  const [showLeavePanel, setShowLeavePanel] = useState(false)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('request') === 'true') {
      setShowLeavePanel(true)
      router.replace('/leave', { scroll: false })
    }
  }, [searchParams, router])

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const dashboardData = await DashboardApi.get()
      setData(dashboardData)
      if (dashboardData.myLeaveBalance) {
        setLeaveBalances(dashboardData.myLeaveBalance)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  useEffect(() => {
    async function loadLeave() {
      if (!data?.currentEmployee?.id) return
      try {
        setLeaveLoading(true)
        const [balanceData, requestsData] = await Promise.all([
          LeavesApi.getBalance({ employeeId: data.currentEmployee.id }),
          LeavesApi.list({ employeeId: data.currentEmployee.id }),
        ])
        setLeaveBalances(balanceData.balances)
        setMyRequests(requestsData.items)
      } catch (e) {
        console.error('Failed to load leave data', e)
      } finally {
        setLeaveLoading(false)
      }
    }
    loadLeave()
  }, [data?.currentEmployee?.id])

  const handleLeaveRequestSuccess = async () => {
    if (!data?.currentEmployee?.id) return
    const [balanceData, requestsData] = await Promise.all([
      LeavesApi.getBalance({ employeeId: data.currentEmployee.id }),
      LeavesApi.list({ employeeId: data.currentEmployee.id }),
    ])
    setLeaveBalances(balanceData.balances)
    setMyRequests(requestsData.items)
    await fetchDashboardData()
  }

  const handleCancelLeave = async (requestId: string) => {
    if (!data?.currentEmployee?.id) return
    setProcessingId(requestId)
    try {
      await LeavesApi.update(requestId, { status: 'CANCELLED' })
      const [balanceData, requestsData] = await Promise.all([
        LeavesApi.getBalance({ employeeId: data.currentEmployee.id }),
        LeavesApi.list({ employeeId: data.currentEmployee.id }),
      ])
      setLeaveBalances(balanceData.balances)
      setMyRequests(requestsData.items)
    } finally {
      setProcessingId(null)
    }
  }

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    try {
      await LeavesApi.update(id, { status: 'APPROVED' })
      await fetchDashboardData()
    } catch (e) {
      console.error('Failed to approve leave', e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: string) => {
    setProcessingId(id)
    try {
      await LeavesApi.update(id, { status: 'REJECTED' })
      await fetchDashboardData()
    } catch (e) {
      console.error('Failed to reject leave', e)
    } finally {
      setProcessingId(null)
    }
  }

  // Combine my requests + team requests into unified list
  const allLeaveItems = useMemo<LeaveItem[]>(() => {
    const currentEmployeeId = data?.currentEmployee?.id
    if (!currentEmployeeId) return []

    const items: LeaveItem[] = []
    const seenIds = new Set<string>()

    // Add my requests
    for (const r of myRequests) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id)
        items.push({
          id: r.id,
          leaveType: r.leaveType,
          startDate: r.startDate,
          endDate: r.endDate,
          totalDays: r.totalDays,
          status: r.status,
          reason: r.reason,
          createdAt: r.createdAt,
          employee: {
            id: currentEmployeeId,
            firstName: data?.currentEmployee?.firstName ?? '',
            lastName: data?.currentEmployee?.lastName ?? '',
            avatar: data?.currentEmployee?.avatar,
          },
          reviewedBy: r.reviewedBy,
          isOwn: true,
        })
      }
    }

    // Add team's pending requests
    for (const r of data?.pendingLeaveRequests ?? []) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id)
        items.push({
          ...r,
          isOwn: false,
        })
      }
    }

    // Add team's approval history
    for (const r of data?.leaveApprovalHistory ?? []) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id)
        items.push({
          ...r,
          isOwn: false,
        })
      }
    }

    // Sort by date descending
    return items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
  }, [data, myRequests])

  // Apply filters
  const filteredItems = useMemo(() => {
    return allLeaveItems.filter((item) => {
      // Status filter
      if (statusFilter && item.status !== statusFilter) return false

      // Search filter
      if (q) {
        const searchLower = q.toLowerCase()
        const name = `${item.employee.firstName} ${item.employee.lastName}`.toLowerCase()
        const leaveType = (LEAVE_TYPE_LABELS[item.leaveType] ?? item.leaveType).toLowerCase()
        if (
          !name.includes(searchLower) &&
          !leaveType.includes(searchLower) &&
          !item.reason?.toLowerCase().includes(searchLower)
        ) {
          return false
        }
      }

      return true
    })
  }, [allLeaveItems, statusFilter, q])

  const columns = useMemo<ColumnDef<LeaveItem>[]>(
    () => [
      {
        id: 'employee',
        header: 'Employee',
        accessorFn: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar
              src={row.original.employee.avatar}
              alt={`${row.original.employee.firstName} ${row.original.employee.lastName}`}
              size="sm"
            />
            <div>
              <p className="font-medium text-foreground">
                {row.original.employee.firstName} {row.original.employee.lastName}
                {row.original.isOwn && (
                  <span className="ml-1.5 text-xs text-muted-foreground">(You)</span>
                )}
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
        cell: ({ getValue }) => {
          const type = getValue<string>()
          return <span className="text-muted-foreground">{LEAVE_TYPE_LABELS[type] ?? type}</span>
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
          return <span className="text-muted-foreground">{days} day{days !== 1 ? 's' : ''}</span>
        },
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>()
          if (status === 'PENDING') {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
                <ClockIcon className="h-3 w-3" />
                Pending
              </span>
            )
          }
          return <StatusBadge status={STATUS_LABELS[status] ?? status} />
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const item = row.original

          // Own pending request - can cancel
          if (item.isOwn && item.status === 'PENDING') {
            return (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCancelLeave(item.id)}
                disabled={processingId === item.id}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Cancel request"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )
          }

          // Team's pending request - can approve/reject
          if (!item.isOwn && item.status === 'PENDING') {
            return (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleReject(item.id)}
                  disabled={processingId === item.id}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(item.id)}
                  disabled={processingId === item.id}
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            )
          }

          // Approved - show who approved
          if (item.status === 'APPROVED' && item.reviewedBy) {
            return (
              <span className="text-xs text-muted-foreground">
                by {item.reviewedBy.firstName}
              </span>
            )
          }

          return null
        },
        enableSorting: false,
      },
    ],
    [processingId]
  )

  if (loading) {
    return (
      <>
        <ListPageHeader
          title="Leave Management"
          description="Request and manage time off"
          icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
        />
        <div className="space-y-6">
          <Card padding="md">
            <div className="animate-pulse h-10 bg-muted rounded w-full" />
          </Card>
          <div className="animate-pulse h-64 bg-muted/50 rounded-lg" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <ListPageHeader
          title="Leave Management"
          description="Request and manage time off"
          icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
        />
        <div className="flex flex-col items-center justify-center h-64">
          <Alert variant="error" className="max-w-md mb-4">
            {error}
          </Alert>
          <Button onClick={fetchDashboardData}>Retry</Button>
        </div>
      </>
    )
  }

  const currentEmployee = data?.currentEmployee

  if (!currentEmployee) {
    return (
      <>
        <ListPageHeader
          title="Leave Management"
          description="Request and manage time off"
          icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
        />
        <Card padding="lg">
          <Alert variant="error" className="mb-4">
            Your employee profile was not found.
          </Alert>
          <Button href="/no-access">Request access / support</Button>
        </Card>
      </>
    )
  }

  const pendingCount = allLeaveItems.filter(i => i.status === 'PENDING' && !i.isOwn).length

  return (
    <>
      <ListPageHeader
        title="Leave Management"
        description="Request and manage time off"
        icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
        action={
          <Button
            onClick={() => setShowLeavePanel(true)}
            icon={<PlusIcon className="h-4 w-4" />}
          >
            Request Leave
          </Button>
        }
      />

      <RequestLeavePanel
        isOpen={showLeavePanel}
        onClose={() => setShowLeavePanel(false)}
        employeeId={currentEmployee.id}
        onSuccess={handleLeaveRequestSuccess}
      />

      <div className="space-y-6">
        {/* Leave Balance */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">My Leave Balance</h3>
          </div>
          {leaveLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-card rounded-lg border border-border p-4">
                  <div className="h-4 bg-muted rounded w-16 mb-3" />
                  <div className="h-8 bg-muted rounded w-12 mb-3" />
                  <div className="h-1.5 bg-muted/50 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <LeaveBalanceCards balances={leaveBalances} />
          )}
        </Card>

        {/* Pending badge for managers */}
        {pendingCount > 0 && (
          <Alert variant="warning" title="Pending Approvals">
            You have {pendingCount} leave request{pendingCount !== 1 ? 's' : ''} awaiting your approval.
          </Alert>
        )}

        {/* Search and Filters */}
        <Card padding="md">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchForm
                value={q}
                onChange={setQ}
                onSubmit={() => {}}
                placeholder="Search by name or leave type..."
              />
            </div>
            <div className="w-36">
              <Label htmlFor="status-filter" className="sr-only">Status</Label>
              <NativeSelect
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </NativeSelect>
            </div>
          </div>
        </Card>

        <ResultsCount
          count={filteredItems.length}
          singular="request"
          plural="requests"
          loading={leaveLoading}
        />

        <DataTable
          columns={columns}
          data={filteredItems}
          loading={leaveLoading}
          skeletonRows={5}
          emptyState={
            <TableEmptyContent
              icon={<CalendarDaysIcon className="h-10 w-10" />}
              title="No leave requests found"
            />
          }
        />
      </div>
    </>
  )
}

function LeavePageSkeleton() {
  return (
    <>
      <ListPageHeader
        title="Leave Management"
        description="Request and manage time off"
        icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
      />
      <div className="space-y-6">
        <Card padding="md">
          <div className="animate-pulse h-10 bg-muted rounded w-full" />
        </Card>
        <div className="animate-pulse h-64 bg-muted/50 rounded-lg" />
      </div>
    </>
  )
}

export default function LeavePage() {
  return (
    <Suspense fallback={<LeavePageSkeleton />}>
      <LeavePageContent />
    </Suspense>
  )
}
