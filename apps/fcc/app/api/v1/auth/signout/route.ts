import { NextResponse } from 'next/server'

export async function POST() {
  // Deprecated local signout — use central
  const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
  return NextResponse.json({
    error: 'Signout is handled by central auth',
    redirect: central + '/api/auth/signout'
  }, { status: 410 })
}
