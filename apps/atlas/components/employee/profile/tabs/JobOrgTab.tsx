'use client'

import type { Employee } from '@/lib/api-client'
import {
  BuildingIcon,
  BriefcaseIcon,
  CalendarIcon,
  UserCircleIcon,
  CheckCircleIcon,
  HashtagIcon,
} from '@/components/ui/Icons'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'
import { formatDate } from '../utils'

function DetailItem({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="h-9 w-9 rounded-lg bg-card flex items-center justify-center flex-shrink-0 ring-1 ring-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function EmployeeJobOrgTab({ employee }: { employee: Employee }) {
  const employmentTypeLabel =
    EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ||
    employee.employmentType

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DetailItem
          icon={BuildingIcon}
          label="Department"
          value={employee.department ?? 'Not assigned'}
        />
        <DetailItem
          icon={BriefcaseIcon}
          label="Position"
          value={employee.position}
        />
        <DetailItem
          icon={BriefcaseIcon}
          label="Employment Type"
          value={employmentTypeLabel}
        />
        <DetailItem
          icon={CalendarIcon}
          label="Join Date"
          value={formatDate(employee.joinDate)}
        />
        <DetailItem
          icon={HashtagIcon}
          label="Employee ID"
          value={employee.employeeId}
        />
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ${employee.status === 'ACTIVE' ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
            <CheckCircleIcon className={`h-4 w-4 ${employee.status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Status</p>
            <p className="text-sm font-medium text-foreground">{employee.status}</p>
          </div>
        </div>
      </div>

      {/* Manager Section */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <div className="h-9 w-9 rounded-lg bg-card flex items-center justify-center flex-shrink-0 ring-1 ring-border">
            <UserCircleIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Reports To</p>
            {employee.manager ? (
              <p className="text-sm font-medium text-foreground">
                {employee.manager.firstName} {employee.manager.lastName}
                <span className="text-muted-foreground font-normal"> &middot; {employee.manager.position}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No manager assigned</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
