'use client'

import { Calendar } from 'lucide-react'

interface Event {
  id: string
  title: string
  type: 'meeting' | 'interview' | 'training' | 'social'
  date: string
  time: string
  attendees: number
}

const events: Event[] = []

export default function UpcomingEvents() {
  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Upcoming Events</h2>
        <Calendar className="text-slate-400" size={18} />
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-slate-400">No upcoming events</p>
        </div>
      ) : (
        <div className="hrms-table-wrapper">
          <table className="hrms-table">
            <thead>
              <tr className="hrms-thead-row">
                <th className="hrms-th">Title</th>
                <th className="hrms-th">Type</th>
                <th className="hrms-th">Date</th>
                <th className="hrms-th">Time</th>
                <th className="hrms-th">Attendees</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="hrms-row">
                  <td className="hrms-td font-medium">{e.title}</td>
                  <td className="hrms-td">{e.type}</td>
                  <td className="hrms-td">{e.date}</td>
                  <td className="hrms-td">{e.time}</td>
                  <td className="hrms-td">{e.attendees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
