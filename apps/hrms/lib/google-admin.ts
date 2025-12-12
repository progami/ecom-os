import { google } from 'googleapis'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const ADMIN_REFRESH_TOKEN = process.env.GOOGLE_ADMIN_REFRESH_TOKEN || ''
const ADMIN_DOMAIN = process.env.GOOGLE_ADMIN_DOMAIN || 'targonglobal.com'

const REQUEST_TIMEOUT = 15000 // 15 seconds timeout

export function isAdminConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && ADMIN_REFRESH_TOKEN)
}

function getOAuth2Client() {
  if (!isAdminConfigured()) {
    throw new Error('Google Admin not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ADMIN_REFRESH_TOKEN')
  }
  const oAuth2Client = new google.auth.OAuth2({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET })
  oAuth2Client.setCredentials({ refresh_token: ADMIN_REFRESH_TOKEN })
  return oAuth2Client
}

export type GoogleUser = {
  id: string
  primaryEmail: string
  name: {
    givenName: string
    familyName: string
    fullName: string
  }
  isAdmin: boolean
  isDelegatedAdmin: boolean
  suspended: boolean
  archived: boolean
  orgUnitPath: string
  creationTime: string
  lastLoginTime: string
  phones?: { value: string; type: string }[]
  organizations?: { title?: string; department?: string; primary?: boolean }[]
  thumbnailPhotoUrl?: string
}

export async function listAllUsers(): Promise<GoogleUser[]> {
  const auth = getOAuth2Client()
  const admin = google.admin({ version: 'directory_v1', auth })

  const allUsers: GoogleUser[] = []
  let pageToken: string | undefined = undefined

  let hasMore = true
  while (hasMore) {
    const res: Awaited<ReturnType<typeof admin.users.list>> = await admin.users.list({
      domain: ADMIN_DOMAIN,
      maxResults: 500,
      pageToken,
      projection: 'full',
    }, { timeout: REQUEST_TIMEOUT })

    if (res.data.users) {
      allUsers.push(...(res.data.users as GoogleUser[]))
    }
    pageToken = res.data.nextPageToken || undefined
    hasMore = !!pageToken
  }

  return allUsers
}

export async function getUser(userKey: string): Promise<GoogleUser> {
  const auth = getOAuth2Client()
  const admin = google.admin({ version: 'directory_v1', auth })

  const res = await admin.users.get({
    userKey,
    projection: 'full',
  }, { timeout: REQUEST_TIMEOUT })

  return res.data as GoogleUser
}
