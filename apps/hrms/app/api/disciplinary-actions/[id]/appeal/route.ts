import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { SubmitAppealSchema, ResolveAppealSchema } from '@/lib/validations'
import { publish } from '@/lib/notification-service'

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
    if (body.appealStatus) {
      // This is a resolution attempt - must be HR/manager
      const currentEmployee = await prisma.employee.findUnique({
        where: { id: currentEmployeeId },
        select: { isSuperAdmin: true, permissionLevel: true },
      })

      const isManager = currentEmployeeId === action.employee.reportsToId
      const canResolve = currentEmployee?.isSuperAdmin ||
                        (currentEmployee?.permissionLevel ?? 0) >= 50 ||
                        isManager

      if (!canResolve) {
        return NextResponse.json(
          { error: 'Only HR or managers can resolve appeals' },
          { status: 403 }
        )
      }

      if (!action.appealedAt) {
        return NextResponse.json(
          { error: 'No appeal has been submitted to resolve' },
          { status: 400 }
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

      // Determine new status based on appeal resolution
      let newStatus = action.status
      if (appealStatus === 'OVERTURNED') {
        newStatus = 'DISMISSED'
      } else if (appealStatus === 'UPHELD' || appealStatus === 'MODIFIED') {
        newStatus = 'CLOSED'
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

      // Notify employee of appeal resolution
      await publish({
        type: 'DISCIPLINARY_UPDATED',
        actionId: id,
        employeeId: action.employeeId,
        status: `APPEAL_${appealStatus}`,
      })

      return NextResponse.json({
        ...updated,
        message: `Appeal ${appealStatus.toLowerCase()}`,
      })
    } else {
      // This is an appeal submission - must be the employee
      if (!isEmployee) {
        return NextResponse.json(
          { error: 'Only the employee can submit an appeal' },
          { status: 403 }
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

      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          appealReason,
          appealedAt: new Date(),
          appealStatus: 'PENDING',
          status: 'APPEALED',
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

      // Notify manager/HR of appeal
      await publish({
        type: 'DISCIPLINARY_UPDATED',
        actionId: id,
        employeeId: action.employeeId,
        status: 'APPEALED',
      })

      return NextResponse.json({
        ...updated,
        message: 'Appeal submitted successfully',
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

    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })
    const canResolve = currentEmployee?.isSuperAdmin ||
                      (currentEmployee?.permissionLevel ?? 0) >= 50 ||
                      isManager

    // Employee can appeal if they haven't acknowledged AND haven't already appealed
    const canAppeal = isEmployee && !action.employeeAcknowledged && !action.appealedAt

    // Can resolve if appeal is pending and user has permission
    const canResolveAppeal = canResolve && action.appealedAt && !action.appealResolvedAt

    return NextResponse.json({
      appealReason: action.appealReason,
      appealedAt: action.appealedAt,
      appealStatus: action.appealStatus,
      appealResolution: action.appealResolution,
      appealResolvedAt: action.appealResolvedAt,
      canAppeal,
      canResolveAppeal,
      hasAppealed: Boolean(action.appealedAt),
      appealResolved: Boolean(action.appealResolvedAt),
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get appeal status')
  }
}
