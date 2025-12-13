import { NextResponse } from 'next/server'
import { syncGoogleAdminUsers } from '@/lib/google-admin-sync'
import { isAdminConfigured } from '@/lib/google-admin'

export async function POST() {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Google Admin API not configured' },
      { status: 500 }
    )
  }

  try {
    const result = await syncGoogleAdminUsers()
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Failed to sync Google Admin users:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to sync users' },
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing
export async function GET() {
  return POST()
}
