'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  EmployeesApi,
  PerformanceReviewsApi,
  DisciplinaryActionsApi,
  LeavesApi,
  type Employee,
  type PerformanceReview,
  type DisciplinaryAction,
  type LeaveBalance,
  type LeaveRequest,
} from '@/lib/api-client'
import {
  UsersIcon,
  PencilIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  ShieldExclamationIcon,
  StarFilledIcon,
  CalendarDaysIcon,
} from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { LeaveHistoryTable } from '@/components/leave/LeaveHistoryTable'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'
import { employmentTypeLabels } from '@/lib/constants'
import { StandingCard } from '@/components/employee/StandingCard'

type Tab = 'overview' | 'leave' | 'reviews' | 'disciplinary'

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

function EmployeeAvatar({ firstName, lastName, size = 'lg' }: { firstName: string; lastName: string; size?: 'sm' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-10 w-10 text-sm'
  return (
    <div className={`${sizeClasses} rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold`}>
      {firstName?.charAt(0)}{lastName?.charAt(0)}
    </div>
  )
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

function TabButton({ active, onClick, children, icon: Icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
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

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
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

export default function EmployeeViewPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [disciplinary, setDisciplinary] = useState<DisciplinaryAction[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [disciplinaryLoading, setDisciplinaryLoading] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    async function loadEmployee() {
      try {
        setLoading(true)
        const [data, permissionCheck, permissions] = await Promise.all([
          EmployeesApi.get(id),
          EmployeesApi.checkCanManage(id),
          EmployeesApi.getPermissions(id),
        ])
        setEmployee(data)
        setCanManage(permissionCheck.canManage)
        // User can edit if they have any editable fields (self or manager)
        setCanEdit(permissions.editableFields?.length > 0)
      } catch (e: any) {
        setError(e.message || 'Failed to load employee')
      } finally {
        setLoading(false)
      }
    }
    loadEmployee()
  }, [id])

  useEffect(() => {
    async function loadReviews() {
      if (activeTab !== 'reviews') return
      try {
        setReviewsLoading(true)
        const data = await PerformanceReviewsApi.list({ employeeId: id })
        setReviews(data.items || [])
      } catch (e) {
        console.error('Failed to load reviews', e)
      } finally {
        setReviewsLoading(false)
      }
    }
    loadReviews()
  }, [activeTab, id])

  useEffect(() => {
    async function loadDisciplinary() {
      if (activeTab !== 'disciplinary') return
      try {
        setDisciplinaryLoading(true)
        const data = await DisciplinaryActionsApi.list({ employeeId: id })
        setDisciplinary(data.items || [])
      } catch (e) {
        console.error('Failed to load disciplinary actions', e)
      } finally {
        setDisciplinaryLoading(false)
      }
    }
    loadDisciplinary()
  }, [activeTab, id])

  useEffect(() => {
    async function loadLeave() {
      if (activeTab !== 'leave') return
      try {
        setLeaveLoading(true)
        const [balanceData, requestsData] = await Promise.all([
          LeavesApi.getBalance({ employeeId: id }),
          LeavesApi.list({ employeeId: id }),
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
  }, [activeTab, id])

  const handleLeaveRequestSuccess = async () => {
    setShowLeaveForm(false)
    // Reload leave data
    const [balanceData, requestsData] = await Promise.all([
      LeavesApi.getBalance({ employeeId: id }),
      LeavesApi.list({ employeeId: id }),
    ])
    setLeaveBalances(balanceData.balances || [])
    setLeaveRequests(requestsData.items || [])
  }

  const handleCancelLeave = async (requestId: string) => {
    await LeavesApi.update(requestId, { status: 'CANCELLED' })
    // Reload leave data
    const [balanceData, requestsData] = await Promise.all([
      LeavesApi.getBalance({ employeeId: id }),
      LeavesApi.list({ employeeId: id }),
    ])
    setLeaveBalances(balanceData.balances || [])
    setLeaveRequests(requestsData.items || [])
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Employee Details"
          description="People"
          icon={<UsersIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <Card padding="lg">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-40" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
            </div>
          </div>
        </Card>
      </>
    )
  }

  if (!employee) {
    return (
      <>
        <PageHeader
          title="Employee Details"
          description="People"
          icon={<UsersIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <Card padding="lg">
          <Alert variant="error">{error || 'Employee not found'}</Alert>
        </Card>
      </>
    )
  }

  const joinDate = employee.joinDate ? new Date(employee.joinDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '—'

  return (
    <>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description="People"
        icon={<UsersIcon className="h-6 w-6 text-white" />}
        showBack
        actions={
          canEdit ? (
            <Button href={`/employees/${id}/edit`} icon={<PencilIcon className="h-4 w-4" />}>
              Edit
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* Employee Header Card */}
        <Card padding="lg">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <EmployeeAvatar firstName={employee.firstName} lastName={employee.lastName} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {employee.firstName} {employee.lastName}
                </h2>
                <StatusBadge status={employee.status.replace('_', ' ')} />
              </div>
              <p className="text-gray-600">{employee.position}</p>
              <p className="text-sm text-gray-500 mt-1">{employee.employeeId}</p>
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
            active={activeTab === 'disciplinary'}
            onClick={() => setActiveTab('disciplinary')}
            icon={ShieldExclamationIcon}
          >
            Disciplinary
          </TabButton>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Standing Card */}
            <StandingCard employeeId={id} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <InfoItem icon={EnvelopeIcon} label="Email" value={employee.email} />
                  <InfoItem icon={PhoneIcon} label="Phone" value={employee.phone || '—'} />
                </div>
              </Card>

              <Card padding="lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Information</h3>
                <div className="space-y-4">
                  <InfoItem icon={BuildingIcon} label="Department" value={employee.department || '—'} />
                  <InfoItem icon={CalendarIcon} label="Join Date" value={joinDate} />
                  <div className="flex items-start gap-3">
                    <UsersIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Employment Type</p>
                      <p className="text-sm text-gray-900 font-medium">{employmentTypeLabels[employee.employmentType] || employee.employmentType}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'leave' && (
          <div className="space-y-6">
            <LeaveBalanceCards balances={leaveBalances} />

            <Card padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Leave Requests</h3>
                <Button
                  size="sm"
                  onClick={() => setShowLeaveForm(!showLeaveForm)}
                >
                  {showLeaveForm ? 'Cancel' : 'Request Leave'}
                </Button>
              </div>

              {showLeaveForm && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <LeaveRequestForm
                    employeeId={id}
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
                <LeaveHistoryTable requests={leaveRequests} />
              )}
            </Card>
          </div>
        )}

        {activeTab === 'reviews' && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Performance Reviews</h3>
              {canManage && (
                <Button
                  size="sm"
                  href={`/performance/reviews/add?employeeId=${id}`}
                >
                  Add Review
                </Button>
              )}
            </div>

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
                          Reviewed by {review.reviewerName} on {new Date(review.reviewDate).toLocaleDateString()}
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

        {activeTab === 'disciplinary' && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Disciplinary Actions</h3>
              {canManage && (
                <Button
                  size="sm"
                  href={`/performance/disciplinary/add?employeeId=${id}`}
                >
                  Report Violation
                </Button>
              )}
            </div>

            {disciplinaryLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded-lg" />
                ))}
              </div>
            ) : disciplinary.length === 0 ? (
              <div className="text-center py-8">
                <ShieldExclamationIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No disciplinary records</p>
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
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[action.severity] || 'bg-gray-100 text-gray-700'}`}>
                            {SEVERITY_LABELS[action.severity] || action.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{action.violationReason.replace(/_/g, ' ')}</p>
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
      </div>
    </>
  )
}
