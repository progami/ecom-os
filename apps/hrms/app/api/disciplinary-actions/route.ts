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
import { canRaiseViolation, getHREmployees, getSubtreeEmployeeIds, isHROrAbove, isManagerOf } from '@/lib/permissions'

function toCaseSeverity(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (severity) {
    case 'CRITICAL':
      return 'CRITICAL'
    case 'MAJOR':
      return 'HIGH'
    case 'MODERATE':
      return 'MEDIUM'
    case 'MINOR':
    default:
      return 'LOW'
  }
}

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

    const isHR = await isHROrAbove(currentEmployeeId)

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
      const isSelf = employeeIdParam === currentEmployeeId
      if (!isSelf && !isHR) {
        const isManager = await isManagerOf(currentEmployeeId, employeeIdParam)
        if (!isManager) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      where.employeeId = employeeIdParam
    } else {
      // No specific employee - restrict to own + subtree unless HR
      if (!isHR) {
        const subtreeIds = await getSubtreeEmployeeIds(currentEmployeeId)
        where.employeeId = { in: [currentEmployeeId, ...subtreeIds] }
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
      },
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

    const hrEmployees = await getHREmployees()
    const assignedToId = hrEmployees[0]?.id ?? null

    const { item, caseId } = await prisma.$transaction(async (tx) => {
      const caseRecord = await tx.case.create({
        data: {
          caseType: 'VIOLATION',
          title: `Violation • ${employee.firstName} ${employee.lastName}`.trim(),
          description: 'Violation record created. Use the linked violation workflow to review and proceed.',
          severity: toCaseSeverity(data.severity),
          subjectEmployeeId: data.employeeId,
          createdById: currentEmployeeId,
          assignedToId,
        },
        select: { id: true, caseNumber: true },
      })

      await tx.caseParticipant.createMany({
        data: [
          { caseId: caseRecord.id, employeeId: data.employeeId, role: 'SUBJECT' },
          { caseId: caseRecord.id, employeeId: currentEmployeeId, role: 'REPORTER' },
        ],
        skipDuplicates: true,
      })

      const created = await tx.disciplinaryAction.create({
        data: {
          employeeId: data.employeeId,
          caseId: caseRecord.id,
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
          // Start with PENDING_HR_REVIEW - HR approves violations (simplified workflow)
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

      return { item: created, caseId: caseRecord.id }
    })

    // Notify HR about pending violation review
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

    return NextResponse.json({ ...item, caseId }, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create disciplinary action')
  }
}
