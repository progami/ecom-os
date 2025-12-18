import { NextResponse } from 'next/server'
import { listAllUsers, isAdminConfigured } from '@/lib/google-admin'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'

export async function GET() {
  // Security: Only super-admin can access Google Admin data
  const actorId = await getCurrentEmployeeId()
  if (!actorId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const isAdmin = await isSuperAdmin(actorId)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Only super admin can access Google Admin data' }, { status: 403 })
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Google Admin API not configured' },
      { status: 500 }
    )
  }

  try {
    const users = await listAllUsers()

    // Transform to a cleaner format
    const employees = users
      .filter(u => !u.suspended && !u.archived)
      .map(u => ({
        googleId: u.id,
        email: u.primaryEmail,
        firstName: u.name?.givenName || '',
        lastName: u.name?.familyName || '',
        fullName: u.name?.fullName || '',
        department: u.organizations?.[0]?.department || null,
        position: u.organizations?.[0]?.title || null,
        phone: u.phones?.[0]?.value || null,
        orgUnit: u.orgUnitPath,
        isAdmin: u.isAdmin,
        createdAt: u.creationTime,
        lastLogin: u.lastLoginTime,
        photoUrl: u.thumbnailPhotoUrl || null,
      }))

    return NextResponse.json({
      items: employees,
      total: employees.length,
    })
  } catch (e: any) {
    console.error('Failed to fetch Google Admin users:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
