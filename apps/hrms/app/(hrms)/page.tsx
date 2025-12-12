'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DashboardApi, NotificationsApi, type DashboardData } from '@/lib/api-client'
import {
  HomeIcon,
  UsersIcon,
  DocumentIcon,
  BellIcon,
  ChartBarIcon,
  SpinnerIcon,
  UserIcon,
  ClipboardIcon,
  CheckIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'

// Types imported from api-client

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

function formatReviewType(type: string) {
  const map: Record<string, string> = {
    PROBATION: 'Probation',
    QUARTERLY: 'Quarterly',
    SEMI_ANNUAL: 'Semi-Annual',
    ANNUAL: 'Annual',
    PROMOTION: 'Promotion',
    PIP: 'PIP',
  }
  return map[type] ?? type
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const dashboardData = await DashboardApi.get()
      setData(dashboardData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const markNotificationRead = async (id: string) => {
    try {
      await NotificationsApi.markAsRead([id])
      // Update local state
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

  if (loading) {
    return (
      <>
        <ListPageHeader
          title="Dashboard"
          description="Welcome to your HR management system"
          icon={<HomeIcon className="h-6 w-6 text-white" />}
        />
        <div className="flex items-center justify-center h-64">
          <SpinnerIcon className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <ListPageHeader
          title="Dashboard"
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

  const greeting = data?.user ? `Welcome, ${data.user.firstName}` : 'Welcome'

  return (
    <>
      <ListPageHeader
        title={greeting}
        description={
          data?.user
            ? `${data.user.position} - ${data.user.department}`
            : 'Your HR management dashboard'
        }
        icon={<HomeIcon className="h-6 w-6 text-white" />}
      />

      <div className="space-y-8">
        {/* Stats */}
        {data?.stats && data.stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {data.stats.map((stat) => (
              <StatCard
                key={stat.label}
                title={stat.label}
                value={stat.value}
                icon={<ChartBarIcon className="h-5 w-5 text-slate-500" />}
              />
            ))}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Team / Direct Reports */}
          <Card padding="none" className="lg:col-span-2">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-cyan-600" />
                My Team
              </h2>
              {data?.directReports && data.directReports.length > 0 && (
                <Link
                  href="/employees"
                  className="text-sm text-cyan-600 hover:text-cyan-700"
                >
                  View all
                </Link>
              )}
            </div>
            <div className="p-6">
              {data?.directReports && data.directReports.length > 0 ? (
                <div className="space-y-4">
                  {data.directReports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/employees/${report.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Avatar
                        src={report.avatar}
                        alt={`${report.firstName} ${report.lastName}`}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {report.firstName} {report.lastName}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {report.position} - {report.department}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {report.employeeId}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No direct reports</p>
                  <p className="text-slate-400 text-xs mt-1">
                    Employees reporting to you will appear here
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* My Notifications */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <BellIcon className="h-5 w-5 text-cyan-600" />
                Notifications
                {(data?.unreadNotificationCount ?? 0) > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
                    {data?.unreadNotificationCount}
                  </span>
                )}
              </h2>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {data?.notifications && data.notifications.length > 0 ? (
                <div className="space-y-3">
                  {data.notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        notification.isRead
                          ? 'bg-white border-slate-100'
                          : 'bg-cyan-50 border-cyan-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <button
                            onClick={() => markNotificationRead(notification.id)}
                            className="p-1 hover:bg-cyan-100 rounded"
                            title="Mark as read"
                          >
                            <CheckIcon className="h-4 w-4 text-cyan-600" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">
                          {formatDate(notification.createdAt)}
                        </span>
                        {notification.link && (
                          <Link
                            href={notification.link}
                            className="text-xs text-cyan-600 hover:text-cyan-700"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BellIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No notifications</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Pending Reviews */}
        {data?.pendingReviews && data.pendingReviews.length > 0 && (
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardIcon className="h-5 w-5 text-amber-500" />
                Pending Reviews
              </h2>
              <Link
                href="/performance-management/reviews"
                className="text-sm text-cyan-600 hover:text-cyan-700"
              >
                View all
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.pendingReviews.map((review) => (
                  <Link
                    key={review.id}
                    href={`/performance-management/reviews/${review.id}`}
                    className="p-4 rounded-lg border border-slate-200 hover:border-cyan-300 hover:shadow-sm transition-all"
                  >
                    <p className="font-medium text-slate-900">
                      {review.employee.firstName} {review.employee.lastName}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {formatReviewType(review.reviewType)} - {review.reviewPeriod}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <StatusBadge status={review.status.toLowerCase().replace('_', '-')} />
                      <span className="text-xs text-slate-400">
                        Due: {new Date(review.reviewDate).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <QuickActionCard
              href="/employees"
              icon={UsersIcon}
              title="View Employees"
              description="Manage your workforce"
            />
            <QuickActionCard
              href="/organogram"
              icon={UsersIcon}
              title="Org Chart"
              description="View company structure"
            />
            <QuickActionCard
              href="/policies"
              icon={DocumentIcon}
              title="Company Policies"
              description="View and manage policies"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-slate-200 rounded-xl p-5 hover:border-cyan-300 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-cyan-50 rounded-xl">
          <Icon className="h-5 w-5 text-cyan-600" />
        </div>
        <div>
          <p className="font-medium text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </Link>
  )
}
