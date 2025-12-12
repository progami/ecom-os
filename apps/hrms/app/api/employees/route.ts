import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { EmploymentType, EmployeeStatus, Region, TransactionClient } from '@/lib/hrms-prisma-types'
import {
  CreateEmployeeSchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  EmployeeStatusEnum,
  EmploymentTypeEnum,
  RegionEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
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
    const statusParam = searchParams.get('status')
    if (statusParam) {
      const statusValidation = EmployeeStatusEnum.safeParse(statusParam.toUpperCase())
      if (statusValidation.success) {
        where.status = statusValidation.data
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

    // Validate region enum
    const regionParam = searchParams.get('region')
    if (regionParam) {
      const regionValidation = RegionEnum.safeParse(regionParam.toUpperCase())
      if (regionValidation.success) {
        where.region = regionValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { createdAt: 'desc' },
        include: { roles: true, dept: true },
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
    const body = await req.json()

    // Validate input
    const validation = validateBody(CreateEmployeeSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data
    const departmentName = data.department || data.departmentName || 'General'
    const roles = data.roles || []

    // Auto-generate employeeId if not provided
    let employeeId = data.employeeId
    if (!employeeId) {
      const lastEmployee = await prisma.employee.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { employeeId: true },
      })
      const lastNum = lastEmployee?.employeeId?.match(/EMP(\d+)/)?.[1]
      const nextNum = lastNum ? parseInt(lastNum, 10) + 1 : 1
      employeeId = `EMP${String(nextNum).padStart(3, '0')}`
    }

    // Use transaction for atomic operation
    const emp = await prisma.$transaction(async (tx: TransactionClient) => {
      return tx.employee.create({
        data: {
          employeeId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone ?? null,
          department: departmentName,
          position: data.position,
          employmentType: data.employmentType as EmploymentType,
          joinDate: new Date(data.joinDate),
          status: data.status as EmployeeStatus,
          region: (data.region as Region) ?? 'KANSAS_US',
          managerId: data.managerId ?? null,
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
        include: { roles: true, dept: true },
      })
    })

    return NextResponse.json(emp, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create employee')
  }
}
