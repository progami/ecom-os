import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Centralized authentication is enabled. Use the portal at ecomos.targonglobal.com',
      redirect: (process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com') + '/login'
    },
    { status: 410 }
  )
}
