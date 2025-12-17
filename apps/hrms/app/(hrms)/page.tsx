'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  DashboardApi,
  NotificationsApi,
  PerformanceReviewsApi,
  DisciplinaryActionsApi,
  LeavesApi,
  type DashboardData,
  type PerformanceReview,
  type DisciplinaryAction,
  type LeaveBalance,
  type LeaveRequest,
} from '@/lib/api-client'
import {
  HomeIcon,
  UsersIcon,
  BellIcon,
  SpinnerIcon,
  CheckIcon,
  ExclamationCircleIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  ShieldExclamationIcon,
  StarFilledIcon,
  PencilIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/Badge'
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { LeaveHistoryTable } from '@/components/leave/LeaveHistoryTable'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'
import { PendingLeaveApprovals } from '@/components/leave/PendingLeaveApprovals'
import { LeaveApprovalHistory } from '@/components/leave/LeaveApprovalHistory'
import { StandingCard } from '@/components/employee/StandingCard'
import { employmentTypeLabels } from '@/lib/constants'

type Tab = 'overview' | 'leave' | 'reviews' | 'violations'

const REVIEW_TYPE_LABELS: Record<string, string> = {
  PROBATION: '90-Day Probation',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  PROMOTION: 'Promotion',
  PIP: 'Performance Improvement',
}

const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  MAJOR: 'Major',
  CRITICAL: 'Critical',
}

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-yellow-100 text-yellow-800',
  MODERATE: 'bg-orange-100 text-orange-800',
  MAJOR: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-200 text-red-900',
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarFilledIcon
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
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
    </button>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900 font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Tab-specific data
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [disciplinary, setDisciplinary] = useState<DisciplinaryAction[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [disciplinaryLoading, setDisciplinaryLoading] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [showLeaveForm, setShowLeaveForm] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const dashboardData = await DashboardApi.get()
      setData(dashboardData)
      // Initialize leave balances from dashboard data
      if (dashboardData.myLeaveBalance) {
        setLeaveBalances(dashboardData.myLeaveBalance)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Load reviews when tab is selected
  useEffect(() => {
    async function loadReviews() {
      if (activeTab !== 'reviews' || !data?.currentEmployee?.id) return
      try {
        setReviewsLoading(true)
        const result = await PerformanceReviewsApi.list({ employeeId: data.currentEmployee.id })
        setReviews(result.items || [])
      } catch (e) {
        console.error('Failed to load reviews', e)
      } finally {
        setReviewsLoading(false)
      }
    }
    loadReviews()
  }, [activeTab, data?.currentEmployee?.id])

  // Load violations when tab is selected
  useEffect(() => {
    async function loadDisciplinary() {
      if (activeTab !== 'violations' || !data?.currentEmployee?.id) return
      try {
        setDisciplinaryLoading(true)
        const result = await DisciplinaryActionsApi.list({ employeeId: data.currentEmployee.id })
        setDisciplinary(result.items || [])
      } catch (e) {
        console.error('Failed to load disciplinary actions', e)
      } finally {
        setDisciplinaryLoading(false)
      }
    }
    loadDisciplinary()
  }, [activeTab, data?.currentEmployee?.id])

  // Load leave data when tab is selected
  useEffect(() => {
    async function loadLeave() {
      if (activeTab !== 'leave' || !data?.currentEmployee?.id) return
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
  }, [activeTab, data?.currentEmployee?.id])

  const handleLeaveRequestSuccess = async () => {
    setShowLeaveForm(false)
    if (!data?.currentEmployee?.id) return
    // Reload leave data
    const [balanceData, requestsData] = await Promise.all([
      LeavesApi.getBalance({ employeeId: data.currentEmployee.id }),
      LeavesApi.list({ employeeId: data.currentEmployee.id }),
    ])
    setLeaveBalances(balanceData.balances || [])
    setLeaveRequests(requestsData.items || [])
  }

  const handleCancelLeave = async (requestId: string) => {
    if (!data?.currentEmployee?.id) return
    await LeavesApi.update(requestId, { status: 'CANCELLED' })
    // Reload leave data
    const [balanceData, requestsData] = await Promise.all([
      LeavesApi.getBalance({ employeeId: data.currentEmployee.id }),
      LeavesApi.list({ employeeId: data.currentEmployee.id }),
    ])
    setLeaveBalances(balanceData.balances || [])
    setLeaveRequests(requestsData.items || [])
  }

  const markNotificationRead = async (id: string) => {
    try {
      await NotificationsApi.markAsRead([id])
      if (data) {
        setData({
          ...data,
          notifications: data.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
          unreadNotificationCount: Math.max(0, data.unreadNotificationCount - 1),
        })
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const markAllRead = async () => {
    if (!data) return
    const unreadIds = data.notifications.filter((n) => !n.isRead).map((n) => n.id)
    if (unreadIds.length === 0) return

    try {
      await NotificationsApi.markAsRead(unreadIds)
      setData({
        ...data,
        notifications: data.notifications.map((n) => ({ ...n, isRead: true })),
        unreadNotificationCount: 0,
      })
    } catch (err) {
      console.error('Failed to mark notifications as read:', err)
    }
  }

  if (loading) {
    return (
      <>
        <ListPageHeader
          title="My Profile"
          description="Welcome to your HR management system"
          icon={<HomeIcon className="h-6 w-6 text-white" />}
        />
        <div className="flex items-center justify-center h-64">
          <SpinnerIcon className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <ListPageHeader
          title="My Profile"
          description="Welcome to your HR management system"
          icon={<HomeIcon className="h-6 w-6 text-white" />}
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
  const hasNotifications = data?.notifications && data.notifications.length > 0
  const unreadCount = data?.unreadNotificationCount ?? 0

  if (!currentEmployee) {
    return (
      <>
        <ListPageHeader
          title="My Profile"
          description="Welcome to your HR management system"
          icon={<HomeIcon className="h-6 w-6 text-white" />}
        />
        <Card padding="lg">
          <Alert variant="error">Your employee profile was not found</Alert>
        </Card>
      </>
    )
  }

  const joinDate = currentEmployee.joinDate
    ? new Date(currentEmployee.joinDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  return (
    <>
      <ListPageHeader
        title="My Profile"
        description={
          data?.user
            ? `${data.user.position} • ${data.user.department}`
            : 'Your HR management dashboard'
        }
        icon={<HomeIcon className="h-6 w-6 text-white" />}
        action={
          <Button
            href={`/employees/${currentEmployee.id}/edit`}
            icon={<PencilIcon className="h-4 w-4" />}
          >
            Edit Profile
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Employee Header Card */}
        <Card padding="lg">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <Avatar
              src={currentEmployee.avatar}
              alt={`${currentEmployee.firstName} ${currentEmployee.lastName}`}
              size="lg"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {currentEmployee.firstName} {currentEmployee.lastName}
                </h2>
                <StatusBadge status={currentEmployee.status.replace('_', ' ')} />
              </div>
              <p className="text-gray-600">{currentEmployee.position}</p>
              <p className="text-sm text-gray-500 mt-1">{currentEmployee.employeeId}</p>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={UsersIcon}
          >
            Overview
          </TabButton>
          <TabButton
            active={activeTab === 'leave'}
            onClick={() => setActiveTab('leave')}
            icon={CalendarDaysIcon}
          >
            Leave
          </TabButton>
          <TabButton
            active={activeTab === 'reviews'}
            onClick={() => setActiveTab('reviews')}
            icon={ClipboardDocumentCheckIcon}
          >
            Reviews
          </TabButton>
          <TabButton
            active={activeTab === 'violations'}
            onClick={() => setActiveTab('violations')}
            icon={ShieldExclamationIcon}
          >
            Violations
          </TabButton>
        </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Standing Card */}
              <StandingCard employeeId={currentEmployee.id} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card padding="lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Contact Information
                  </h3>
                  <div className="space-y-4">
                    <InfoItem icon={EnvelopeIcon} label="Email" value={currentEmployee.email} />
                    <InfoItem
                      icon={PhoneIcon}
                      label="Phone"
                      value={currentEmployee.phone || '—'}
                    />
                  </div>
                </Card>

                <Card padding="lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Information</h3>
                  <div className="space-y-4">
                    <InfoItem
                      icon={BuildingIcon}
                      label="Department"
                      value={currentEmployee.department || '—'}
                    />
                    <InfoItem icon={CalendarIcon} label="Join Date" value={joinDate} />
                    <div className="flex items-start gap-3">
                      <UsersIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Employment Type</p>
                        <p className="text-sm text-gray-900 font-medium">
                          {employmentTypeLabels[currentEmployee.employmentType] ||
                            currentEmployee.employmentType}
                        </p>
                      </div>
                    </div>
                    {currentEmployee.reportsTo && (
                      <div className="flex items-start gap-3">
                        <UsersIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Reports To</p>
                          <p className="text-sm text-gray-900 font-medium">
                            {currentEmployee.reportsTo.firstName} {currentEmployee.reportsTo.lastName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="space-y-6">
              {/* Manager: Pending Approvals */}
              {data?.isManager && data?.pendingLeaveRequests && data.pendingLeaveRequests.length > 0 && (
                <Card padding="lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Pending Approvals ({data.pendingLeaveRequests.length})
                  </h3>
                  <PendingLeaveApprovals
                    requests={data.pendingLeaveRequests}
                    onUpdate={fetchDashboardData}
                  />
                </Card>
              )}

              {/* Manager: Approval History */}
              {data?.isManager && data?.leaveApprovalHistory && data.leaveApprovalHistory.length > 0 && (
                <Card padding="lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Your Approval History
                  </h3>
                  <LeaveApprovalHistory history={data.leaveApprovalHistory} />
                </Card>
              )}

              {/* Leave Balance */}
              <Card padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Leave Balance</h3>
                  <Button size="sm" onClick={() => setShowLeaveForm(!showLeaveForm)}>
                    {showLeaveForm ? 'Cancel' : 'Request Leave'}
                  </Button>
                </div>

                {showLeaveForm && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <LeaveRequestForm
                      employeeId={currentEmployee.id}
                      onSuccess={handleLeaveRequestSuccess}
                      onCancel={() => setShowLeaveForm(false)}
                    />
                  </div>
                )}

                {leaveLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <LeaveBalanceCards balances={leaveBalances} />
                )}
              </Card>

              {/* Leave History */}
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Leave History</h3>
                {leaveLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                    ))}
                  </div>
                ) : leaveRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarDaysIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No leave requests yet</p>
                  </div>
                ) : (
                  <LeaveHistoryTable
                    requests={leaveRequests}
                    onCancel={handleCancelLeave}
                  />
                )}
              </Card>
            </div>
          )}

          {activeTab === 'reviews' && (
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance Reviews</h3>

              {reviewsLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardDocumentCheckIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No performance reviews yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <Link
                      key={review.id}
                      href={`/performance/reviews/${review.id}`}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {REVIEW_TYPE_LABELS[review.reviewType] || review.reviewType}
                            </span>
                            <StatusBadge status={review.status} />
                          </div>
                          <p className="text-sm text-gray-600">{review.reviewPeriod}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Reviewed by {review.reviewerName} on{' '}
                            {new Date(review.reviewDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <StarRating rating={review.overallRating} />
                          <p className="text-xs text-gray-500 mt-1">{review.overallRating}/5</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'violations' && (
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Disciplinary Records</h3>

              {disciplinaryLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              ) : disciplinary.length === 0 ? (
                <div className="text-center py-8">
                  <CheckIcon className="h-10 w-10 text-green-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No violations on record</p>
                  <p className="text-xs text-gray-400 mt-1">Keep up the good work!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disciplinary.map((action) => (
                    <Link
                      key={action.id}
                      href={`/performance/disciplinary/${action.id}`}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {action.violationType.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[action.severity] || 'bg-gray-100 text-gray-700'}`}
                            >
                              {SEVERITY_LABELS[action.severity] || action.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {action.violationReason.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Incident: {new Date(action.incidentDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <StatusBadge status={action.status.replace(/_/g, ' ')} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

        {/* Notifications - Only in Overview mode */}
        {activeTab === 'overview' && hasNotifications && (
          <Card padding="none">
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <BellIcon className="h-4 w-4 text-blue-600" />
                Notifications
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h2>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100 max-h-[40vh] overflow-y-auto">
              {data.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-5 py-3 transition-colors ${
                    notification.isRead ? 'bg-white' : 'bg-amber-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex-shrink-0 ${notification.isRead ? 'text-gray-400' : 'text-amber-500'}`}>
                      {notification.isRead ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <ExclamationCircleIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notification.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] text-gray-400">{formatDate(notification.createdAt)}</span>
                        {notification.link && (
                          <Link href={notification.link} className="text-[11px] text-blue-600 hover:text-blue-700">
                            View details
                          </Link>
                        )}
                        {!notification.isRead && (
                          <button
                            onClick={() => markNotificationRead(notification.id)}
                            className="text-[11px] text-gray-500 hover:text-gray-700"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
