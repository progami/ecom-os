import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { DisciplinaryStatus } from '@ecom-os/prisma-hrms'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { SubmitAppealSchema, ResolveAppealSchema } from '@/lib/validations'
import { canHRReview, getHREmployees, isHROrAbove, isManagerOf } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/disciplinary-actions/[id]/appeal
 *
 * Submit an appeal (by employee) or resolve an appeal (by HR/manager)
 * - Employee: submits appeal with reason
 * - HR/Manager: resolves appeal with status and resolution
 */
export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const body = await req.json()

    // Get the disciplinary action
    const action = await prisma.disciplinaryAction.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            reportsToId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isEmployee = currentEmployeeId === action.employeeId

    // Determine if this is an appeal submission or resolution
    if (body.appealStatus || body.hrReview) {
      // Check current status to determine which stage we're at
      const isHRReviewStage = action.status === 'APPEAL_PENDING_HR'

      if (!action.appealedAt) {
        return NextResponse.json(
          { error: 'No appeal has been submitted to resolve' },
          { status: 400 }
        )
      }

      // HR Review stage: HR makes final appeal decision (simplified workflow)
      if (body.appealStatus && isHRReviewStage) {
        const hrPermission = await canHRReview(currentEmployeeId)
        if (!hrPermission.allowed) {
          return NextResponse.json(
            { error: `Permission denied: ${hrPermission.reason}` },
            { status: 403 }
          )
        }

        const validation = validateBody(ResolveAppealSchema, body)
        if (!validation.success) {
          return validation.error
        }

        const { appealStatus, appealResolution } = validation.data

        // Determine new status based on appeal resolution
        let newStatus: DisciplinaryStatus = action.status
        if (appealStatus === 'OVERTURNED') {
          newStatus = DisciplinaryStatus.DISMISSED
        } else if (appealStatus === 'UPHELD' || appealStatus === 'MODIFIED') {
          newStatus = DisciplinaryStatus.CLOSED
        }

        const updated = await prisma.disciplinaryAction.update({
          where: { id },
          data: {
            appealStatus,
            appealResolution,
            appealResolvedAt: new Date(),
            appealResolvedById: currentEmployeeId,
            appealHrReviewedAt: new Date(),
            appealHrReviewedById: currentEmployeeId,
            appealHrNotes: appealResolution,
            status: newStatus,
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: true,
                position: true,
                email: true,
              },
            },
          },
        })

        const recordLink = `/performance/disciplinary/${id}`

        // Notify employee of appeal decision
        await prisma.notification.create({
          data: {
            type: 'APPEAL_DECIDED',
            title: `Appeal ${appealStatus.charAt(0) + appealStatus.slice(1).toLowerCase()}`,
            message: `Your appeal has been ${appealStatus.toLowerCase()}. ${appealResolution ?? ''}`,
            link: recordLink,
            employeeId: action.employeeId,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })

        return NextResponse.json({
          ...updated,
          message: `Appeal ${appealStatus.toLowerCase()} by HR`,
        })
      }

      // Legacy resolution for old status (backwards compatibility)
      if (body.appealStatus && action.status === 'APPEALED') {
        const isManager = currentEmployeeId === action.employee.reportsToId
        const canResolve = await isHROrAbove(currentEmployeeId) || isManager || await isManagerOf(currentEmployeeId, action.employeeId)

        if (!canResolve) {
          return NextResponse.json(
            { error: 'Only HR or managers can resolve appeals' },
            { status: 403 }
          )
        }

        if (action.appealResolvedAt) {
          return NextResponse.json(
            { error: 'Appeal has already been resolved' },
            { status: 400 }
          )
        }

        const validation = validateBody(ResolveAppealSchema, body)
        if (!validation.success) {
          return validation.error
        }

        const { appealStatus, appealResolution } = validation.data

        let newStatus: DisciplinaryStatus = action.status
        if (appealStatus === 'OVERTURNED') {
          newStatus = DisciplinaryStatus.DISMISSED
        } else if (appealStatus === 'UPHELD' || appealStatus === 'MODIFIED') {
          newStatus = DisciplinaryStatus.CLOSED
        }

	      const updated = await prisma.disciplinaryAction.update({
	        where: { id },
	        data: {
            appealStatus,
            appealResolution,
            appealResolvedAt: new Date(),
            appealResolvedById: currentEmployeeId,
            status: newStatus,
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: true,
                position: true,
                email: true,
              },
            },
          },
        })

        return NextResponse.json({
          ...updated,
          message: `Appeal ${appealStatus.toLowerCase()}`,
        })
      }

      return NextResponse.json(
        { error: `Invalid request for current status: ${action.status}` },
        { status: 400 }
      )
    } else {
      // This is an appeal submission - must be the employee
      if (!isEmployee) {
        return NextResponse.json(
          { error: 'Only the employee can submit an appeal' },
          { status: 403 }
        )
      }

      if (action.status !== 'PENDING_ACKNOWLEDGMENT') {
        return NextResponse.json(
          { error: `Cannot appeal: action is in ${action.status} status, expected PENDING_ACKNOWLEDGMENT` },
          { status: 400 }
        )
      }

      if (action.employeeAcknowledged) {
        return NextResponse.json(
          { error: 'Cannot appeal after acknowledging' },
          { status: 400 }
        )
      }

      if (action.appealedAt) {
        return NextResponse.json(
          { error: 'Appeal already submitted' },
          { status: 400 }
        )
      }

      const validation = validateBody(SubmitAppealSchema, body)
      if (!validation.success) {
        return validation.error
      }

      const { appealReason } = validation.data

      // Appeal goes to HR first in the approval chain
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          appealReason,
          appealedAt: new Date(),
          appealStatus: 'PENDING',
          status: 'APPEAL_PENDING_HR', // New status: Appeal waiting for HR review
        },
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
	      })

      const recordLink = `/performance/disciplinary/${id}`

	      // Notify HR about the appeal
	      const hrEmployees = await getHREmployees()
	      for (const hr of hrEmployees) {
	        await prisma.notification.create({
	          data: {
	            type: 'APPEAL_PENDING_HR',
	            title: 'Appeal Submitted - Review Required',
	            message: `${updated.employee.firstName} ${updated.employee.lastName} has submitted an appeal for a violation. Please review.`,
	            link: recordLink,
	            employeeId: hr.id,
	            relatedId: id,
	            relatedType: 'DISCIPLINARY',
	          },
	        })
	      }

      return NextResponse.json({
        ...updated,
        message: 'Appeal submitted successfully. HR will review your appeal.',
      })
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process appeal')
  }
}

/**
 * GET /api/disciplinary-actions/[id]/appeal
 *
 * Get appeal status and check if current user can appeal/resolve
 */
export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const action = await prisma.disciplinaryAction.findUnique({
      where: { id },
      select: {
        employeeId: true,
        status: true,
        employeeAcknowledged: true,
        appealReason: true,
        appealedAt: true,
        appealStatus: true,
        appealResolution: true,
        appealResolvedAt: true,
        appealResolvedById: true,
        employee: {
          select: {
            reportsToId: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isEmployee = currentEmployeeId === action.employeeId
    const isManager = currentEmployeeId === action.employee.reportsToId
    const canResolve = await isHROrAbove(currentEmployeeId) || isManager || await isManagerOf(currentEmployeeId, action.employeeId)

    // Employee can appeal if they haven't acknowledged AND haven't already appealed
    const canAppeal = isEmployee &&
      action.status === 'PENDING_ACKNOWLEDGMENT' &&
      !action.employeeAcknowledged &&
      !action.appealedAt

    const hrPermission = await canHRReview(currentEmployeeId)

    // HR makes final appeal decisions in simplified workflow
    const canReviewAsHR = Boolean(action.appealedAt) &&
      action.status === 'APPEAL_PENDING_HR' &&
      hrPermission.allowed

    // Legacy support for old APPEALED status
    const canResolveLegacy = Boolean(action.appealedAt) &&
      action.status === 'APPEALED' &&
      canResolve &&
      !action.appealResolvedAt

    const canResolveAppeal = canReviewAsHR || canResolveLegacy

    return NextResponse.json({
      appealReason: action.appealReason,
      appealedAt: action.appealedAt,
      appealStatus: action.appealStatus,
      appealResolution: action.appealResolution,
      appealResolvedAt: action.appealResolvedAt,
      canAppeal,
      canResolveAppeal,
      canReviewAsHR,
      hasAppealed: Boolean(action.appealedAt),
      appealResolved: Boolean(action.appealResolvedAt),
      status: action.status,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get appeal status')
  }
}
