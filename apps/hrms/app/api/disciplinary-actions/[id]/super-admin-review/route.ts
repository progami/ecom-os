import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse, validateBody } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'
import { z } from 'zod'

/**
 * Super Admin Review endpoint for disciplinary actions
 * 3-tier workflow: Manager raises -> HR reviews -> Super Admin approves -> Employee acknowledges
 */
type RouteContext = { params: Promise<{ id: string }> }

const SuperAdminReviewBodySchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    const body = await req.json()
    const validation = validateBody(SuperAdminReviewBodySchema, body)
    if (!validation.success) return validation.error

    const { approved, notes } = validation.data

    // Check if current user is Super Admin
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isSuperAdmin(currentEmployeeId)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Permission denied: Only Super Admin can give final approval' },
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

    // Verify action is in correct state for Super Admin review
    if (action.status !== 'PENDING_SUPER_ADMIN') {
      return NextResponse.json(
        { error: `Cannot review: action is in ${action.status} status, expected PENDING_SUPER_ADMIN` },
        { status: 400 }
      )
    }

    if (approved) {
      // Super Admin approves - move to PENDING_ACKNOWLEDGMENT
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          status: 'PENDING_ACKNOWLEDGMENT',
          superAdminApprovedAt: new Date(),
          superAdminApprovedById: currentEmployeeId,
          superAdminNotes: notes ?? null,
          superAdminApproved: true,
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

      // Notify employee to acknowledge
      await prisma.notification.create({
        data: {
          type: 'VIOLATION_APPROVED',
          title: 'Violation Requires Acknowledgment',
          message: `A violation record has been issued to you. Please review and acknowledge.`,
          link: recordLink,
          employeeId: updated.employee.id,
          relatedId: id,
          relatedType: 'DISCIPLINARY',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Violation approved by Super Admin, sent to employee for acknowledgment',
        action: updated,
      })
    } else {
      // Super Admin rejects - move to DISMISSED
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          status: 'DISMISSED',
          superAdminApprovedAt: new Date(),
          superAdminApprovedById: currentEmployeeId,
          superAdminNotes: notes ?? null,
          superAdminApproved: false,
          resolution: notes ?? 'Rejected by Super Admin',
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

      // Notify the manager who raised it
      if (action.employee.reportsToId) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_REJECTED',
            title: 'Violation Rejected by Super Admin',
            message: `The violation you raised for ${updated.employee.firstName} ${updated.employee.lastName} has been rejected by Super Admin.`,
            link: recordLink,
            employeeId: action.employee.reportsToId,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

      // Notify HR who approved it
      if (action.hrReviewedById) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_REJECTED',
            title: 'Violation Rejected by Super Admin',
            message: `The violation for ${updated.employee.firstName} ${updated.employee.lastName} that you approved has been rejected by Super Admin.`,
            link: recordLink,
            employeeId: action.hrReviewedById,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Violation rejected by Super Admin',
        action: updated,
      })
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process Super Admin review')
  }
}

/**
 * GET - Get Super Admin review status for a disciplinary action
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

    const isAdmin = await isSuperAdmin(currentEmployeeId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const action = await prisma.disciplinaryAction.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        superAdminApprovedAt: true,
        superAdminApprovedById: true,
        superAdminNotes: true,
        superAdminApproved: true,
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Disciplinary action not found' }, { status: 404 })
    }

    return NextResponse.json({
      canReview: action.status === 'PENDING_SUPER_ADMIN',
      superAdminReview: {
        approvedAt: action.superAdminApprovedAt,
        approvedById: action.superAdminApprovedById,
        notes: action.superAdminNotes,
        approved: action.superAdminApproved,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get Super Admin review status')
  }
}
