import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreateDisciplinaryActionSchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  ViolationTypeEnum,
  ViolationSeverityEnum,
  DisciplinaryStatusEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canManageEmployee } from '@/lib/permissions'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

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
        { description: { contains: q, mode: 'insensitive' } },
        { reportedBy: { contains: q, mode: 'insensitive' } },
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const employeeIdParam = searchParams.get('employeeId')
    if (employeeIdParam) {
      where.employeeId = employeeIdParam
    }

    const violationTypeParam = searchParams.get('violationType')
    if (violationTypeParam) {
      const typeValidation = ViolationTypeEnum.safeParse(violationTypeParam.toUpperCase())
      if (typeValidation.success) {
        where.violationType = typeValidation.data
      }
    }

    const severityParam = searchParams.get('severity')
    if (severityParam) {
      const severityValidation = ViolationSeverityEnum.safeParse(severityParam.toUpperCase())
      if (severityValidation.success) {
        where.severity = severityValidation.data
      }
    }

    const statusParam = searchParams.get('status')
    if (statusParam) {
      const statusValidation = DisciplinaryStatusEnum.safeParse(statusParam.toUpperCase())
      if (statusValidation.success) {
        where.status = statusValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.disciplinaryAction.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { incidentDate: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
              position: true,
            },
          },
        },
      }),
      prisma.disciplinaryAction.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch disciplinary actions')
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()

    const validation = validateBody(CreateDisciplinaryActionSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if current user has permission to manage this employee
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const permissionCheck = await canManageEmployee(currentEmployeeId, data.employeeId)
    if (!permissionCheck.canManage) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    const item = await prisma.disciplinaryAction.create({
      data: {
        employeeId: data.employeeId,
        violationType: data.violationType,
        violationReason: data.violationReason,
        severity: data.severity,
        incidentDate: new Date(data.incidentDate),
        reportedBy: data.reportedBy,
        description: data.description,
        witnesses: data.witnesses ?? null,
        evidence: data.evidence ?? null,
        actionTaken: data.actionTaken,
        actionDate: data.actionDate ? new Date(data.actionDate) : null,
        actionDetails: data.actionDetails ?? null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        followUpNotes: data.followUpNotes ?? null,
        status: data.status,
        resolution: data.resolution ?? null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create disciplinary action')
  }
}
