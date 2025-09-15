import { NextResponse } from 'next/server'
import { isCalendarConfigured, listUpcomingEvents, createEvent } from '@/lib/google-calendar'

export async function GET() {
  try {
    if (!isCalendarConfigured()) {
      return NextResponse.json({ items: [], note: 'Google Calendar not configured' }, { status: 200 })
    }
    const items = await listUpcomingEvents({ maxResults: 25 })
    // Normalize minimal fields for client
    const normalized = items.map((e: any) => ({
      id: e.id,
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: e.start,
      end: e.end,
      htmlLink: e.htmlLink,
    }))
    return NextResponse.json({ items: normalized })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load events' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!isCalendarConfigured()) {
      return NextResponse.json({ error: 'Google Calendar not configured' }, { status: 400 })
    }
    const body = await req.json()
    const required = ['summary', 'start', 'end']
    for (const k of required) {
      if (!body[k]) return NextResponse.json({ error: `Missing ${k}` }, { status: 400 })
    }
    const event = await createEvent({
      summary: String(body.summary),
      description: body.description || undefined,
      location: body.location || undefined,
      start: body.start,
      end: body.end,
    })
    return NextResponse.json(event, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create event' }, { status: 500 })
  }
}
