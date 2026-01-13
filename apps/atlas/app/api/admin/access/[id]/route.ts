import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { HR_ROLE_NAMES, PermissionLevel, isSuperAdmin } from '@/lib/permissions'
import { withRateLimit, withStrictRateLimit, safeErrorResponse } from '@/lib/api-helpers'

const CANONICAL_HR_ROLE_NAME = 'HR'

/**
 * PATCH /api/admin/access/[id]
 * Update employee access levels (Super Admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Use strict rate limit for admin operations (100 requests/minute instead of default)
  const rateLimitError = withStrictRateLimit(request)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can access this endpoint
    const isAdmin = await isSuperAdmin(currentEmployeeId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    const { id: targetEmployeeId } = await params
    const body = await request.json()
    const { isSuperAdmin: newSuperAdminStatus, isHR: newHRStatus } = body

    // Validate target employee exists
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        permissionLevel: true,
        roles: {
          where: { name: { in: HR_ROLE_NAMES } },
          select: { id: true, name: true },
        },
      },
    })

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const nextIsSuperAdmin =
      typeof newSuperAdminStatus === 'boolean' ? newSuperAdminStatus : targetEmployee.isSuperAdmin

    const isHRFromPermissionLevel =
      targetEmployee.permissionLevel >= PermissionLevel.HR &&
      targetEmployee.permissionLevel < PermissionLevel.SUPER_ADMIN
    const hasHRRole = targetEmployee.roles.length > 0
    const currentIsHR = isHRFromPermissionLevel || hasHRRole
    const nextIsHR = typeof newHRStatus === 'boolean' ? newHRStatus : currentIsHR

    // Prevent removing your own Super Admin status
    if (currentEmployeeId === targetEmployeeId && newSuperAdminStatus === false && targetEmployee.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Cannot remove your own Super Admin status' },
        { status: 400 }
      )
    }

    const shouldUpdatePermissionLevel =
      typeof newSuperAdminStatus === 'boolean' || typeof newHRStatus === 'boolean'

    const nextPermissionLevel = nextIsSuperAdmin
      ? PermissionLevel.SUPER_ADMIN
      : nextIsHR
        ? PermissionLevel.HR
        : PermissionLevel.EMPLOYEE

    type EmployeeUpdateData = Parameters<typeof prisma.employee.update>[0]['data']
    const updateData: EmployeeUpdateData = {}

    if (typeof newSuperAdminStatus === 'boolean') {
      updateData.isSuperAdmin = newSuperAdminStatus
    }

    if (shouldUpdatePermissionLevel) {
      updateData.permissionLevel = nextPermissionLevel
    }

    if (typeof newHRStatus === 'boolean') {
      if (newHRStatus) {
        let hrRole = await prisma.role.findUnique({
          where: { name: CANONICAL_HR_ROLE_NAME },
        })

        if (!hrRole) {
          hrRole = await prisma.role.create({
            data: {
              name: CANONICAL_HR_ROLE_NAME,
              description: 'Human Resources - Can review violations and access employee records',
            },
          })
        }

        const alreadyHasCanonical = targetEmployee.roles.some((r) => r.name === CANONICAL_HR_ROLE_NAME)
        if (!alreadyHasCanonical) {
          updateData.roles = { connect: { id: hrRole.id } }
        }
      } else if (targetEmployee.roles.length > 0) {
        // SECURITY FIX: Only disconnect HR-specific roles, not ALL roles
        // This prevents accidentally removing non-HR roles (e.g., project manager, team lead)
        const hrRolesToDisconnect = targetEmployee.roles.filter((r) => HR_ROLE_NAMES.includes(r.name))
        if (hrRolesToDisconnect.length > 0) {
          updateData.roles = {
            disconnect: hrRolesToDisconnect.map((r) => ({ id: r.id })),
          }
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.employee.update({
        where: { id: targetEmployeeId },
        data: updateData,
      })

      // SECURITY FIX: Add audit logging for admin access changes
      await prisma.auditLog.create({
        data: {
          actorId: currentEmployeeId,
          action: 'UPDATE',
          entityType: 'EMPLOYEE',
          entityId: targetEmployeeId,
          summary: `Updated employee access: ${[
            typeof newSuperAdminStatus === 'boolean' ? `isSuperAdmin=${newSuperAdminStatus}` : null,
            typeof newHRStatus === 'boolean' ? `isHR=${newHRStatus}` : null,
          ].filter(Boolean).join(', ')}`,
          metadata: {
            targetEmail: targetEmployee.email,
            previousState: {
              isSuperAdmin: targetEmployee.isSuperAdmin,
              permissionLevel: targetEmployee.permissionLevel,
              hrRoles: targetEmployee.roles.map((r) => r.name),
            },
            newState: {
              isSuperAdmin: nextIsSuperAdmin,
              permissionLevel: nextPermissionLevel,
              isHR: nextIsHR,
            },
          },
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: request.headers.get('user-agent') ?? null,
        },
      })
    }

    // Fetch updated employee
    const updatedEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        position: true,
        avatar: true,
        isSuperAdmin: true,
        permissionLevel: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!updatedEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const updatedIsHR =
      (updatedEmployee.permissionLevel >= PermissionLevel.HR &&
        updatedEmployee.permissionLevel < PermissionLevel.SUPER_ADMIN) ||
      updatedEmployee.roles.some((r) => HR_ROLE_NAMES.includes(r.name))

    return NextResponse.json({
      success: true,
      employee: {
        ...updatedEmployee,
        isHR: updatedIsHR,
        hrRoleId: updatedEmployee.roles.find((r) => HR_ROLE_NAMES.includes(r.name))?.id || null,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update access')
  }
}
