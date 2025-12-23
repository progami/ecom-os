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
import { canRaiseViolation, getHREmployees } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

    // Authentication check
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's permission level
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })

    const paginationResult = PaginationSchema.safeParse({
      take: searchParams.get('take') || undefined,
      skip: searchParams.get('skip') || undefined,
      q: searchParams.get('q') || undefined,
    })

    const take = paginationResult.success ? paginationResult.data.take : 50
    const skip = paginationResult.success ? paginationResult.data.skip : 0
    const q = paginationResult.success ? paginationResult.data.q?.toLowerCase() : ''

    const where: Record<string, unknown> = {}

    // Access control: restrict what disciplinary actions can be viewed
    const employeeIdParam = searchParams.get('employeeId')

    if (employeeIdParam) {
      // Requesting specific employee's violations - check permission
      const canView = currentEmployee?.isSuperAdmin ||
                     (currentEmployee?.permissionLevel ?? 0) >= 50 ||
                     employeeIdParam === currentEmployeeId

      if (!canView) {
        // Check if manager of the employee
        const targetEmployee = await prisma.employee.findUnique({
          where: { id: employeeIdParam },
          select: { reportsToId: true },
        })
        if (targetEmployee?.reportsToId !== currentEmployeeId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      where.employeeId = employeeIdParam
    } else {
      // No specific employee - restrict to own + direct reports unless admin/HR
      if (!currentEmployee?.isSuperAdmin && (currentEmployee?.permissionLevel ?? 0) < 50) {
        const directReportIds = await prisma.employee.findMany({
          where: { reportsToId: currentEmployeeId },
          select: { id: true },
        })
        where.employeeId = {
          in: [currentEmployeeId, ...directReportIds.map(d => d.id)],
        }
      }
    }

    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { reportedBy: { contains: q, mode: 'insensitive' } },
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
      ]
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

    // Check if current user has permission to RAISE violation for this employee
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const permissionCheck = await canRaiseViolation(currentEmployeeId, data.employeeId)
    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    // Create violation with PENDING_HR_REVIEW status (approval chain starts here)
    const item = await prisma.disciplinaryAction.create({
      data: {
        employeeId: data.employeeId,
        violationType: data.violationType,
        violationReason: data.violationReason,
        valuesBreached: data.valuesBreached,
        severity: data.severity,
        incidentDate: new Date(data.incidentDate),
        reportedBy: data.reportedBy,
        description: data.description,
        witnesses: data.witnesses ?? null,
        evidence: data.evidence ?? null,
        actionTaken: data.actionTaken,
        // Always start with PENDING_HR_REVIEW - approval chain: Manager -> HR -> Super Admin
        status: 'PENDING_HR_REVIEW',
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

    await writeAuditLog({
      actorId: currentEmployeeId,
      action: 'CREATE',
      entityType: 'DISCIPLINARY_ACTION',
      entityId: item.id,
      summary: `Raised violation (${item.severity.toLowerCase()})`,
      metadata: {
        employeeId: item.employeeId,
        violationType: item.violationType,
        violationReason: item.violationReason,
        severity: item.severity,
        status: item.status,
      },
      req,
    })

    // Notify HR about pending violation review
    const hrEmployees = await getHREmployees()
    for (const hr of hrEmployees) {
      await prisma.notification.create({
        data: {
          type: 'VIOLATION_PENDING_HR',
          title: 'Violation Pending Review',
          message: `A new violation has been raised for ${item.employee.firstName} ${item.employee.lastName}. Please review.`,
          link: `/performance/disciplinary/${item.id}`,
          employeeId: hr.id,
          relatedId: item.id,
          relatedType: 'DISCIPLINARY',
        },
      })
    }

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create disciplinary action')
  }
}
