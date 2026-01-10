import type { LeaveRequest } from '@ecom-os/prisma-atlas'
import prisma from '@/lib/prisma'
import { getHREmployees, getSuperAdminEmployees, isHR, isHROrAbove, isManagerOf, isSuperAdmin } from '@/lib/permissions'

type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string }

export type LeaveApprovalInput = {
  leaveId: string
  actorId: string
  approved: boolean
  notes?: string | null
}

function formatLeaveType(leaveType: string): string {
  return leaveType.replaceAll('_', ' ')
}

function formatDate(value: Date): string {
  return value.toLocaleDateString()
}

export async function processManagerLeaveApproval(input: LeaveApprovalInput): Promise<Result<LeaveRequest>> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: input.leaveId },
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

  if (!leaveRequest) return { ok: false, status: 404, message: 'Not found' }

  if (leaveRequest.status !== 'PENDING_MANAGER' && leaveRequest.status !== 'PENDING') {
    return { ok: false, status: 400, message: 'Leave request is not pending manager approval' }
  }

  const isManager = await isManagerOf(input.actorId, leaveRequest.employeeId)
  const isHrOrAbove = await isHROrAbove(input.actorId)

  if (!isManager && !isHrOrAbove) {
    return { ok: false, status: 403, message: "Only the employee's manager or HR can approve at this stage" }
  }

  const startDateStr = formatDate(leaveRequest.startDate)
  const endDateStr = formatDate(leaveRequest.endDate)
  const leaveTypeLabel = formatLeaveType(leaveRequest.leaveType)
  const employeeName = `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`.trim()

  if (input.approved) {
    const hrEmployees = await getHREmployees()

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.leaveRequest.update({
        where: { id: input.leaveId },
        data: {
          status: 'PENDING_HR',
          managerApprovedById: input.actorId,
          managerApprovedAt: new Date(),
          managerNotes: input.notes ?? undefined,
        },
      })

      await Promise.all(
        hrEmployees.map((hr) =>
          tx.notification.create({
            data: {
              type: 'LEAVE_PENDING_HR',
              title: 'Leave Request Pending HR Approval',
              message: `${employeeName}'s ${leaveTypeLabel} leave request (${startDateStr} - ${endDateStr}) has been approved by manager and needs HR approval.`,
              link: `/leaves/${input.leaveId}`,
              employeeId: hr.id,
              relatedId: input.leaveId,
              relatedType: 'LEAVE',
            },
          })
        )
      )

      return next
    })

    return { ok: true, data: updated }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.leaveRequest.update({
      where: { id: input.leaveId },
      data: {
        status: 'REJECTED',
        managerApprovedById: input.actorId,
        managerApprovedAt: new Date(),
        managerNotes: input.notes ?? undefined,
        reviewedById: input.actorId,
        reviewedAt: new Date(),
        reviewNotes: input.notes ?? undefined,
      },
    })

    const year = new Date(leaveRequest.startDate).getFullYear()
    await tx.leaveBalance.updateMany({
      where: {
        employeeId: leaveRequest.employeeId,
        leaveType: leaveRequest.leaveType,
        year,
      },
      data: {
        pending: { decrement: Math.ceil(leaveRequest.totalDays) },
      },
    })

    await tx.notification.create({
      data: {
        type: 'LEAVE_REJECTED',
        title: 'Leave Request Rejected',
        message: `Your ${leaveTypeLabel} leave request (${startDateStr} - ${endDateStr}) has been rejected by your manager.${input.notes?.trim() ? ` Reason: ${input.notes.trim()}` : ''}`,
        link: `/leaves/${input.leaveId}`,
        employeeId: leaveRequest.employeeId,
        relatedId: input.leaveId,
        relatedType: 'LEAVE',
      },
    })

    return next
  })

  return { ok: true, data: updated }
}

export async function processHrLeaveApproval(input: LeaveApprovalInput): Promise<Result<LeaveRequest>> {
  const hrAllowed = await isHR(input.actorId)
  if (!hrAllowed) return { ok: false, status: 403, message: 'Only HR can approve at this stage' }

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: input.leaveId },
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

  if (!leaveRequest) return { ok: false, status: 404, message: 'Not found' }

  if (leaveRequest.status !== 'PENDING_HR') {
    return { ok: false, status: 400, message: 'Leave request is not pending HR approval' }
  }

  const startDateStr = formatDate(leaveRequest.startDate)
  const endDateStr = formatDate(leaveRequest.endDate)
  const leaveTypeLabel = formatLeaveType(leaveRequest.leaveType)
  const employeeName = `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`.trim()

  if (input.approved) {
    const superAdmins = await getSuperAdminEmployees()

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.leaveRequest.update({
        where: { id: input.leaveId },
        data: {
          status: 'PENDING_SUPER_ADMIN',
          hrApprovedById: input.actorId,
          hrApprovedAt: new Date(),
          hrNotes: input.notes ?? undefined,
        },
      })

      await Promise.all(
        superAdmins.map((admin) =>
          tx.notification.create({
            data: {
              type: 'LEAVE_PENDING_SUPER_ADMIN',
              title: 'Leave Request Pending Final Approval',
              message: `${employeeName}'s ${leaveTypeLabel} leave request (${startDateStr} - ${endDateStr}) has been approved by HR and needs your final approval.`,
              link: `/leaves/${input.leaveId}`,
              employeeId: admin.id,
              relatedId: input.leaveId,
              relatedType: 'LEAVE',
            },
          })
        )
      )

      return next
    })

    return { ok: true, data: updated }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.leaveRequest.update({
      where: { id: input.leaveId },
      data: {
        status: 'REJECTED',
        hrApprovedById: input.actorId,
        hrApprovedAt: new Date(),
        hrNotes: input.notes ?? undefined,
        reviewedById: input.actorId,
        reviewedAt: new Date(),
        reviewNotes: input.notes ?? undefined,
      },
    })

    const year = new Date(leaveRequest.startDate).getFullYear()
    await tx.leaveBalance.updateMany({
      where: {
        employeeId: leaveRequest.employeeId,
        leaveType: leaveRequest.leaveType,
        year,
      },
      data: {
        pending: { decrement: Math.ceil(leaveRequest.totalDays) },
      },
    })

    await tx.notification.create({
      data: {
        type: 'LEAVE_REJECTED',
        title: 'Leave Request Rejected',
        message: `Your ${leaveTypeLabel} leave request (${startDateStr} - ${endDateStr}) has been rejected by HR.${input.notes?.trim() ? ` Reason: ${input.notes.trim()}` : ''}`,
        link: `/leaves/${input.leaveId}`,
        employeeId: leaveRequest.employeeId,
        relatedId: input.leaveId,
        relatedType: 'LEAVE',
      },
    })

    return next
  })

  return { ok: true, data: updated }
}

export async function processSuperAdminLeaveApproval(input: LeaveApprovalInput): Promise<Result<LeaveRequest>> {
  const isAdmin = await isSuperAdmin(input.actorId)
  if (!isAdmin) return { ok: false, status: 403, message: 'Only Super Admin can give final approval' }

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: input.leaveId },
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

  if (!leaveRequest) return { ok: false, status: 404, message: 'Not found' }

  if (leaveRequest.status !== 'PENDING_SUPER_ADMIN') {
    return { ok: false, status: 400, message: 'Leave request is not pending Super Admin approval' }
  }

  const startDateStr = formatDate(leaveRequest.startDate)
  const endDateStr = formatDate(leaveRequest.endDate)
  const leaveTypeLabel = formatLeaveType(leaveRequest.leaveType)

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.leaveRequest.update({
      where: { id: input.leaveId },
      data: {
        status: input.approved ? 'APPROVED' : 'REJECTED',
        superAdminApprovedById: input.actorId,
        superAdminApprovedAt: new Date(),
        superAdminNotes: input.notes ?? undefined,
        reviewedById: input.actorId,
        reviewedAt: new Date(),
        reviewNotes: input.notes ?? undefined,
      },
    })

    const year = new Date(leaveRequest.startDate).getFullYear()
    if (input.approved) {
      await tx.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveType: leaveRequest.leaveType,
          year,
        },
        data: {
          pending: { decrement: Math.ceil(leaveRequest.totalDays) },
          used: { increment: Math.ceil(leaveRequest.totalDays) },
        },
      })
    } else {
      await tx.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveType: leaveRequest.leaveType,
          year,
        },
        data: {
          pending: { decrement: Math.ceil(leaveRequest.totalDays) },
        },
      })
    }

    if (input.approved) {
      await tx.notification.create({
        data: {
          type: 'LEAVE_APPROVED',
          title: 'Leave Request Approved',
          message: `Your ${leaveTypeLabel} leave request (${startDateStr} - ${endDateStr}) has been fully approved.`,
          link: `/leaves/${input.leaveId}`,
          employeeId: leaveRequest.employeeId,
          relatedId: input.leaveId,
          relatedType: 'LEAVE',
        },
      })

      if (leaveRequest.employee.reportsToId) {
        await tx.notification.create({
          data: {
            type: 'LEAVE_APPROVED',
            title: 'Leave Request Approved',
            message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}'s ${leaveTypeLabel} leave request (${startDateStr} - ${endDateStr}) has been approved.`,
            link: `/leaves/${input.leaveId}`,
            employeeId: leaveRequest.employee.reportsToId,
            relatedId: input.leaveId,
            relatedType: 'LEAVE',
          },
        })
      }
    } else {
      await tx.notification.create({
        data: {
          type: 'LEAVE_REJECTED',
          title: 'Leave Request Rejected',
          message: `Your ${leaveTypeLabel} leave request (${startDateStr} - ${endDateStr}) has been rejected by Super Admin.${input.notes?.trim() ? ` Reason: ${input.notes.trim()}` : ''}`,
          link: `/leaves/${input.leaveId}`,
          employeeId: leaveRequest.employeeId,
          relatedId: input.leaveId,
          relatedType: 'LEAVE',
        },
      })
    }

    return next
  })

  return { ok: true, data: updated }
}

export type LeaveApprovalStage = 'MANAGER' | 'HR' | 'SUPER_ADMIN'

export type LeaveApprovalContextSnapshot = {
  status: LeaveRequest['status']
  permissions?: {
    canManagerApprove?: boolean
    canHRApprove?: boolean
    canSuperAdminApprove?: boolean
  } | null
}

export function getLeaveApprovalStage(leave: LeaveApprovalContextSnapshot): LeaveApprovalStage | null {
  if (leave.permissions?.canManagerApprove) return 'MANAGER'
  if (leave.permissions?.canHRApprove) return 'HR'
  if (leave.permissions?.canSuperAdminApprove) return 'SUPER_ADMIN'

  if (leave.status === 'PENDING' || leave.status === 'PENDING_MANAGER') return 'MANAGER'
  if (leave.status === 'PENDING_HR') return 'HR'
  if (leave.status === 'PENDING_SUPER_ADMIN') return 'SUPER_ADMIN'

  return null
}
