'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DashboardApi } from '@/lib/api-client'
import { PageSkeleton } from '@/components/LoadingStates'

// Icon components
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function TrendDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
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
    <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-soft backdrop-blur-xl sm:px-6 md:px-8 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 shadow-md">
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {description && (
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70">
              {description}
            </span>
          )}
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        </div>
      </div>
    </header>
  )
}

// Stat Card Component
function StatCardComponent({ stat }: { stat: StatCard }) {
  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <TrendUpIcon className="h-4 w-4" />
    if (trend === 'down') return <TrendDownIcon className="h-4 w-4" />
    return null
  }

  return (
    <div className="dashboard-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
            {stat.change && (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                stat.trend === 'up' ? 'text-green-600' :
                stat.trend === 'down' ? 'text-red-600' :
                'text-muted-foreground'
              }`}>
                {getTrendIcon(stat.trend)}
                <span>{stat.change}</span>
              </div>
            )}
          </div>
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
      'completed': 'bg-green-100 text-green-700',
      'pending': 'bg-amber-100 text-amber-700',
      'in-progress': 'bg-blue-100 text-blue-700'
    }
    return styles[status] || 'bg-slate-100 text-slate-700'
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview" icon={ClipboardIcon} />
        <PageSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview" icon={ClipboardIcon} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to Load Dashboard</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-soft text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </>
    )
  }

  if (!data || (!data.stats?.length && !data.recentActivity?.length && !data.upcomingEvents?.length)) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview" icon={ClipboardIcon} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-slate-400 mb-4">
            <ClipboardIcon className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No Data Available</h2>
          <p className="text-muted-foreground">Dashboard data will appear here once available.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Overview" icon={ClipboardIcon} />

      <div className="space-y-6">
        {/* Stats Grid */}
        {data.stats && data.stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.stats.map((stat) => (
              <StatCardComponent key={stat.label} stat={stat} />
            ))}
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          {data.recentActivity && data.recentActivity.length > 0 && (
            <div className="lg:col-span-2 dashboard-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                <Link
                  href="/activity"
                  className="inline-flex items-center text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  View all
                  <ArrowRightIcon className="ml-1 h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {data.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(activity.status)}`}>
                      {activity.status.replace('-', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {data.upcomingEvents && data.upcomingEvents.length > 0 && (
            <div className="dashboard-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Upcoming Events</h2>
                <Link
                  href="/calendar"
                  className="inline-flex items-center text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  View calendar
                  <ArrowRightIcon className="ml-1 h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {data.upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border border-slate-200 hover:border-cyan-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.title}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          <span>{event.date}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                        {event.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Add Employee"
            description="Register a new team member"
            href="/employees/add"
            icon={UsersIcon}
          />
          <QuickActionCard
            title="View Employees"
            description="Manage your workforce"
            href="/employees"
            icon={UsersIcon}
          />
          <QuickActionCard
            title="Company Policies"
            description="View and manage policies"
            href="/policies"
            icon={ClipboardIcon}
          />
        </div>
      </div>
    </>
  )
}

function QuickActionCard({
  title,
  description,
  href,
  icon: Icon
}: {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link href={href} className="block">
      <div className="dashboard-card p-5 group cursor-pointer">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-cyan-100 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-600 transition-colors">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <ArrowRightIcon className="h-4 w-4 text-slate-400 group-hover:text-cyan-600 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  )
}
