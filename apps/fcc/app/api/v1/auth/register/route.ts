import { NextResponse } from 'next/server'

export async function POST() {
  const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
  return NextResponse.json(
    {
      error: 'Centralized authentication is enabled. Create accounts through the ecomos portal.',
      redirect: `${central}/register`,
    },
    { status: 410 }
  )
}
