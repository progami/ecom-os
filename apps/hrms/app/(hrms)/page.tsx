'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DashboardApi, NotificationsApi, type DashboardData } from '@/lib/api-client'
import {
  HomeIcon,
  UsersIcon,
  BellIcon,
  SpinnerIcon,
  UserIcon,
  CheckIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'

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
    const unreadIds = data.notifications.filter(n => !n.isRead).map(n => n.id)
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

  const greeting = data?.user ? `Welcome back, ${data.user.firstName}` : 'Welcome'
  const hasDirectReports = data?.directReports && data.directReports.length > 0
  const hasNotifications = data?.notifications && data.notifications.length > 0
  const unreadCount = data?.unreadNotificationCount ?? 0

  return (
    <>
      <ListPageHeader
        title={greeting}
        description={
          data?.user
            ? `${data.user.position} • ${data.user.department}`
            : 'Your HR management dashboard'
        }
        icon={<HomeIcon className="h-6 w-6 text-white" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main Content - My Team */}
        <div className="lg:col-span-3">
          <Card padding="none" className="h-full">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-cyan-600" />
                My Team
                {hasDirectReports && (
                  <span className="text-sm font-normal text-slate-400">
                    ({data.directReports.length})
                  </span>
                )}
              </h2>
              {hasDirectReports && (
                <Link
                  href="/employees"
                  className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                >
                  All employees
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              )}
            </div>

            <div className="p-5">
              {hasDirectReports ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.directReports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/employees/${report.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-cyan-200 hover:bg-cyan-50/30 transition-all group"
                    >
                      <Avatar
                        src={report.avatar}
                        alt={`${report.firstName} ${report.lastName}`}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 group-hover:text-cyan-700 truncate">
                          {report.firstName} {report.lastName}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {report.position}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <UserIcon className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">No direct reports</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Team members will appear here once assigned
                  </p>
                  <Link
                    href="/organogram"
                    className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 mt-4"
                  >
                    View org chart
                    <ChevronRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar - Notifications */}
        <div className="lg:col-span-2">
          <Card padding="none" className="h-full">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <BellIcon className="h-5 w-5 text-cyan-600" />
                Notifications
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h2>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-slate-500 hover:text-cyan-600 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {hasNotifications ? (
                <div className="divide-y divide-slate-100">
                  {data.notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-5 py-4 transition-colors ${
                        notification.isRead ? 'bg-white' : 'bg-amber-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex-shrink-0 ${
                          notification.isRead ? 'text-slate-400' : 'text-amber-500'
                        }`}>
                          {notification.isRead ? (
                            <CheckIcon className="h-4 w-4" />
                          ) : (
                            <ExclamationCircleIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${
                            notification.isRead ? 'text-slate-600' : 'text-slate-900 font-medium'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[11px] text-slate-400">
                              {formatDate(notification.createdAt)}
                            </span>
                            {notification.link && (
                              <Link
                                href={notification.link}
                                className="text-[11px] text-cyan-600 hover:text-cyan-700"
                              >
                                View details
                              </Link>
                            )}
                            {!notification.isRead && (
                              <button
                                onClick={() => markNotificationRead(notification.id)}
                                className="text-[11px] text-slate-500 hover:text-slate-700"
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
              ) : (
                <div className="text-center py-12 px-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                    <BellIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-sm">No notifications</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
