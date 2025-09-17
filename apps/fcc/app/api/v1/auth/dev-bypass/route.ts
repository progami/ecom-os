import { NextResponse } from 'next/server'

const message = {
  error: 'Centralized authentication is enabled. Dev bypass is no longer supported in FCC.',
  redirect: process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com',
}

export async function GET() {
  return NextResponse.json(message, { status: 410 })
}

export async function POST() {
  return NextResponse.json(message, { status: 410 })
}
