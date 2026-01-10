import { NextResponse } from 'next/server'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canEditField, canViewEmployeeDirectory, isManagerOf, isSuperAdmin, FIELD_PERMISSIONS, type AttributePermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// Fields grouped by their typical UI section
const FIELD_GROUPS = {
  identity: ['firstName', 'lastName', 'email', 'avatar', 'googleId'],
  personal: ['phone', 'address', 'city', 'country', 'postalCode', 'emergencyContact', 'emergencyPhone', 'dateOfBirth', 'gender', 'maritalStatus', 'nationality'],
  organization: ['department', 'departmentId', 'position', 'reportsToId'],
  employment: ['employmentType', 'joinDate', 'status', 'region', 'salary', 'currency'],
  admin: ['permissionLevel', 'isSuperAdmin'],
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id: targetEmployeeIdRaw } = await context.params

    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const base = await prisma.employee.findFirst({
      where: { OR: [{ id: targetEmployeeIdRaw }, { employeeId: targetEmployeeIdRaw }] },
      select: { id: true },
    })

    if (!base) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const targetEmployeeId = base.id

    const canView = await canViewEmployeeDirectory(actorId, targetEmployeeId)
    if (!canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isEditingSelf = actorId === targetEmployeeId
    const isManager = await isManagerOf(actorId, targetEmployeeId)
    const isSuperAdminUser = await isSuperAdmin(actorId)

    // Check each field's permission
    const fieldPermissions: Record<string, {
      canEdit: boolean
      permission: AttributePermission
      reason?: string
    }> = {}

    for (const [field, permission] of Object.entries(FIELD_PERMISSIONS)) {
      const result = await canEditField(actorId, targetEmployeeId, field)
      fieldPermissions[field] = {
        canEdit: result.allowed,
        permission,
        reason: result.reason,
      }
    }

    // Group fields by editability
    const editableFields = Object.entries(fieldPermissions)
      .filter(([_, v]) => v.canEdit)
      .map(([k]) => k)

    const readOnlyFields = Object.entries(fieldPermissions)
      .filter(([_, v]) => !v.canEdit)
      .map(([k]) => k)

    return NextResponse.json({
      actorId,
      targetEmployeeId: targetEmployeeId,
      isEditingSelf,
      isManager,
      isSuperAdmin: isSuperAdminUser,
      fieldPermissions,
      editableFields,
      readOnlyFields,
      fieldGroups: FIELD_GROUPS,
    })
  } catch (e) {
    console.error('Permission check error:', e)
    return NextResponse.json({ error: 'Failed to check permissions' }, { status: 500 })
  }
}
