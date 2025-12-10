'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DashboardApi } from '@/lib/api-client'
import {
  HomeIcon,
  UsersIcon,
  DocumentIcon,
  CalendarIcon,
  PlusIcon,
  ChartBarIcon,
  SpinnerIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

interface StatItem {
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
  stats: StatItem[]
  recentActivity: Activity[]
  upcomingEvents: Event[]
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
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
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
          <Button onClick={fetchDashboardData}>
            Retry
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <ListPageHeader
        title="Dashboard"
        description="Welcome to your HR management system"
        icon={<HomeIcon className="h-6 w-6 text-white" />}
      />

      <div className="space-y-8">
        {/* Stats */}
        {data?.stats && data.stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.stats.map((stat) => (
              <StatCard
                key={stat.label}
                title={stat.label}
                value={stat.value}
                icon={<ChartBarIcon className="h-5 w-5 text-slate-500" />}
                trend={stat.change && stat.change !== '—' && stat.trend !== 'neutral' ? {
                  value: stat.change,
                  positive: stat.trend === 'up',
                } : undefined}
              />
            ))}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card padding="none" className="lg:col-span-2">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              {data?.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {data.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900">{activity.description}</p>
                        <p className="text-xs text-slate-500 mt-1">{activity.timestamp}</p>
                      </div>
                      <StatusBadge status={activity.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No recent activity
                </div>
              )}
            </div>
          </Card>

          {/* Upcoming Events */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Upcoming Events</h2>
            </div>
            <div className="p-6">
              {data?.upcomingEvents && data.upcomingEvents.length > 0 ? (
                <div className="space-y-4">
                  {data.upcomingEvents.map((event) => (
                    <div key={event.id} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-slate-900">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">{event.date}</span>
                        <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-medium">
                          {event.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No upcoming events
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <QuickActionCard
              href="/employees/add"
              icon={PlusIcon}
              title="Add Employee"
              description="Register new team member"
            />
            <QuickActionCard
              href="/employees"
              icon={UsersIcon}
              title="View Employees"
              description="Manage your workforce"
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
