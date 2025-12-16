import { prisma } from './prisma'
import { NotificationType } from '@ecom-os/prisma-hrms'
import { sendNotificationEmail } from './email-service'

// ============ PUB/SUB EVENT SYSTEM ============

export type HRMSEventType =
  | 'POLICY_CREATED'
  | 'POLICY_UPDATED'
  | 'POLICY_ARCHIVED'
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_ACKNOWLEDGED'
  | 'DISCIPLINARY_CREATED'
  | 'DISCIPLINARY_UPDATED'
  | 'HIERARCHY_CHANGED'
  | 'STANDING_CHANGED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'

export type HRMSEvent =
  | { type: 'POLICY_CREATED'; policyId: string; policyTitle: string }
  | { type: 'POLICY_UPDATED'; policyId: string; policyTitle: string }
  | { type: 'POLICY_ARCHIVED'; policyId: string; policyTitle: string }
  | { type: 'REVIEW_SUBMITTED'; reviewId: string; employeeId: string; reviewerName: string }
  | { type: 'REVIEW_ACKNOWLEDGED'; reviewId: string; employeeId: string }
  | { type: 'DISCIPLINARY_CREATED'; actionId: string; employeeId: string; severity: string }
  | { type: 'DISCIPLINARY_UPDATED'; actionId: string; employeeId: string; status: string }
  | { type: 'HIERARCHY_CHANGED'; employeeId: string; oldManagerId: string | null; newManagerId: string | null }
  | { type: 'STANDING_CHANGED'; employeeId: string; oldStanding: string; newStanding: string }
  | { type: 'EMPLOYEE_CREATED'; employeeId: string; employeeName: string }
  | { type: 'EMPLOYEE_UPDATED'; employeeId: string }

type EventHandler = (event: HRMSEvent) => Promise<void>

// In-memory subscribers (for serverless, this resets per request but handlers are re-registered)
const subscribers = new Map<HRMSEventType, EventHandler[]>()

/**
 * Subscribe to an event type
 */
export function subscribe(type: HRMSEventType, handler: EventHandler): void {
  const handlers = subscribers.get(type) || []
  handlers.push(handler)
  subscribers.set(type, handlers)
}

/**
 * Publish an event to all subscribers
 */
export async function publish(event: HRMSEvent): Promise<void> {
  const handlers = subscribers.get(event.type) || []
  await Promise.all(handlers.map(handler => handler(event)))

  // Also create in-app notification based on event type
  await createNotificationFromEvent(event)
}

/**
 * Create in-app notification from event
 * Note: Email notifications just tell users to check the app, not raw content
 */
async function createNotificationFromEvent(event: HRMSEvent): Promise<void> {
  switch (event.type) {
    case 'POLICY_CREATED':
    case 'POLICY_UPDATED':
    case 'POLICY_ARCHIVED': {
      // Broadcast to all employees
      await prisma.notification.create({
        data: {
          type: event.type as NotificationType,
          title: event.type === 'POLICY_CREATED' ? 'New Policy Published' :
                 event.type === 'POLICY_UPDATED' ? 'Policy Updated' : 'Policy Archived',
          message: `The policy "${event.policyTitle}" has been ${event.type === 'POLICY_CREATED' ? 'published' : event.type === 'POLICY_UPDATED' ? 'updated' : 'archived'}.`,
          link: `/policies/${event.policyId}`,
          employeeId: null, // Broadcast
          relatedId: event.policyId,
          relatedType: 'POLICY',
        },
      })
      break
    }

    case 'REVIEW_SUBMITTED': {
      // Notify the employee being reviewed
      await prisma.notification.create({
        data: {
          type: 'REVIEW_SUBMITTED' as NotificationType,
          title: 'Performance Review Submitted',
          message: `A performance review has been submitted for you by ${event.reviewerName}.`,
          link: `/performance/reviews/${event.reviewId}`,
          employeeId: event.employeeId,
          relatedId: event.reviewId,
          relatedType: 'REVIEW',
        },
      })
      break
    }

    case 'DISCIPLINARY_CREATED': {
      // Notify the employee and their manager
      const employee = await prisma.employee.findUnique({
        where: { id: event.employeeId },
        select: { reportsToId: true, email: true, firstName: true }
      })

      await prisma.notification.create({
        data: {
          type: 'DISCIPLINARY_CREATED' as NotificationType,
          title: 'Violation Recorded - Acknowledgment Required',
          message: `A ${event.severity.toLowerCase()} violation has been recorded. Please acknowledge this record.`,
          link: `/performance/disciplinary/${event.actionId}`,
          employeeId: event.employeeId,
          relatedId: event.actionId,
          relatedType: 'DISCIPLINARY',
        },
      })

      // Send email to employee
      if (employee?.email) {
        await sendNotificationEmail(
          employee.email,
          employee.firstName,
          'VIOLATION_RECORDED',
          `/performance/disciplinary/${event.actionId}`
        )
      }

      // Also notify manager if exists
      if (employee?.reportsToId) {
        const manager = await prisma.employee.findUnique({
          where: { id: employee.reportsToId },
          select: { email: true, firstName: true }
        })

        await prisma.notification.create({
          data: {
            type: 'DISCIPLINARY_CREATED' as NotificationType,
            title: 'Team Member Violation - Acknowledgment Required',
            message: `A violation has been recorded for a team member. Please review and acknowledge.`,
            link: `/performance/disciplinary/${event.actionId}`,
            employeeId: employee.reportsToId,
            relatedId: event.actionId,
            relatedType: 'DISCIPLINARY',
          },
        })

        // Send email to manager
        if (manager?.email) {
          await sendNotificationEmail(
            manager.email,
            manager.firstName,
            'VIOLATION_ACKNOWLEDGE_REQUIRED',
            `/performance/disciplinary/${event.actionId}`
          )
        }
      }
      break
    }

    case 'DISCIPLINARY_UPDATED': {
      // Handle appeal notifications
      const employee = await prisma.employee.findUnique({
        where: { id: event.employeeId },
        select: { reportsToId: true, email: true, firstName: true, lastName: true }
      })

      if (event.status === 'APPEALED') {
        // Employee submitted an appeal - notify manager/HR
        if (employee?.reportsToId) {
          await prisma.notification.create({
            data: {
              type: 'DISCIPLINARY_UPDATED' as NotificationType,
              title: 'Violation Appeal Submitted',
              message: `${employee.firstName} ${employee.lastName} has appealed a violation. Please review.`,
              link: `/performance/disciplinary/${event.actionId}`,
              employeeId: employee.reportsToId,
              relatedId: event.actionId,
              relatedType: 'DISCIPLINARY',
            },
          })
        }
      } else if (event.status.startsWith('APPEAL_')) {
        // Appeal was resolved - notify employee
        const resolution = event.status.replace('APPEAL_', '').toLowerCase()
        await prisma.notification.create({
          data: {
            type: 'DISCIPLINARY_UPDATED' as NotificationType,
            title: 'Appeal Decision',
            message: `Your appeal has been ${resolution}. Click to view the decision.`,
            link: `/performance/disciplinary/${event.actionId}`,
            employeeId: event.employeeId,
            relatedId: event.actionId,
            relatedType: 'DISCIPLINARY',
          },
        })
      }
      break
    }

    case 'HIERARCHY_CHANGED': {
      // Notify the employee about their new manager
      const newManager = event.newManagerId ? await prisma.employee.findUnique({
        where: { id: event.newManagerId },
        select: { firstName: true, lastName: true }
      }) : null

      await prisma.notification.create({
        data: {
          type: 'HIERARCHY_CHANGED' as NotificationType,
          title: 'Reporting Structure Changed',
          message: newManager
            ? `You now report to ${newManager.firstName} ${newManager.lastName}.`
            : 'Your reporting structure has been updated.',
          link: `/employees/${event.employeeId}`,
          employeeId: event.employeeId,
          relatedId: event.employeeId,
          relatedType: 'EMPLOYEE',
        },
      })

      // Notify new manager
      if (event.newManagerId) {
        const employee = await prisma.employee.findUnique({
          where: { id: event.employeeId },
          select: { firstName: true, lastName: true }
        })
        if (employee) {
          await prisma.notification.create({
            data: {
              type: 'HIERARCHY_CHANGED' as NotificationType,
              title: 'New Team Member',
              message: `${employee.firstName} ${employee.lastName} now reports to you.`,
              link: `/employees/${event.employeeId}`,
              employeeId: event.newManagerId,
              relatedId: event.employeeId,
              relatedType: 'EMPLOYEE',
            },
          })
        }
      }
      break
    }

    case 'STANDING_CHANGED': {
      // Notify employee and their manager about standing change
      await prisma.notification.create({
        data: {
          type: 'STANDING_CHANGED' as NotificationType,
          title: 'Standing Status Changed',
          message: `Your standing has changed from ${event.oldStanding} to ${event.newStanding}.`,
          link: `/employees/${event.employeeId}`,
          employeeId: event.employeeId,
          relatedId: event.employeeId,
          relatedType: 'STANDING',
        },
      })

      // Notify manager
      const employee = await prisma.employee.findUnique({
        where: { id: event.employeeId },
        select: { reportsToId: true, firstName: true, lastName: true }
      })

      if (employee?.reportsToId) {
        await prisma.notification.create({
          data: {
            type: 'STANDING_CHANGED' as NotificationType,
            title: 'Team Member Standing Changed',
            message: `${employee.firstName} ${employee.lastName}'s standing has changed to ${event.newStanding}.`,
            link: `/employees/${event.employeeId}`,
            employeeId: employee.reportsToId,
            relatedId: event.employeeId,
            relatedType: 'STANDING',
          },
        })
      }
      break
    }

    default:
      // No notification for other events
      break
  }
}

/**
 * Queue email notification (tells user to check the app)
 * This is a stub - implement actual email sending based on your email provider
 */
export async function queueEmailNotification(
  employeeId: string,
  subject: string
): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true }
  })

  if (!employee) return

  // TODO: Integrate with email provider (SendGrid, AWS SES, etc.)
  // The email should NOT contain the raw notification content
  // Just tell the user to check the HRMS portal
  console.log(`[Email Queue] Would send email to ${employee.email}:`)
  console.log(`  Subject: ${subject}`)
  console.log(`  Body: Hi ${employee.firstName}, you have new updates in HRMS. Please log in to view details.`)
}

// ============ PROFILE COMPLETION CHECK ============
// Only includes fields that EMPLOYEES can control themselves
// Manager, Department, Position are set by HR/managers, not the employee

type EmployeeProfileFields = {
  id: string
  firstName: string
  phone: string | null
  dateOfBirth: Date | null
  address: string | null
  city: string | null
  country: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
}

type RequiredField = {
  field: keyof EmployeeProfileFields
  label: string
}

const REQUIRED_FIELDS: RequiredField[] = [
  { field: 'phone', label: 'Phone Number' },
  { field: 'dateOfBirth', label: 'Date of Birth' },
  { field: 'address', label: 'Address' },
  { field: 'city', label: 'City' },
  { field: 'country', label: 'Country' },
  { field: 'emergencyContact', label: 'Emergency Contact Name' },
  { field: 'emergencyPhone', label: 'Emergency Contact Phone' },
]

export function getMissingFields(employee: EmployeeProfileFields): string[] {
  const missing: string[] = []

  for (const { field, label } of REQUIRED_FIELDS) {
    const value = employee[field as keyof EmployeeProfileFields]

    // Check if field is null, undefined, empty string, or whitespace-only
    const isEmpty = value === null ||
                    value === undefined ||
                    (typeof value === 'string' && value.trim() === '')

    if (isEmpty) {
      missing.push(label)
    }
  }

  return missing
}

export async function checkAndNotifyMissingFields(employeeId: string): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      phone: true,
      dateOfBirth: true,
      address: true,
      city: true,
      country: true,
      emergencyContact: true,
      emergencyPhone: true,
    },
  })

  if (!employee) return

  const missingFields = getMissingFields(employee)

  if (missingFields.length > 0) {
    // Check if an unread profile notification already exists
    const existingNotification = await prisma.notification.findFirst({
      where: {
        employeeId: employee.id,
        type: 'PROFILE_INCOMPLETE',
        isRead: false,
      },
    })

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          type: 'PROFILE_INCOMPLETE',
          title: 'Complete Your Profile',
          message: `Please update the following information: ${missingFields.join(', ')}`,
          link: `/employees/${employee.id}/edit`,
          employeeId: employee.id,
        },
      })
    } else {
      // Update the existing notification with current missing fields
      await prisma.notification.update({
        where: { id: existingNotification.id },
        data: {
          message: `Please update the following information: ${missingFields.join(', ')}`,
        },
      })
    }
  } else {
    // Profile is complete - delete any existing profile incomplete notifications
    await prisma.notification.deleteMany({
      where: {
        employeeId: employee.id,
        type: 'PROFILE_INCOMPLETE',
      },
    })
  }
}

export async function runProfileCompletionCheckForAll(): Promise<{ checked: number; notified: number }> {
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })

  let notified = 0

  for (const emp of employees) {
    const employee = await prisma.employee.findUnique({
      where: { id: emp.id },
      select: {
        id: true,
        firstName: true,
        phone: true,
        dateOfBirth: true,
        address: true,
        city: true,
        country: true,
        emergencyContact: true,
        emergencyPhone: true,
      },
    })

    if (employee) {
      const missingFields = getMissingFields(employee)
      if (missingFields.length > 0) {
        await checkAndNotifyMissingFields(emp.id)
        notified++
      }
    }
  }

  console.log(`[Profile Check] Checked ${employees.length} employees, ${notified} need to complete profile`)

  return { checked: employees.length, notified }
}
