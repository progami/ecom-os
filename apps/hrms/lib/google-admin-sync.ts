import { prisma } from './prisma'
import { listAllUsers, isAdminConfigured, patchUser, type GoogleUser } from './google-admin'
import { publish } from './notification-service'
import { createTemporaryEmployeeId, formatEmployeeId } from './employee-identifiers'

export type SyncResult = {
  created: number
  updated: number
  deactivated: number
  errors: string[]
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
      nameLocalOverride: boolean
      departmentLocalOverride: boolean
      positionLocalOverride: boolean
    }
    const existingEmployees: ExistingEmployee[] = await prisma.employee.findMany({
      select: {
        id: true,
        googleId: true,
        email: true,
        employeeId: true,
        nameLocalOverride: true,
        departmentLocalOverride: true,
        positionLocalOverride: true,
      }
    })

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

        // Base data that always syncs from Google (except overridden fields)
        const baseData: Record<string, unknown> = {
          googleId: gUser.id,
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

          // Only update name if local override is NOT set
          if (!existing.nameLocalOverride) {
            updateData.firstName = gUser.name?.givenName || gUser.primaryEmail.split('@')[0]
            updateData.lastName = gUser.name?.familyName || ''
          }

          // Only update department if local override is NOT set AND Google has a value
          if (!existing.departmentLocalOverride && gUser.organizations?.[0]?.department) {
            updateData.department = gUser.organizations[0].department
          }

          // Only update position if local override is NOT set AND Google has a value
          if (!existing.positionLocalOverride && gUser.organizations?.[0]?.title) {
            updateData.position = gUser.organizations[0].title
          }

          await prisma.employee.update({
            where: { id: existing.id },
            data: updateData,
          })
          result.updated++
        } else {
          // Create new employee with Google values (no overrides yet)
          await prisma.$transaction(async (tx) => {
            const created = await tx.employee.create({
              data: {
                employeeId: createTemporaryEmployeeId(),
                googleId: gUser.id,
                email: gUser.primaryEmail,
                phone: gUser.phones?.[0]?.value || null,
                avatar: gUser.thumbnailPhotoUrl || null,
                firstName: gUser.name?.givenName || gUser.primaryEmail.split('@')[0],
                lastName: gUser.name?.familyName || '',
                department: gUser.organizations?.[0]?.department || '',
                position: gUser.organizations?.[0]?.title || 'Employee',
                employmentType: 'FULL_TIME',
                joinDate: new Date(gUser.creationTime),
                status: 'ACTIVE',
                nameLocalOverride: false,
                departmentLocalOverride: false,
                positionLocalOverride: false,
              },
              select: { id: true, employeeNumber: true },
            })

            await tx.employee.update({
              where: { id: created.id },
              data: { employeeId: formatEmployeeId(created.employeeNumber) },
            })
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
    // Protected test users that should not be deleted by sync
    const protectedEmails = new Set(['gondalshoaib3333@gmail.com'])
    for (const emp of existingEmployees) {
      if (!emp.googleId && !googleEmails.has(emp.email.toLowerCase()) && !protectedEmails.has(emp.email.toLowerCase())) {
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

/**
 * Sync HRMS changes back to Google Admin (two-way sync)
 * Only syncs fields that have local overrides enabled
 */
export async function syncEmployeeToGoogle(employeeId: string): Promise<{ success: boolean; error?: string }> {
  if (!isAdminConfigured()) {
    return { success: false, error: 'Google Admin not configured' }
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        googleId: true,
        email: true,
        department: true,
        position: true,
        phone: true,
        departmentLocalOverride: true,
        positionLocalOverride: true,
      }
    })

    if (!employee) {
      return { success: false, error: 'Employee not found' }
    }

    if (!employee.googleId) {
      return { success: false, error: 'Employee not linked to Google account' }
    }

    // Build update payload - only include fields with local overrides
    const updates: { department?: string; title?: string; phone?: string } = {}

    if (employee.departmentLocalOverride && employee.department) {
      updates.department = employee.department
    }

    if (employee.positionLocalOverride && employee.position) {
      updates.title = employee.position
    }

    // Phone is always synced if present
    if (employee.phone) {
      updates.phone = employee.phone
    }

    // If no updates needed, skip
    if (Object.keys(updates).length === 0) {
      return { success: true }
    }

    // Patch Google Admin user
    await patchUser(employee.googleId, updates)

    console.log(`[Google Admin Sync] Pushed updates to Google for ${employee.email}:`, updates)
    return { success: true }

  } catch (e: any) {
    console.error(`[Google Admin Sync] Failed to sync employee ${employeeId} to Google:`, e)
    return { success: false, error: e.message }
  }
}

/**
 * Sync all employees with local overrides to Google Admin
 */
export async function syncAllOverridesToGoogle(): Promise<{
  synced: number
  failed: number
  errors: string[]
}> {
  const result = { synced: 0, failed: 0, errors: [] as string[] }

  if (!isAdminConfigured()) {
    result.errors.push('Google Admin not configured')
    return result
  }

  // Find employees with local overrides
  const employees = await prisma.employee.findMany({
    where: {
      googleId: { not: null },
      OR: [
        { departmentLocalOverride: true },
        { positionLocalOverride: true },
      ]
    },
    select: { id: true, email: true }
  })

  for (const emp of employees) {
    const syncResult = await syncEmployeeToGoogle(emp.id)
    if (syncResult.success) {
      result.synced++
    } else {
      result.failed++
      result.errors.push(`${emp.email}: ${syncResult.error}`)
    }
  }

  console.log(`[Google Admin Sync] Pushed overrides to Google: ${result.synced} synced, ${result.failed} failed`)
  return result
}
