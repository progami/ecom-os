'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { SpinnerIcon, UsersIcon, ExclamationCircleIcon, ChevronRightIcon } from '@/components/ui/Icons'

type CulturalHealthData = {
  greenPercentage: number
  yellowPercentage: number
  redPercentage: number
  totalEmployees: number
  redAlerts: { id: string; firstName: string; lastName: string; reason: string }[]
}

function StandingBar({ green, yellow, red }: { green: number; yellow: number; red: number }) {
  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
      {green > 0 && (
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${green}%` }}
        />
      )}
      {yellow > 0 && (
        <div
          className="bg-amber-400 transition-all duration-500"
          style={{ width: `${yellow}%` }}
        />
      )}
      {red > 0 && (
        <div
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${red}%` }}
        />
      )}
    </div>
  )
}

function StandingLegend({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-400',
    red: 'bg-red-500',
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${colorClasses[color]}`} />
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{percentage}%</span>
    </div>
  )
}

export function CulturalHealthWidget() {
  const [data, setData] = useState<CulturalHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch('/api/standing')
        if (!response.ok) {
          throw new Error('Failed to fetch cultural health data')
        }
        const result = await response.json()
        setData(result)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load data'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-cyan-600" />
            Cultural Health
          </h2>
        </div>
        <div className="flex items-center justify-center h-40">
          <SpinnerIcon className="h-6 w-6 animate-spin text-cyan-600" />
        </div>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-cyan-600" />
            Cultural Health
          </h2>
        </div>
        <div className="p-5 text-center text-slate-500 text-sm">
          Unable to load cultural health data
        </div>
      </Card>
    )
  }

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-cyan-600" />
          Cultural Health
        </h2>
        <span className="text-sm text-slate-500">{data.totalEmployees} employees</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Standing Bar */}
        <div>
          <StandingBar
            green={data.greenPercentage}
            yellow={data.yellowPercentage}
            red={data.redPercentage}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          <StandingLegend label="Role Model" percentage={data.greenPercentage} color="green" />
          <StandingLegend label="Coaching" percentage={data.yellowPercentage} color="yellow" />
          <StandingLegend label="At Risk" percentage={data.redPercentage} color="red" />
        </div>

        {/* Red Alerts */}
        {data.redAlerts.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">
                {data.redAlerts.length} employee{data.redAlerts.length !== 1 ? 's' : ''} need attention
              </span>
            </div>
            <div className="space-y-2">
              {data.redAlerts.slice(0, 3).map((alert) => (
                <Link
                  key={alert.id}
                  href={`/employees/${alert.id}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 group-hover:text-red-700">
                      {alert.firstName} {alert.lastName}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">
                      {alert.reason}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-slate-400 group-hover:text-red-600" />
                </Link>
              ))}
              {data.redAlerts.length > 3 && (
                <Link
                  href="/employees?standing=RED"
                  className="block text-center text-xs text-red-600 hover:text-red-700 pt-1"
                >
                  View all {data.redAlerts.length} at-risk employees
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
