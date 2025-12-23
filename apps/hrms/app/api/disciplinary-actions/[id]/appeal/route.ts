import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { DisciplinaryStatus } from '@ecom-os/prisma-hrms'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { SubmitAppealSchema, ResolveAppealSchema } from '@/lib/validations'
import { canHRReview, canFinalApprove, getHREmployees, getSuperAdminEmployees } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

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
    if (body.appealStatus || body.hrReview || body.superAdminDecision) {
      // Check current status to determine which stage we're at
      const isHRReviewStage = action.status === 'APPEAL_PENDING_HR'
      const isSuperAdminStage = action.status === 'APPEAL_PENDING_SUPER_ADMIN'

      if (!action.appealedAt) {
        return NextResponse.json(
          { error: 'No appeal has been submitted to resolve' },
          { status: 400 }
        )
      }

      // HR Review stage: HR reviews and forwards to Super Admin
      if (body.hrReview && isHRReviewStage) {
        const hrPermission = await canHRReview(currentEmployeeId)
        if (!hrPermission.allowed) {
          return NextResponse.json(
            { error: `Permission denied: ${hrPermission.reason}` },
            { status: 403 }
          )
        }

        const { notes, forwardToSuperAdmin } = body.hrReview

        if (forwardToSuperAdmin) {
          // Forward to Super Admin for final decision
          const updated = await prisma.disciplinaryAction.update({
            where: { id },
            data: {
              status: 'APPEAL_PENDING_SUPER_ADMIN',
              appealHrReviewedAt: new Date(),
              appealHrReviewedById: currentEmployeeId,
              appealHrNotes: notes ?? null,
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

          // Notify Super Admins
          const superAdmins = await getSuperAdminEmployees()
          for (const admin of superAdmins) {
            await prisma.notification.create({
              data: {
                type: 'APPEAL_PENDING_ADMIN',
                title: 'Appeal Pending Final Decision',
                message: `An appeal from ${updated.employee.firstName} ${updated.employee.lastName} has been reviewed by HR and needs your final decision.`,
                link: `/performance/disciplinary/${id}`,
                employeeId: admin.id,
                relatedId: id,
                relatedType: 'DISCIPLINARY',
              },
            })
          }

          await writeAuditLog({
            actorId: currentEmployeeId,
            action: 'SUBMIT',
            entityType: 'DISCIPLINARY_ACTION',
            entityId: updated.id,
            summary: `Forwarded appeal to Super Admin (${updated.employee.firstName} ${updated.employee.lastName})`,
            metadata: {
              stage: 'HR_REVIEW',
              newStatus: updated.status,
            },
            req,
          })

          return NextResponse.json({
            ...updated,
            message: 'Appeal forwarded to Super Admin for final decision',
          })
        } else {
          // HR rejects appeal outright (rare case)
          return NextResponse.json(
            { error: 'HR must forward appeals to Super Admin for final decision' },
            { status: 400 }
          )
        }
      }

      // Super Admin Decision stage: Final decision
      if ((body.superAdminDecision || body.appealStatus) && isSuperAdminStage) {
        const superAdminPermission = await canFinalApprove(currentEmployeeId)
        if (!superAdminPermission.allowed) {
          return NextResponse.json(
            { error: `Permission denied: ${superAdminPermission.reason}` },
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
            appealSuperAdminDecidedAt: new Date(),
            appealSuperAdminDecidedById: currentEmployeeId,
            appealSuperAdminNotes: appealResolution,
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

        // Notify employee of appeal decision
        await prisma.notification.create({
          data: {
            type: 'APPEAL_DECIDED',
            title: `Appeal ${appealStatus.charAt(0) + appealStatus.slice(1).toLowerCase()}`,
            message: `Your appeal has been ${appealStatus.toLowerCase()}. ${appealResolution ?? ''}`,
            link: `/performance/disciplinary/${id}`,
            employeeId: action.employeeId,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })

        // Also notify HR
        const hrEmployees = await getHREmployees()
        for (const hr of hrEmployees) {
          await prisma.notification.create({
            data: {
              type: 'APPEAL_DECIDED',
              title: 'Appeal Decision Made',
              message: `Super Admin has ${appealStatus.toLowerCase()} the appeal for ${updated.employee.firstName} ${updated.employee.lastName}.`,
              link: `/performance/disciplinary/${id}`,
              employeeId: hr.id,
              relatedId: id,
              relatedType: 'DISCIPLINARY',
            },
          })
        }

        await writeAuditLog({
          actorId: currentEmployeeId,
          action: 'APPROVE',
          entityType: 'DISCIPLINARY_ACTION',
          entityId: updated.id,
          summary: `Appeal decided (${appealStatus})`,
          metadata: {
            appealStatus,
            newStatus: updated.status,
          },
          req,
        })

        return NextResponse.json({
          ...updated,
          message: `Appeal ${appealStatus.toLowerCase()} by Super Admin`,
        })
      }

      // Legacy resolution for old status (backwards compatibility)
      if (body.appealStatus && action.status === 'APPEALED') {
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

      // Notify HR about the appeal
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'APPEAL_PENDING_HR',
            title: 'Appeal Submitted - Review Required',
            message: `${updated.employee.firstName} ${updated.employee.lastName} has submitted an appeal for a violation. Please review.`,
            link: `/performance/disciplinary/${id}`,
            employeeId: hr.id,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

      await writeAuditLog({
        actorId: currentEmployeeId,
        action: 'SUBMIT',
        entityType: 'DISCIPLINARY_ACTION',
        entityId: updated.id,
        summary: 'Submitted appeal',
        metadata: {
          newStatus: updated.status,
        },
        req,
      })

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

    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })
    const canResolve = currentEmployee?.isSuperAdmin ||
                      (currentEmployee?.permissionLevel ?? 0) >= 50 ||
                      isManager

    // Employee can appeal if they haven't acknowledged AND haven't already appealed
    const canAppeal = isEmployee &&
      action.status === 'PENDING_ACKNOWLEDGMENT' &&
      !action.employeeAcknowledged &&
      !action.appealedAt

    const hrPermission = await canHRReview(currentEmployeeId)
    const superAdminPermission = await canFinalApprove(currentEmployeeId)

    const canReviewAsHR = Boolean(action.appealedAt) &&
      action.status === 'APPEAL_PENDING_HR' &&
      hrPermission.allowed

    const canDecideAsSuperAdmin = Boolean(action.appealedAt) &&
      action.status === 'APPEAL_PENDING_SUPER_ADMIN' &&
      superAdminPermission.allowed

    const canResolveLegacy = Boolean(action.appealedAt) &&
      action.status === 'APPEALED' &&
      canResolve &&
      !action.appealResolvedAt

    const canResolveAppeal = canReviewAsHR || canDecideAsSuperAdmin || canResolveLegacy

    return NextResponse.json({
      appealReason: action.appealReason,
      appealedAt: action.appealedAt,
      appealStatus: action.appealStatus,
      appealResolution: action.appealResolution,
      appealResolvedAt: action.appealResolvedAt,
      canAppeal,
      canResolveAppeal,
      canReviewAsHR,
      canDecideAsSuperAdmin,
      hasAppealed: Boolean(action.appealedAt),
      appealResolved: Boolean(action.appealResolvedAt),
      status: action.status,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get appeal status')
  }
}
