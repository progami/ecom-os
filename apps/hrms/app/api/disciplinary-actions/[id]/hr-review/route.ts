import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse, validateBody } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canHRReview } from '@/lib/permissions'
import { z } from 'zod'

/**
 * HR Review endpoint for disciplinary actions
 * 3-tier workflow: Manager raises -> HR reviews -> Super Admin approves -> Employee acknowledges
 */
type RouteContext = { params: Promise<{ id: string }> }

const HrReviewBodySchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    const body = await req.json()
    const validation = validateBody(HrReviewBodySchema, body)
    if (!validation.success) return validation.error

    const { approved, notes } = validation.data

    // Check if current user is HR
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = await canHRReview(currentEmployeeId)
    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    // Get the disciplinary action
    const action = await prisma.disciplinaryAction.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            reportsToId: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Disciplinary action not found' }, { status: 404 })
    }

    // Verify action is in correct state for HR review
    if (action.status !== 'PENDING_HR_REVIEW') {
      return NextResponse.json(
        { error: `Cannot review: action is in ${action.status} status, expected PENDING_HR_REVIEW` },
        { status: 400 }
      )
    }

    if (approved) {
      // HR approves - move to PENDING_SUPER_ADMIN for final approval
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          status: 'PENDING_SUPER_ADMIN',
          hrReviewedAt: new Date(),
          hrReviewedById: currentEmployeeId,
          hrReviewNotes: notes ?? null,
          hrApproved: true,
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

      const recordLink = `/performance/violations/${id}`

      // Notify Super Admins for final approval
      const superAdmins = await prisma.employee.findMany({
        where: { isSuperAdmin: true, status: 'ACTIVE' },
        select: { id: true },
      })

      await Promise.all(
        superAdmins.map((admin) =>
          prisma.notification.create({
            data: {
              type: 'VIOLATION_PENDING_ADMIN',
              title: 'Violation Pending Final Approval',
              message: `A violation for ${updated.employee.firstName} ${updated.employee.lastName} has been approved by HR and requires your final approval.`,
              link: recordLink,
              employeeId: admin.id,
              relatedId: id,
              relatedType: 'DISCIPLINARY',
            },
          })
        )
      )

      await prisma.auditLog.create({
        data: {
          actorId: currentEmployeeId,
          action: 'APPROVE',
          entityType: 'DISCIPLINARY_ACTION',
          entityId: id,
          summary: 'HR approved violation',
          metadata: {
            fromStatus: action.status,
            toStatus: 'PENDING_SUPER_ADMIN',
            note: notes ?? null,
          },
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Violation approved by HR, sent to Super Admin for final approval',
        action: updated,
      })
    } else {
      // HR requests changes - self-loop on PENDING_HR_REVIEW (do not dismiss)
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          hrReviewedAt: new Date(),
          hrReviewedById: currentEmployeeId,
          hrReviewNotes: notes ?? null,
          hrApproved: false,
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

      const recordLink = `/performance/violations/${id}`

      const targets = new Set<string>()
      if (action.createdById) targets.add(action.createdById)
      if (!targets.size && action.employee.reportsToId) targets.add(action.employee.reportsToId)
      targets.delete(currentEmployeeId)

      await Promise.all(
        Array.from(targets).map((employeeId) =>
          prisma.notification.create({
            data: {
              type: 'VIOLATION_REJECTED',
              title: 'Violation Needs Changes (HR)',
              message: `HR requested changes to the violation for ${updated.employee.firstName} ${updated.employee.lastName}.${notes ? ` Notes: ${notes}` : ''}`,
              link: recordLink,
              employeeId,
              relatedId: id,
              relatedType: 'DISCIPLINARY',
            },
          })
        )
      )

      await prisma.auditLog.create({
        data: {
          actorId: currentEmployeeId,
          action: 'COMMENT',
          entityType: 'DISCIPLINARY_ACTION',
          entityId: id,
          summary: 'HR requested changes',
          metadata: {
            note: notes ?? null,
          },
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Changes requested by HR',
        action: updated,
      })
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process HR review')
  }
}

/**
 * GET - Get HR review status for a disciplinary action
 */
export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const action = await prisma.disciplinaryAction.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        hrReviewedAt: true,
        hrReviewedById: true,
        hrReviewNotes: true,
        hrApproved: true,
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Disciplinary action not found' }, { status: 404 })
    }

    const permissionCheck = await canHRReview(currentEmployeeId)
    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    return NextResponse.json({
      canReview: action.status === 'PENDING_HR_REVIEW',
      hrReview: {
        reviewedAt: action.hrReviewedAt,
        reviewedById: action.hrReviewedById,
        notes: action.hrReviewNotes,
        approved: action.hrApproved,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get HR review status')
  }
}
