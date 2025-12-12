import { prisma } from './prisma'
import { listAllUsers, isAdminConfigured, type GoogleUser } from './google-admin'

export type SyncResult = {
  created: number
  updated: number
  deactivated: number
  errors: string[]
}

function generateEmployeeId(index: number): string {
  return `EMP-${String(index).padStart(3, '0')}`
}

export async function syncGoogleAdminUsers(): Promise<SyncResult> {
  if (!isAdminConfigured()) {
    return { created: 0, updated: 0, deactivated: 0, errors: ['Google Admin not configured'] }
  }

  const result: SyncResult = { created: 0, updated: 0, deactivated: 0, errors: [] }

  try {
    // Fetch all users from Google Admin
    const googleUsers = await listAllUsers()

    // Filter out suspended/archived users
    const activeGoogleUsers = googleUsers.filter(u => !u.suspended && !u.archived)
    const googleUserIds = new Set(activeGoogleUsers.map(u => u.id))
    const googleEmails = new Set(activeGoogleUsers.map(u => u.primaryEmail.toLowerCase()))

    // Get all current employees with override flags
    type ExistingEmployee = {
      id: string
      googleId: string | null
      email: string
      employeeId: string
      departmentLocalOverride: boolean
      positionLocalOverride: boolean
    }
    const existingEmployees: ExistingEmployee[] = await prisma.employee.findMany({
      select: {
        id: true,
        googleId: true,
        email: true,
        employeeId: true,
        departmentLocalOverride: true,
        positionLocalOverride: true,
      }
    })

    // Find the highest employee ID number for generating new IDs
    let maxEmployeeNum = 0
    for (const emp of existingEmployees) {
      const match = emp.employeeId.match(/EMP-(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxEmployeeNum) maxEmployeeNum = num
      }
    }

    // Create maps for quick lookup
    const employeeByGoogleId = new Map(existingEmployees.filter((e) => e.googleId).map((e) => [e.googleId, e]))
    const employeeByEmail = new Map(existingEmployees.map((e) => [e.email.toLowerCase(), e]))

    // Process each Google user
    for (const gUser of activeGoogleUsers) {
      try {
        const email = gUser.primaryEmail.toLowerCase()
        const existingByGoogleId = employeeByGoogleId.get(gUser.id)
        const existingByEmail = employeeByEmail.get(email)
        const existing = existingByGoogleId || existingByEmail

        // Base data that always syncs from Google
        const baseData = {
          googleId: gUser.id,
          firstName: gUser.name?.givenName || gUser.primaryEmail.split('@')[0],
          lastName: gUser.name?.familyName || '',
          email: gUser.primaryEmail,
          phone: gUser.phones?.[0]?.value || null,
          avatar: gUser.thumbnailPhotoUrl || null,
        }

        if (existing) {
          // Build update data respecting local overrides
          const updateData: Record<string, unknown> = {
            ...baseData,
            status: 'ACTIVE',
          }

          // Only update department if local override is NOT set
          if (!existing.departmentLocalOverride) {
            updateData.department = gUser.organizations?.[0]?.department || 'General'
          }

          // Only update position if local override is NOT set
          if (!existing.positionLocalOverride) {
            updateData.position = gUser.organizations?.[0]?.title || 'Employee'
          }

          await prisma.employee.update({
            where: { id: existing.id },
            data: updateData,
          })
          result.updated++
        } else {
          // Create new employee with Google values (no overrides yet)
          maxEmployeeNum++
          await prisma.employee.create({
            data: {
              ...baseData,
              department: gUser.organizations?.[0]?.department || 'General',
              position: gUser.organizations?.[0]?.title || 'Employee',
              employeeId: generateEmployeeId(maxEmployeeNum),
              employmentType: 'FULL_TIME',
              joinDate: new Date(gUser.creationTime),
              status: 'ACTIVE',
              departmentLocalOverride: false,
              positionLocalOverride: false,
            },
          })
          result.created++
        }
      } catch (e: any) {
        result.errors.push(`Failed to sync ${gUser.primaryEmail}: ${e.message}`)
      }
    }

    // Deactivate employees not in Google Workspace (only those with googleId)
    for (const emp of existingEmployees) {
      if (emp.googleId && !googleUserIds.has(emp.googleId)) {
        try {
          await prisma.employee.update({
            where: { id: emp.id },
            data: { status: 'TERMINATED' },
          })
          result.deactivated++
        } catch (e: any) {
          result.errors.push(`Failed to deactivate ${emp.email}: ${e.message}`)
        }
      }
    }

    // Delete employees without googleId that don't match any Google email (bogus users)
    for (const emp of existingEmployees) {
      if (!emp.googleId && !googleEmails.has(emp.email.toLowerCase())) {
        try {
          await prisma.employee.delete({
            where: { id: emp.id },
          })
          result.deactivated++
        } catch (e: any) {
          result.errors.push(`Failed to delete bogus employee ${emp.email}: ${e.message}`)
        }
      }
    }

    console.log(`[Google Admin Sync] Created: ${result.created}, Updated: ${result.updated}, Deactivated: ${result.deactivated}`)
    if (result.errors.length > 0) {
      console.error(`[Google Admin Sync] Errors:`, result.errors)
    }

    return result
  } catch (e: any) {
    console.error('[Google Admin Sync] Failed:', e)
    result.errors.push(e.message)
    return result
  }
}
