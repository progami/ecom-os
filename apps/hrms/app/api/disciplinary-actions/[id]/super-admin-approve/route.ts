import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canFinalApprove, getHREmployees } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Super Admin approval endpoint for disciplinary actions
 * Workflow: Manager raises -> HR reviews -> Super Admin approves (FINAL)
 */
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

    // Check if current user is Super Admin
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = await canFinalApprove(currentEmployeeId)
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
            email: true,
            reportsToId: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Disciplinary action not found' }, { status: 404 })
    }

    // Verify action is in correct state for Super Admin approval
    if (action.status !== 'PENDING_SUPER_ADMIN') {
      return NextResponse.json(
        { error: `Cannot approve: action is in ${action.status} status, expected PENDING_SUPER_ADMIN` },
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
              email: true,
            },
          },
        },
      })

      const recordLink = updated.caseId ? `/cases/${updated.caseId}` : `/performance/disciplinary/${id}`

      // Notify the employee about the violation
      await prisma.notification.create({
        data: {
          type: 'VIOLATION_APPROVED',
          title: 'Violation Record - Acknowledgment Required',
          message: `A violation has been recorded against you. Please acknowledge this record.`,
          link: recordLink,
          employeeId: action.employee.id,
          relatedId: id,
          relatedType: 'DISCIPLINARY',
        },
      })

      // Notify manager to acknowledge as well
      if (action.employee.reportsToId) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_APPROVED',
            title: 'Team Member Violation - Acknowledgment Required',
            message: `A violation for ${updated.employee.firstName} ${updated.employee.lastName} has been approved. Please acknowledge.`,
            link: recordLink,
            employeeId: action.employee.reportsToId,
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
        summary: `Super Admin approved violation for ${updated.employee.firstName} ${updated.employee.lastName}`,
        metadata: {
          notes: Boolean(notes),
          newStatus: updated.status,
        },
        req,
      })

      return NextResponse.json({
        success: true,
        message: 'Violation approved by Super Admin, sent for acknowledgment',
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

      const recordLink = updated.caseId ? `/cases/${updated.caseId}` : `/performance/disciplinary/${id}`

      // Notify HR about rejection
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_REJECTED',
            title: 'Violation Rejected by Super Admin',
            message: `The violation for ${updated.employee.firstName} ${updated.employee.lastName} has been rejected by Super Admin.`,
            link: recordLink,
            employeeId: hr.id,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

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

      await writeAuditLog({
        actorId: currentEmployeeId,
        action: 'REJECT',
        entityType: 'DISCIPLINARY_ACTION',
        entityId: updated.id,
        summary: `Super Admin rejected violation for ${updated.employee.firstName} ${updated.employee.lastName}`,
        metadata: {
          notes: Boolean(notes),
          newStatus: updated.status,
        },
        req,
      })

      return NextResponse.json({
        success: true,
        message: 'Violation rejected by Super Admin',
        action: updated,
      })
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process Super Admin approval')
  }
}

/**
 * GET - Get Super Admin approval status for a disciplinary action
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
        superAdminApprovedAt: true,
        superAdminApprovedById: true,
        superAdminNotes: true,
        superAdminApproved: true,
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Disciplinary action not found' }, { status: 404 })
    }

    const permissionCheck = await canFinalApprove(currentEmployeeId)

    return NextResponse.json({
      canApprove: action.status === 'PENDING_SUPER_ADMIN' && permissionCheck.allowed,
      superAdminApproval: {
        approvedAt: action.superAdminApprovedAt,
        approvedById: action.superAdminApprovedById,
        notes: action.superAdminNotes,
        approved: action.superAdminApproved,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get Super Admin approval status')
  }
}
