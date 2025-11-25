'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DashboardApi } from '@/lib/api-client'
import { PageSkeleton } from '@/components/LoadingStates'

// Icon components
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  )
}

function TrendDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  )
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  )
}

interface StatCard {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
}

interface Activity {
  id: string
  type: string
  description: string
  timestamp: string
  status: 'completed' | 'pending' | 'in-progress'
}

interface Event {
  id: string
  title: string
  date: string
  type: string
}

interface DashboardData {
  stats: StatCard[]
  recentActivity: Activity[]
  upcomingEvents: Event[]
}

// Page Header Component
function PageHeader({
  title,
  description,
  icon: Icon
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6 md:px-8 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-500 shadow-md">
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="flex flex-col">
          {description && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {description}
            </span>
          )}
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        </div>
      </div>
    </header>
  )
}

// Stat Card Component with gradient accent
function StatCardComponent({ stat, accentColor }: { stat: StatCard; accentColor: string }) {
  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <TrendUpIcon className="h-4 w-4" />
    if (trend === 'down') return <TrendDownIcon className="h-4 w-4" />
    return null
  }

  return (
    <div className="relative overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Gradient accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentColor}`} />
      <div className="p-5">
        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{stat.value}</span>
          {stat.change && stat.change !== '—' && (
            <div className={`flex items-center gap-1 text-sm font-medium ${
              stat.trend === 'up' ? 'text-emerald-600' :
              stat.trend === 'down' ? 'text-rose-600' :
              'text-slate-400'
            }`}>
              {getTrendIcon(stat.trend)}
              <span>{stat.change}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
      const dashboardData = await DashboardApi.get()
      setData(dashboardData)
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: Activity['status']) => {
    const styles = {
      'completed': 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
      'pending': 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
      'in-progress': 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20'
    }
    return styles[status] || 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/20'
  }

  const accentColors = [
    'from-cyan-500 to-teal-500',
    'from-violet-500 to-purple-500',
    'from-amber-500 to-orange-500'
  ]

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview" icon={ChartBarIcon} />
        <PageSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview" icon={ChartBarIcon} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 mb-4">
            <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Failed to Load Dashboard</h2>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
          >
            Try Again
          </button>
        </div>
      </>
    )
  }

  const hasData = data && (data.stats?.length || data.recentActivity?.length || data.upcomingEvents?.length)

  return (
    <>
      <PageHeader title="Dashboard" description="Overview" icon={ChartBarIcon} />

      <div className="space-y-6">
        {/* Stats Grid */}
        {data?.stats && data.stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.stats.map((stat, idx) => (
              <StatCardComponent
                key={stat.label}
                stat={stat}
                accentColor={accentColors[idx % accentColors.length]}
              />
            ))}
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
              {data?.recentActivity && data.recentActivity.length > 0 && (
                <Link
                  href="/activity"
                  className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                >
                  View all
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div className="p-5">
              {data?.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {data.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{activity.timestamp}</p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(activity.status)}`}>
                        {activity.status.replace('-', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                    <InboxIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">No recent activity</p>
                  <p className="text-xs text-slate-400 mt-1">Activity will appear here as it happens</p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Upcoming Events</h2>
              {data?.upcomingEvents && data.upcomingEvents.length > 0 && (
                <Link
                  href="/calendar"
                  className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                >
                  Calendar
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div className="p-5">
              {data?.upcomingEvents && data.upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {data.upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg border border-slate-200 hover:border-cyan-200 hover:bg-cyan-50/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{event.title}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span>{event.date}</span>
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/20 rounded-full text-xs font-medium">
                          {event.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                    <CalendarIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">No upcoming events</p>
                  <p className="text-xs text-slate-400 mt-1">Events will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickActionCard
              title="Add Employee"
              description="Register a new team member"
              href="/employees/add"
              icon={UserPlusIcon}
              accentColor="from-cyan-500 to-teal-500"
            />
            <QuickActionCard
              title="View Employees"
              description="Manage your workforce"
              href="/employees"
              icon={UsersIcon}
              accentColor="from-violet-500 to-purple-500"
            />
            <QuickActionCard
              title="Company Policies"
              description="View and manage policies"
              href="/policies"
              icon={DocumentTextIcon}
              accentColor="from-amber-500 to-orange-500"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  accentColor
}: {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  accentColor: string
}) {
  return (
    <Link href={href} className="group block">
      <div className="relative overflow-hidden bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
        <div className="flex items-start gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accentColor} shadow-sm`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
          <ArrowRightIcon className="h-4 w-4 text-slate-300 group-hover:text-cyan-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>
    </Link>
  )
}
