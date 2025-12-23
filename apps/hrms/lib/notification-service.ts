import { prisma } from './prisma'

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
