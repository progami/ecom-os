'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
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
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'

type Tab = 'my-leave' | 'team'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PTO: 'PTO',
  ANNUAL: 'Annual Leave',
  SICK: 'Sick Leave',
  PERSONAL: 'Personal Leave',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  PARENTAL: 'Parental',
  BEREAVEMENT_IMMEDIATE: 'Bereavement (Immediate)',
  BEREAVEMENT_EXTENDED: 'Bereavement (Extended)',
  BEREAVEMENT: 'Bereavement',
  JURY_DUTY: 'Jury Duty',
  UNPAID: 'Unpaid',
  COMP_TIME: 'Comp Time',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

function TabButton({
  active,
  onClick,
  children,
  icon: Icon,
  badge,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full">
          {badge}
        </span>
      )}
    </button>
  )
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

function TableRowSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded w-20" /></td>
        </tr>
      ))}
    </>
  )
}

function TeamTableRowSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-4"><div className="h-10 w-10 bg-gray-200 rounded-full" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
          <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded w-20" /></td>
          <td className="px-4 py-4"><div className="h-8 bg-gray-200 rounded w-24" /></td>
        </tr>
      ))}
    </>
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
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Request Leave</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XIcon className="h-5 w-5" />
              </button>
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

export default function LeavePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('my-leave')

  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [showLeavePanel, setShowLeavePanel] = useState(false)
  const [q, setQ] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

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
        setLeaveBalances(balanceData.balances || [])
        setLeaveRequests(requestsData.items || [])
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
    setLeaveBalances(balanceData.balances || [])
    setLeaveRequests(requestsData.items || [])
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
      setLeaveBalances(balanceData.balances || [])
      setLeaveRequests(requestsData.items || [])
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
    const leaveType = LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType
    return (
      leaveType.toLowerCase().includes(searchLower) ||
      r.status.toLowerCase().includes(searchLower) ||
      r.reason?.toLowerCase().includes(searchLower)
    )
  })

  // Filter pending requests based on search
  const filteredPendingRequests = (data?.pendingLeaveRequests || []).filter((r) => {
    if (!q) return true
    const searchLower = q.toLowerCase()
    const name = `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase()
    const leaveType = LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType
    return (
      name.includes(searchLower) ||
      leaveType.toLowerCase().includes(searchLower) ||
      r.reason?.toLowerCase().includes(searchLower)
    )
  })

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
            <div className="animate-pulse h-10 bg-gray-200 rounded w-full" />
          </Card>
          <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />
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
          <Alert variant="error">Your employee profile was not found</Alert>
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
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Leave Balance</h3>
              <LeaveBalanceCards balances={leaveBalances} />
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

            <ResultsCount
              count={filteredRequests.length}
              singular="request"
              plural="requests"
              loading={leaveLoading}
            />

            {/* Leave Requests Table */}
            <Table>
              <TableHeader>
                <TableHead>Leave Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">{''}</TableHead>
              </TableHeader>
              <TableBody>
                {leaveLoading ? (
                  <TableRowSkeleton />
                ) : filteredRequests.length === 0 ? (
                  <TableEmptyState
                    colSpan={6}
                    icon={<CalendarDaysIcon className="h-10 w-10" />}
                    title="No leave requests yet. Click 'Request Leave' to submit your first request."
                  />
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">
                            {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType.replace(/_/g, ' ')}
                          </p>
                          {request.reason && (
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {request.reason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {formatDateRange(request.startDate, request.endDate)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={STATUS_LABELS[request.status] || request.status} />
                      </TableCell>
                      <TableCell>
                        {request.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelLeave(request.id)}
                            disabled={processingId === request.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel request"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        )}
                        {request.status === 'APPROVED' && request.reviewedBy && (
                          <span className="text-xs text-gray-400">
                            by {request.reviewedBy.firstName}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && data?.isManager && (
          <div className="space-y-6">
            {/* Search */}
            <Card padding="md">
              <SearchForm
                value={q}
                onChange={setQ}
                onSubmit={() => {}}
                placeholder="Search by employee name, leave type..."
              />
            </Card>

            <ResultsCount
              count={filteredPendingRequests.length}
              singular="pending request"
              plural="pending requests"
              loading={loading}
            />

            {/* Pending Approvals Table */}
            <Table>
              <TableHeader>
                <TableHead className="w-14">{''}</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TeamTableRowSkeleton />
                ) : filteredPendingRequests.length === 0 ? (
                  <TableEmptyState
                    colSpan={7}
                    icon={<UsersIcon className="h-10 w-10" />}
                    title="No pending requests. All team leave requests have been processed."
                  />
                ) : (
                  filteredPendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Avatar
                          src={request.employee.avatar}
                          alt={`${request.employee.firstName} ${request.employee.lastName}`}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">
                            {request.employee.firstName} {request.employee.lastName}
                          </p>
                          {request.reason && (
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {request.reason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {formatDateRange(request.startDate, request.endDate)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <ClockIcon className="h-3 w-3" />
                          Pending
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(request.id)}
                            disabled={processingId === request.id}
                            className="text-gray-600 hover:text-red-600 hover:bg-red-50"
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            disabled={processingId === request.id}
                          >
                            <CheckIcon className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Approval History */}
            {data.leaveApprovalHistory && data.leaveApprovalHistory.length > 0 && (
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Recent Approval History
                </h3>
                <div className="space-y-3">
                  {data.leaveApprovalHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={item.employee.avatar}
                          alt={`${item.employee.firstName} ${item.employee.lastName}`}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.employee.firstName} {item.employee.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {LEAVE_TYPE_LABELS[item.leaveType] || item.leaveType} · {item.totalDays} day{item.totalDays !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={STATUS_LABELS[item.status] || item.status} />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
