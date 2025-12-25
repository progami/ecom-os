import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canHRReview, getSuperAdminEmployees } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

/**
 * HR Review endpoint for disciplinary actions
 * Workflow: Manager raises -> HR reviews -> Super Admin approves
 */
type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    const body = await req.json()
    const { approved, notes } = body

    if (typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'approved field is required (boolean)' },
        { status: 400 }
      )
    }

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
      // HR approves - move to PENDING_SUPER_ADMIN
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

      const recordLink = updated.caseId ? `/cases/${updated.caseId}` : `/performance/disciplinary/${id}`

      // Notify Super Admins
      const superAdmins = await getSuperAdminEmployees()
      for (const admin of superAdmins) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_PENDING_ADMIN',
            title: 'Violation Pending Final Approval',
            message: `A violation for ${updated.employee.firstName} ${updated.employee.lastName} has been reviewed by HR and needs your final approval.`,
            link: recordLink,
            employeeId: admin.id,
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
        summary: `HR approved violation for ${updated.employee.firstName} ${updated.employee.lastName}`,
        metadata: {
          hrNotes: Boolean(notes),
          newStatus: updated.status,
        },
        req,
      })

      return NextResponse.json({
        success: true,
        message: 'Violation approved by HR, sent to Super Admin for final approval',
        action: updated,
      })
    } else {
      // HR rejects - move to DISMISSED
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          status: 'DISMISSED',
          hrReviewedAt: new Date(),
          hrReviewedById: currentEmployeeId,
          hrReviewNotes: notes ?? null,
          hrApproved: false,
          resolution: notes ?? 'Rejected by HR',
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

      const recordLink = updated.caseId ? `/cases/${updated.caseId}` : `/performance/disciplinary/${id}`

      // Notify the manager who raised it (reportedBy field contains their name, but we need to find by reportsToId)
      if (action.employee.reportsToId) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_REJECTED',
            title: 'Violation Rejected by HR',
            message: `The violation you raised for ${updated.employee.firstName} ${updated.employee.lastName} has been rejected by HR.`,
            link: recordLink,
            employeeId: action.employee.reportsToId,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

      await writeAuditLog({
        actorId: currentEmployeeId,
        action: 'REJECT',
        entityType: 'DISCIPLINARY_ACTION',
        entityId: updated.id,
        summary: `HR rejected violation for ${updated.employee.firstName} ${updated.employee.lastName}`,
        metadata: {
          hrNotes: Boolean(notes),
          newStatus: updated.status,
        },
        req,
      })

      return NextResponse.json({
        success: true,
        message: 'Violation rejected by HR',
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

    return NextResponse.json({
      canReview: action.status === 'PENDING_HR_REVIEW' && permissionCheck.allowed,
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
