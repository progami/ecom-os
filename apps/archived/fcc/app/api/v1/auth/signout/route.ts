import { NextResponse } from 'next/server'
import { portalOrigin } from '@/lib/portal'

export async function POST() {
  // Deprecated local signout — use portal
  const portal = portalOrigin()
  return NextResponse.json({
    error: 'Signout is handled by the portal auth service',
    redirect: portal + '/api/auth/signout'
  }, { status: 410 })
}
