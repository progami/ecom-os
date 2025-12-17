'use client'

import { useState, useEffect } from 'react'
import {
  DashboardApi,
  LeavesApi,
  type DashboardData,
  type LeaveBalance,
  type LeaveRequest,
} from '@/lib/api-client'
import {
  CalendarDaysIcon,
  SpinnerIcon,
  UsersIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { LeaveHistoryTable } from '@/components/leave/LeaveHistoryTable'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'
import { PendingLeaveApprovals } from '@/components/leave/PendingLeaveApprovals'
import { LeaveApprovalHistory } from '@/components/leave/LeaveApprovalHistory'

type Tab = 'my-leave' | 'team'

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

export default function LeavePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('my-leave')

  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
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
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

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
    setShowLeaveForm(false)
    if (!data?.currentEmployee?.id) return
    // Reload leave data
    const [balanceData, requestsData] = await Promise.all([
      LeavesApi.getBalance({ employeeId: data.currentEmployee.id }),
      LeavesApi.list({ employeeId: data.currentEmployee.id }),
    ])
    setLeaveBalances(balanceData.balances || [])
    setLeaveRequests(requestsData.items || [])
    // Also refresh dashboard data to update pending counts
    await fetchDashboardData()
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

  const handleApprovalUpdate = async () => {
    await fetchDashboardData()
  }

  if (loading) {
    return (
      <>
        <ListPageHeader
          title="Leave Management"
          description="Manage your leave requests and approvals"
          icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
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
          title="Leave Management"
          description="Manage your leave requests and approvals"
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
          description="Manage your leave requests and approvals"
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
        description="Manage your leave requests and approvals"
        icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
        action={
          <Button onClick={() => setShowLeaveForm(true)}>
            Request Leave
          </Button>
        }
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

        {/* Leave Request Form Modal */}
        {showLeaveForm && (
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Request Leave</h3>
            <LeaveRequestForm
              employeeId={currentEmployee.id}
              onSuccess={handleLeaveRequestSuccess}
              onCancel={() => setShowLeaveForm(false)}
            />
          </Card>
        )}

        {/* My Leave Tab */}
        {activeTab === 'my-leave' && (
          <div className="space-y-6">
            {/* Leave Balance */}
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Leave Balance</h3>
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
                  <p className="text-xs text-gray-400 mt-1">
                    Click "Request Leave" to submit your first request
                  </p>
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

        {/* Team Tab */}
        {activeTab === 'team' && data?.isManager && (
          <div className="space-y-6">
            {/* Pending Approvals */}
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Pending Approvals
                {pendingCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </h3>
              {data.pendingLeaveRequests && data.pendingLeaveRequests.length > 0 ? (
                <PendingLeaveApprovals
                  requests={data.pendingLeaveRequests}
                  onUpdate={handleApprovalUpdate}
                />
              ) : (
                <div className="text-center py-8">
                  <UsersIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No pending leave requests</p>
                  <p className="text-xs text-gray-400 mt-1">
                    All team leave requests have been processed
                  </p>
                </div>
              )}
            </Card>

            {/* Approval History */}
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Your Approval History
              </h3>
              {data.leaveApprovalHistory && data.leaveApprovalHistory.length > 0 ? (
                <LeaveApprovalHistory history={data.leaveApprovalHistory} />
              ) : (
                <div className="text-center py-8">
                  <CalendarDaysIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No approval history yet</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
