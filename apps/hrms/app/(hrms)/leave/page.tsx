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
  UsersIcon,
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
import { TabButton } from '@/components/ui/TabButton'
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'

type Tab = 'my-leave' | 'team'

// Simplified leave types for small team (15-20 people)
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

type TeamFilter = 'pending' | 'all'

type TeamLeaveRequest = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
  reason?: string | null
  employee: { id: string; firstName: string; lastName: string; avatar?: string | null }
}

// Team Leave Section with unified table
function TeamLeaveSection({
  pendingRequests,
  approvalHistory,
  loading,
  processingId,
  onApprove,
  onReject,
}: {
  pendingRequests: TeamLeaveRequest[]
  approvalHistory: TeamLeaveRequest[]
  loading: boolean
  processingId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const [filter, setFilter] = useState<TeamFilter>('pending')
  const [q, setQ] = useState('')

  // Combine and dedupe requests
  const allRequests = [
    ...pendingRequests,
    ...approvalHistory.filter(h => !pendingRequests.find(p => p.id === h.id)),
  ]

  const displayRequests = filter === 'pending' ? pendingRequests : allRequests

  const filteredRequests = displayRequests.filter((r) => {
    if (!q) return true
    const searchLower = q.toLowerCase()
    const name = `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase()
    const leaveType = LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType
    return (
      name.includes(searchLower) ||
      leaveType.toLowerCase().includes(searchLower) ||
      r.reason?.toLowerCase().includes(searchLower)
    )
  })

  const columns = useMemo<ColumnDef<TeamLeaveRequest>[]>(
    () => [
      {
        id: 'avatar',
        header: '',
        cell: ({ row }) => (
          <Avatar
            src={row.original.employee.avatar}
            alt={`${row.original.employee.firstName} ${row.original.employee.lastName}`}
            size="sm"
          />
        ),
        enableSorting: false,
      },
      {
        accessorFn: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.employee.firstName} {row.original.employee.lastName}
            </p>
            {row.original.reason && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {row.original.reason}
              </p>
            )}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'leaveType',
        header: 'Leave Type',
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
        header: 'Actions',
        cell: ({ row }) => {
          if (row.original.status === 'PENDING') {
            return (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReject(row.original.id)}
                  disabled={processingId === row.original.id}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => onApprove(row.original.id)}
                  disabled={processingId === row.original.id}
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            )
          }
          return <span className="text-xs text-muted-foreground">—</span>
        },
        enableSorting: false,
      },
    ],
    [processingId, onApprove, onReject]
  )

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === 'pending'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending
          {pendingRequests.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs font-semibold bg-warning-100 text-warning-800 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Requests
        </button>
      </div>

      {/* Search */}
      <Card padding="md">
        <SearchForm
          value={q}
          onChange={setQ}
          onSubmit={() => {}}
          placeholder="Search by name or leave type..."
        />
      </Card>

      <ResultsCount
        count={filteredRequests.length}
        singular="request"
        plural="requests"
        loading={loading}
      />

      <DataTable
        columns={columns}
        data={filteredRequests}
        loading={loading}
        skeletonRows={5}
        emptyState={
          <TableEmptyContent
            icon={<UsersIcon className="h-10 w-10" />}
            title={
              filter === 'pending'
                ? 'No pending requests. All team leave requests have been processed.'
                : 'No leave requests found.'
            }
          />
        }
      />
    </div>
  )
}

// Slide-over panel for Request Leave form
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-card shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Request Leave</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <XIcon className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
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
  const [activeTab, setActiveTab] = useState<Tab>('my-leave')

  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveLoading, setLeaveLoading] = useState(true)
  const [showLeavePanel, setShowLeavePanel] = useState(false)
  const [q, setQ] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Open panel if request=true query param is present
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

  // Load leave data
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
        setLeaveRequests(requestsData.items)
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
    setLeaveRequests(requestsData.items)
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
      setLeaveRequests(requestsData.items)
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

  // Filter requests based on search
  const filteredRequests = leaveRequests.filter((r) => {
    if (!q) return true
    const searchLower = q.toLowerCase()
    const leaveType = LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType
    return (
      leaveType.toLowerCase().includes(searchLower) ||
      r.status.toLowerCase().includes(searchLower) ||
      r.reason?.toLowerCase().includes(searchLower)
    )
  })

  // My Leave table columns
  const myLeaveColumns = useMemo<ColumnDef<LeaveRequest>[]>(
    () => [
      {
        accessorKey: 'leaveType',
        header: 'Leave Type',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {LEAVE_TYPE_LABELS[row.original.leaveType] ?? row.original.leaveType.replace(/_/g, ' ')}
            </p>
            {row.original.reason && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {row.original.reason}
              </p>
            )}
          </div>
        ),
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
        accessorKey: 'createdAt',
        header: 'Submitted',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return <StatusBadge status={STATUS_LABELS[status] ?? status} />
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          if (row.original.status === 'PENDING') {
            return (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCancelLeave(row.original.id)}
                disabled={processingId === row.original.id}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Cancel request"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )
          }
          if (row.original.status === 'APPROVED' && row.original.reviewedBy) {
            return (
              <span className="text-xs text-muted-foreground">
                by {row.original.reviewedBy.firstName}
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
  const pendingCount = data?.pendingLeaveRequests?.length ?? 0

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

      {/* Request Leave Slide-over Panel */}
      <RequestLeavePanel
        isOpen={showLeavePanel}
        onClose={() => setShowLeavePanel(false)}
        employeeId={currentEmployee.id}
        onSuccess={handleLeaveRequestSuccess}
      />

      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <TabButton
            active={activeTab === 'my-leave'}
            onClick={() => setActiveTab('my-leave')}
            icon={CalendarDaysIcon}
          >
            My Leave
          </TabButton>
          {data?.isManager && (
            <TabButton
              active={activeTab === 'team'}
              onClick={() => setActiveTab('team')}
              icon={UsersIcon}
              badge={pendingCount}
            >
              Team
            </TabButton>
          )}
        </div>

        {/* My Leave Tab */}
        {activeTab === 'my-leave' && (
          <div className="space-y-6">
            {/* Leave Balance Summary */}
            <Card padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Leave Balance</h3>
                {!leaveLoading && (
                  <span className="text-xs text-muted-foreground">
                    {leaveBalances.filter(b => b.leaveType !== 'UNPAID').length} types available
                  </span>
                )}
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

            {/* Search */}
            <Card padding="md">
              <SearchForm
                value={q}
                onChange={setQ}
                onSubmit={() => {}}
                placeholder="Search by leave type, status, or reason..."
              />
            </Card>

            {/* Results count */}
            <ResultsCount
              count={filteredRequests.length}
              singular="request"
              plural="requests"
              loading={leaveLoading}
            />

            {/* Leave Requests Table */}
            <DataTable
              columns={myLeaveColumns}
              data={filteredRequests}
              loading={leaveLoading}
              skeletonRows={5}
              emptyState={
                <TableEmptyContent
                  icon={<CalendarDaysIcon className="h-10 w-10" />}
                  title="No leave requests yet. Click 'Request Leave' to submit your first request."
                />
              }
            />
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && data?.isManager && (
          <TeamLeaveSection
            pendingRequests={data.pendingLeaveRequests ?? []}
            approvalHistory={data.leaveApprovalHistory ?? []}
            loading={loading}
            processingId={processingId}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
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
