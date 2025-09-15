import { google } from 'googleapis'

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || ''
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || ''

export function isCalendarConfigured() {
  return Boolean(CALENDAR_ID && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN)
}

function getOAuth2Client() {
  if (!isCalendarConfigured()) {
    throw new Error('Google Calendar not configured. Set GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN')
  }
  const oAuth2Client = new google.auth.OAuth2({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET })
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN })
  return oAuth2Client
}

export async function listUpcomingEvents(opts?: { maxResults?: number }) {
  const auth = getOAuth2Client()
  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date().toISOString()
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: now,
    maxResults: opts?.maxResults ?? 10,
    singleEvents: true,
    orderBy: 'startTime',
  })
  return res.data.items || []
}

export type CreateEventInput = {
  summary: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
}

export async function createEvent(input: CreateEventInput) {
  const auth = getOAuth2Client()
  const calendar = google.calendar({ version: 'v3', auth })
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: input.start,
      end: input.end,
    },
  })
  return res.data
}

