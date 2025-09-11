'use client'

import { Clock } from 'lucide-react'

interface Activity {
  id: string
  type: 'employee_added' | 'document_uploaded' | 'leave_request' | 'promotion'
  title: string
  description: string
  time: string
}

const activities: Activity[] = []

export default function RecentActivity() {
  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <Clock className="text-slate-400" size={18} />
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-slate-400">No recent activity</p>
        </div>
      ) : (
        <div className="hrms-table-wrapper">
          <table className="hrms-table">
            <thead>
              <tr className="hrms-thead-row">
                <th className="hrms-th">Title</th>
                <th className="hrms-th">Description</th>
                <th className="hrms-th">Type</th>
                <th className="hrms-th">Time</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className="hrms-row">
                  <td className="hrms-td font-medium">{a.title}</td>
                  <td className="hrms-td">{a.description}</td>
                  <td className="hrms-td">{a.type}</td>
                  <td className="hrms-td">{a.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
