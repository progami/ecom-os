"use client"

import { useEffect, useState } from 'react'
import RecentActivity from './components/RecentActivity'
import UpcomingEvents from './components/UpcomingEvents'

export default function HRMSDashboard() {
  const [counts, setCounts] = useState({ employees: 0, resources: 0, policies: 0 })

  useEffect(() => {
    const load = async () => {
      const [e, r, p] = await Promise.all([
        fetch('/api/employees?take=1').then(res => res.json()).catch(()=>({total:0})),
        fetch('/api/resources?take=1').then(res => res.json()).catch(()=>({total:0})),
        fetch('/api/policies?take=1').then(res => res.json()).catch(()=>({total:0})),
      ])
      setCounts({ employees: e.total||0, resources: r.total||0, policies: p.total||0 })
    }
    load()
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient">HR Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome to your HR Management System</p>
      </div>

      {/* Summary Cards (WMS-like) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover-glow">
          <h3 className="text-sm text-muted-foreground">Total Employees</h3>
          <div className="mt-2 text-2xl font-semibold">{counts.employees}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover-glow">
          <h3 className="text-sm text-muted-foreground">Resources</h3>
          <div className="mt-2 text-2xl font-semibold">{counts.resources}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover-glow">
          <h3 className="text-sm text-muted-foreground">Policies</h3>
          <div className="mt-2 text-2xl font-semibold">{counts.policies}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover-glow">
          <h3 className="text-sm text-muted-foreground">Payroll This Month</h3>
          <div className="mt-2 text-2xl font-semibold">$0</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity - Takes 2 columns */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>

        {/* Upcoming Events - Takes 1 column */}
        <div>
          <UpcomingEvents />
        </div>
      </div>

      {/* Additional Metrics (Table) */}
      <div className="hrms-table-wrapper">
        <table className="hrms-table">
          <thead>
            <tr className="hrms-thead-row">
              <th className="hrms-th">Metric</th>
              <th className="hrms-th">Value</th>
              <th className="hrms-th">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hrms-row">
              <td className="hrms-td">Avg Work Hours</td>
              <td className="hrms-td font-medium">0</td>
              <td className="hrms-td text-muted-foreground">No data available</td>
            </tr>
            <tr className="hrms-row">
              <td className="hrms-td">Leave Requests</td>
              <td className="hrms-td font-medium">0</td>
              <td className="hrms-td text-muted-foreground">No pending requests</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
