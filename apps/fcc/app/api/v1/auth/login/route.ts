import { NextResponse } from 'next/server'
import { portalOrigin } from '@/lib/portal'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Portal-managed authentication is enabled. Use the portal login flow.',
      redirect: portalOrigin() + '/login'
    },
    { status: 410 }
  )
}
