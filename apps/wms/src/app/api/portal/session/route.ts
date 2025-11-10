import { NextRequest, NextResponse } from 'next/server'
import { resolvePortalSession } from '@/lib/portal-session'

export async function GET(request: NextRequest) {
  const session = await resolvePortalSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(session)
}
