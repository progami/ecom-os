'use client'

import type { Employee } from '@/lib/api-client'
import {
  BuildingIcon,
  CalendarIcon,
  EnvelopeIcon,
  PhoneIcon,
  UsersIcon,
} from '@/components/ui/Icons'
import { Card } from '@/components/ui/card'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'
import { InfoRow } from '../InfoRow'
import { formatDate } from '../utils'

export function EmployeeOverviewTab({ employee }: { employee: Employee }) {
  return (
    <Card padding="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <InfoRow icon={EnvelopeIcon} label="Email" value={employee.email} href={`mailto:${employee.email}`} />
        <InfoRow
          icon={PhoneIcon}
          label="Phone"
          value={employee.phone || '—'}
          href={employee.phone ? `tel:${employee.phone}` : undefined}
        />
        <InfoRow icon={BuildingIcon} label="Department" value={employee.department || '—'} />
        <InfoRow
          icon={UsersIcon}
          label="Employment type"
          value={
            EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ||
            employee.employmentType
          }
        />
        <InfoRow icon={CalendarIcon} label="Join date" value={formatDate(employee.joinDate)} />
        <InfoRow icon={UsersIcon} label="Employee ID" value={employee.employeeId} />
      </div>
    </Card>
  )
}

