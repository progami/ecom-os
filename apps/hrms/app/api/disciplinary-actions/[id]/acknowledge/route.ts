import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getHREmployees, isManagerOf } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/disciplinary-actions/[id]/acknowledge
 *
 * Acknowledge a disciplinary action.
 * - If current user is the employee: marks employeeAcknowledged
 * - If current user is the employee's manager: marks managerAcknowledged
 */
export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Get current user
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    // Get the disciplinary action with employee info
    const action = await prisma.disciplinaryAction.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            reportsToId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (action.status !== 'PENDING_ACKNOWLEDGMENT') {
      return NextResponse.json(
        { error: `Cannot acknowledge: action is in ${action.status} status, expected PENDING_ACKNOWLEDGMENT` },
        { status: 400 }
      )
    }

    const isEmployee = currentEmployeeId === action.employeeId
    const isManager = currentEmployeeId === action.employee.reportsToId

    // Check if user can acknowledge
    if (!isEmployee && !isManager) {
      // Check if current user is higher up in the chain (can act as manager)
      const currentEmployee = await prisma.employee.findUnique({
        where: { id: currentEmployeeId },
        select: { isSuperAdmin: true },
      })

      // Super admin or manager chain can acknowledge as manager
      const canActAsManager = currentEmployee?.isSuperAdmin || await isManagerOf(currentEmployeeId, action.employeeId)

      if (!canActAsManager) {
        return NextResponse.json(
          { error: 'You can only acknowledge violations for yourself or your direct reports' },
          { status: 403 }
        )
      }

      // Treat as manager acknowledgment
      if (action.managerAcknowledged) {
        return NextResponse.json({ error: 'Already acknowledged by manager' }, { status: 400 })
      }

      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          managerAcknowledged: true,
          managerAcknowledgedAt: new Date(),
          managerAcknowledgerId: currentEmployeeId,
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

      const finalized = updated.employeeAcknowledged && updated.managerAcknowledged
        ? await prisma.disciplinaryAction.update({
            where: { id },
            data: { status: 'ACTIVE' },
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
        : updated

      return NextResponse.json({
        ...finalized,
        acknowledgedAs: 'manager',
        message: finalized.status === 'ACTIVE' ? 'Acknowledged (record now active)' : 'Acknowledged as manager',
      })
    }

    // Handle employee acknowledgment
    if (isEmployee) {
      if (action.employeeAcknowledged) {
        return NextResponse.json({ error: 'Already acknowledged' }, { status: 400 })
      }

      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          employeeAcknowledged: true,
          employeeAcknowledgedAt: new Date(),
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

      const finalized = updated.employeeAcknowledged && updated.managerAcknowledged
        ? await prisma.disciplinaryAction.update({
            where: { id },
            data: { status: 'ACTIVE' },
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
        : updated

      const recordLink = `/performance/disciplinary/${id}`

      // Notify HR and manager that employee acknowledged
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_ACKNOWLEDGED',
            title: 'Violation Acknowledged by Employee',
            message: `${updated.employee.firstName} ${updated.employee.lastName} has acknowledged the violation record.`,
            link: recordLink,
            employeeId: hr.id,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

      // Notify manager
      if (action.employee.reportsToId) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_ACKNOWLEDGED',
            title: 'Violation Acknowledged by Employee',
            message: `${updated.employee.firstName} ${updated.employee.lastName} has acknowledged the violation record.`,
            link: recordLink,
            employeeId: action.employee.reportsToId,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

      return NextResponse.json({
        ...finalized,
        acknowledgedAs: 'employee',
        message: finalized.status === 'ACTIVE' ? 'Acknowledged (record now active)' : 'Acknowledged as employee',
      })
    }

    // Handle manager acknowledgment
    if (isManager) {
      if (action.managerAcknowledged) {
        return NextResponse.json({ error: 'Already acknowledged by manager' }, { status: 400 })
      }

      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          managerAcknowledged: true,
          managerAcknowledgedAt: new Date(),
          managerAcknowledgerId: currentEmployeeId,
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

      const finalized = updated.employeeAcknowledged && updated.managerAcknowledged
        ? await prisma.disciplinaryAction.update({
            where: { id },
            data: { status: 'ACTIVE' },
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
        : updated

      const recordLink = `/performance/disciplinary/${id}`

      // Notify HR that manager acknowledged
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'VIOLATION_ACKNOWLEDGED',
            title: 'Violation Acknowledged by Manager',
            message: `Manager has acknowledged the violation record for ${updated.employee.firstName} ${updated.employee.lastName}.`,
            link: recordLink,
            employeeId: hr.id,
            relatedId: id,
            relatedType: 'DISCIPLINARY',
          },
        })
      }

      return NextResponse.json({
        ...finalized,
        acknowledgedAs: 'manager',
        message: finalized.status === 'ACTIVE' ? 'Acknowledged (record now active)' : 'Acknowledged as manager',
      })
    }

    return NextResponse.json({ error: 'Unable to determine acknowledgment type' }, { status: 400 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to acknowledge disciplinary action')
  }
}

/**
 * GET /api/disciplinary-actions/[id]/acknowledge
 *
 * Get acknowledgment status and check if current user can acknowledge
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
        employeeAcknowledgedAt: true,
        managerAcknowledged: true,
        managerAcknowledgedAt: true,
        managerAcknowledgerId: true,
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

    // Check if current user is higher up
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true },
    })
    const canActAsManager = currentEmployee?.isSuperAdmin || await isManagerOf(currentEmployeeId, action.employeeId)
    const isPendingAck = action.status === 'PENDING_ACKNOWLEDGMENT'

    return NextResponse.json({
      employeeAcknowledged: action.employeeAcknowledged,
      employeeAcknowledgedAt: action.employeeAcknowledgedAt,
      managerAcknowledged: action.managerAcknowledged,
      managerAcknowledgedAt: action.managerAcknowledgedAt,
      canAcknowledgeAsEmployee: isPendingAck && isEmployee && !action.employeeAcknowledged,
      canAcknowledgeAsManager: isPendingAck && (isManager || canActAsManager) && !action.managerAcknowledged,
      fullyAcknowledged: action.employeeAcknowledged && action.managerAcknowledged,
      status: action.status,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get acknowledgment status')
  }
}
