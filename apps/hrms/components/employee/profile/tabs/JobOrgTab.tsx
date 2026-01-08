'use client'

import type { Employee } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'
import { FieldRow } from '../FieldRow'
import { formatDate } from '../utils'

export function EmployeeJobOrgTab({ employee }: { employee: Employee }) {
  return (
    <Card padding="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldRow label="Department" value={employee.department || '—'} />
        <FieldRow label="Role / Title" value={employee.position} />
        <FieldRow
          label="Employment Type"
          value={
            EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ||
            employee.employmentType
          }
        />
        <FieldRow label="Join Date" value={formatDate(employee.joinDate)} />
        <FieldRow label="Status" value={employee.status} />
        <FieldRow
          label="Manager"
          value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}
        />
      </div>
    </Card>
  )
}

