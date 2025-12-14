import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdateEmployeeSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { EmploymentType, EmployeeStatus } from '@/lib/hrms-prisma-types'
import { checkAndNotifyMissingFields } from '@/lib/notification-service'

type EmployeeRouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: EmployeeRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const e = await prisma.employee.findFirst({
      where: { OR: [{ id }, { employeeId: id }] },
      include: { roles: true, dept: true, manager: { select: { id: true, firstName: true, lastName: true, position: true } } },
    })

    if (!e) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(e)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch employee')
  }
}

export async function PATCH(req: Request, context: EmployeeRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()

    // Validate input with whitelist schema
    const validation = validateBody(UpdateEmployeeSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data
    const departmentName = data.department || data.departmentName
    const roles = data.roles

    // Build update object with explicit field whitelist
    const updates: Record<string, unknown> = {}

    if (data.firstName !== undefined) updates.firstName = data.firstName
    if (data.lastName !== undefined) updates.lastName = data.lastName
    if (data.email !== undefined) updates.email = data.email
    if (data.phone !== undefined) updates.phone = data.phone
    if (data.position !== undefined) {
      updates.position = data.position
      // Auto-set local override flag when position is manually updated
      updates.positionLocalOverride = true
    }
    if (data.employmentType !== undefined) updates.employmentType = data.employmentType as EmploymentType
    if (data.status !== undefined) updates.status = data.status as EmployeeStatus
    if (data.joinDate !== undefined) updates.joinDate = new Date(data.joinDate)

    // Hierarchy - use manager relation instead of reportsToId directly
    if (data.reportsToId !== undefined) {
      if (data.reportsToId) {
        updates.manager = { connect: { id: data.reportsToId } }
      } else {
        updates.manager = { disconnect: true }
      }
    }

    // Personal info
    if (data.dateOfBirth !== undefined) updates.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
    if (data.gender !== undefined) updates.gender = data.gender
    if (data.maritalStatus !== undefined) updates.maritalStatus = data.maritalStatus
    if (data.nationality !== undefined) updates.nationality = data.nationality
    if (data.address !== undefined) updates.address = data.address
    if (data.city !== undefined) updates.city = data.city
    if (data.country !== undefined) updates.country = data.country
    if (data.postalCode !== undefined) updates.postalCode = data.postalCode
    if (data.emergencyContact !== undefined) updates.emergencyContact = data.emergencyContact
    if (data.emergencyPhone !== undefined) updates.emergencyPhone = data.emergencyPhone

    // Salary
    if (data.salary !== undefined) updates.salary = data.salary
    if (data.currency !== undefined) updates.currency = data.currency

    // Handle department relationship
    if (departmentName) {
      updates.department = departmentName
      // Auto-set local override flag when department is manually updated
      updates.departmentLocalOverride = true
      updates.dept = {
        connectOrCreate: {
          where: { name: departmentName },
          create: { name: departmentName },
        },
      }
    }

    // Handle roles relationship
    if (roles !== undefined) {
      updates.roles = {
        set: [],
        connectOrCreate: roles.map((name) => ({
          where: { name },
          create: { name },
        })),
      }
    }

    const e = await prisma.employee.update({
      where: { id },
      data: updates,
      include: { roles: true, dept: true, manager: { select: { id: true, firstName: true, lastName: true, position: true } } },
    })

    // Re-check profile completion after update
    await checkAndNotifyMissingFields(id)

    return NextResponse.json(e)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update employee')
  }
}

export async function DELETE(req: Request, context: EmployeeRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete employee')
  }
}
