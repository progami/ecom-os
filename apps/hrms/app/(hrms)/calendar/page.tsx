"use client"

import { useEffect, useState } from 'react'
import { CalendarApi, type CalendarEvent } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { CalendarIcon } from '@/components/ui/Icons'

const EMBED_URL = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL || ''

function formatDateTime(dateTime?: string, date?: string): string {
  const value = dateTime || date
  if (!value) return '—'

  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return '—'

    if (date && !dateTime) {
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }

    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '—'
  }
}

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
      <PageHeader
        title="Team Calendar"
        description="Google Calendar integration"
        icon={<CalendarIcon className="h-6 w-6 text-white" />}
        showBack
      />

      {EMBED_URL && (
        <div className="w-full h-[700px] rounded-md border overflow-hidden">
          <iframe className="w-full h-full" src={EMBED_URL} title="Google Calendar" />
        </div>
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
                  <td className="p-2">{formatDateTime(ev.start?.dateTime, (ev.start as any)?.date)}</td>
                  <td className="p-2">{formatDateTime(ev.end?.dateTime, (ev.end as any)?.date)}</td>
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
