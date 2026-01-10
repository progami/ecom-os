import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { EmploymentType, EmployeeStatus } from '@/lib/atlas-prisma-types'
import {
  CreateEmployeeSchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  EmployeeStatusEnum,
  EmploymentTypeEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getOrgVisibleEmployeeIds, isHROrAbove } from '@/lib/permissions'
import { createTemporaryEmployeeId, formatEmployeeId } from '@/lib/employee-identifiers'

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(actorId)
    const { searchParams } = new URL(req.url)

    // Validate pagination params
    const paginationResult = PaginationSchema.safeParse({
      take: searchParams.get('take') || undefined,
      skip: searchParams.get('skip') || undefined,
      q: searchParams.get('q') || undefined,
    })

    const take = paginationResult.success ? paginationResult.data.take : 50
    const skip = paginationResult.success ? paginationResult.data.skip : 0
    const q = paginationResult.success ? paginationResult.data.q?.toLowerCase() : ''

    const where: Record<string, unknown> = {}

    if (!isHR) {
      const visibleIds = await getOrgVisibleEmployeeIds(actorId)
      where.id = { in: visibleIds }
    }

    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
      ]
    }

    const employeeId = searchParams.get('employeeId')
    if (employeeId) where.employeeId = employeeId

    const department = searchParams.get('department')
    if (department) where.department = department

    // Validate status enum
    // Non-HR users can only view ACTIVE employees.
    if (!isHR) {
      where.status = 'ACTIVE'
    } else {
      const statusParam = searchParams.get('status')
      if (statusParam) {
        const statusValidation = EmployeeStatusEnum.safeParse(statusParam.toUpperCase())
        if (statusValidation.success) {
          where.status = statusValidation.data
        }
      }
    }

    // Validate employmentType enum
    const employmentTypeParam = searchParams.get('employmentType')
    if (employmentTypeParam) {
      const typeValidation = EmploymentTypeEnum.safeParse(employmentTypeParam.toUpperCase())
      if (typeValidation.success) {
        where.employmentType = typeValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { employeeId: 'asc' },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          department: true,
          departmentId: true,
          dept: { select: { id: true, name: true } },
          position: true,
          employmentType: true,
          joinDate: true,
          status: true,
          reportsToId: true,
        },
      }),
      prisma.employee.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch employees')
  }
}

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    // Security: Only HR or super-admin can create employees
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasPermission = await isHROrAbove(actorId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only HR or super admin can create employees' }, { status: 403 })
    }

    const body = await req.json()

    // Validate input
    const validation = validateBody(CreateEmployeeSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data
    const departmentName = data.department || data.departmentName || 'General'
    const roles = data.roles || []

    // Use transaction for atomic operation
    const emp = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          employeeId: createTemporaryEmployeeId(),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone ?? null,
          department: departmentName,
          position: data.position,
          employmentType: data.employmentType as EmploymentType,
          joinDate: new Date(data.joinDate),
          status: data.status as EmployeeStatus,
          dept: {
            connectOrCreate: {
              where: { name: departmentName },
              create: { name: departmentName },
            },
          },
          roles: roles.length
            ? {
                connectOrCreate: roles.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              }
            : undefined,
        },
        select: { id: true, employeeNumber: true },
      })

      return tx.employee.update({
        where: { id: created.id },
        data: { employeeId: formatEmployeeId(created.employeeNumber) },
        include: { roles: true, dept: true },
      })
    })

    return NextResponse.json(emp, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create employee')
  }
}
