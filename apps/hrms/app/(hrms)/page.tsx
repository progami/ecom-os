'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DashboardApi } from '@/lib/api-client'
import { PageSkeleton } from '@/components/LoadingStates'

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

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return '↑'
    if (trend === 'down') return '↓'
    return '→'
  }

  const getStatusBadge = (status: Activity['status']) => {
    const statusClasses = {
      'completed': 'bg-green-100 text-green-700',
      'pending': 'bg-amber-100 text-amber-700',
      'in-progress': 'bg-blue-100 text-blue-700'
    }
    return statusClasses[status] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return <PageSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-destructive mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Failed to Load Dashboard</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || (!data.stats?.length && !data.recentActivity?.length && !data.upcomingEvents?.length)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Data Available</h2>
        <p className="text-muted-foreground">Dashboard data will appear here once available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">HR Dashboard</h1>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
              ✨ NEW DESIGN
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here&rsquo;s what&rsquo;s happening in your organization.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      {data.stats && data.stats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.stats.map((stat) => (
            <div key={stat.label} className="dashboard-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
                    {stat.change && (
                      <span className={`text-sm font-medium flex items-center gap-1 ${
                        stat.trend === 'up' ? 'text-primary' :
                        stat.trend === 'down' ? 'text-destructive' :
                        'text-muted-foreground'
                      }`}>
                        <span>{getTrendIcon(stat.trend)}</span>
                        {stat.change}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        {data.recentActivity && data.recentActivity.length > 0 && (
          <div className="lg:col-span-2 dashboard-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              <Link href="/activity" className="text-sm text-primary hover:text-primary/80 hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg table-row-hover">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.description}</p>
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
              <h2 className="text-lg font-semibold text-foreground">Upcoming Events</h2>
              <Link href="/calendar" className="text-sm text-primary hover:text-primary/80 hover:underline">
                View calendar
              </Link>
            </div>
            <div className="space-y-3">
              {data.upcomingEvents.map((event) => (
                <div key={event.id} className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{event.date}</p>
                    </div>
                    <span className="badge-primary">{event.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
