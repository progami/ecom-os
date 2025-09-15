"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarApi, type CalendarEvent } from '@/lib/api-client'

const EMBED_URL = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL || ''

export default function CalendarPage() {
  const [items, setItems] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { items } = await CalendarApi.list()
        setItems(items || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load events')
      }
    })()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Team Calendar</h1>
          <p className="text-muted-foreground">Google Calendar integration</p>
        </div>
        <Link href="/hrms" className="text-sm underline">Back to Dashboard</Link>
      </div>

      {EMBED_URL ? (
        <div className="w-full h-[700px] rounded-md border overflow-hidden">
          <iframe className="w-full h-full" src={EMBED_URL} title="Google Calendar" />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Set NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL to show the embedded calendar.</div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-2">Upcoming Events</h2>
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Summary</th>
                <th className="text-left p-2">Start</th>
                <th className="text-left p-2">End</th>
                <th className="text-left p-2">Link</th>
              </tr>
            </thead>
            <tbody>
              {items.map(ev => (
                <tr key={ev.id} className="border-b border-gray-200 dark:border-gray-800">
                  <td className="p-2">{ev.summary || '—'}</td>
                  <td className="p-2">{ev.start?.dateTime || '—'}</td>
                  <td className="p-2">{ev.end?.dateTime || '—'}</td>
                  <td className="p-2">{ev.htmlLink ? <a className="text-primary underline" target="_blank" href={ev.htmlLink} rel="noreferrer">Open</a> : '—'}</td>
                </tr>
              ))}
              {!items.length && (
                <tr><td className="p-3 text-sm text-muted-foreground" colSpan={4}>No upcoming events or calendar not configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

