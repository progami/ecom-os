import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Portal-managed authentication is enabled. Use the portal at ecomos.targonglobal.com',
      redirect: (process.env.PORTAL_AUTH_URL || 'https://ecomos.targonglobal.com') + '/login'
    },
    { status: 410 }
  )
}
