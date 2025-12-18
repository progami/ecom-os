import { NextResponse } from 'next/server'
import { syncGoogleAdminUsers } from '@/lib/google-admin-sync'
import { isAdminConfigured } from '@/lib/google-admin'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'

async function handleSync() {
  // Security: Only super-admin can trigger Google Admin sync
  const actorId = await getCurrentEmployeeId()
  if (!actorId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const isAdmin = await isSuperAdmin(actorId)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Only super admin can trigger Google Admin sync' }, { status: 403 })
  }

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

export async function POST() {
  return handleSync()
}

// Also allow GET for easy testing (still requires super-admin)
export async function GET() {
  return handleSync()
}
