import { NextResponse } from 'next/server'

export async function POST() {
  // Deprecated local signout — use portal
  const portal = process.env.PORTAL_AUTH_URL || 'https://ecomos.targonglobal.com'
  return NextResponse.json({
    error: 'Signout is handled by the portal auth service',
    redirect: portal + '/api/auth/signout'
  }, { status: 410 })
}
