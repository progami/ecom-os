'use client'

import type { Employee } from '@/lib/api-client'
import {
  BuildingIcon,
  BriefcaseIcon,
  CalendarIcon,
  UserCircleIcon,
  CheckCircleIcon,
} from '@/components/ui/Icons'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'
import { formatDate } from '../utils'

function InfoItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 transition-all duration-200 hover:bg-muted/50 hover:border-border">
      <div className="flex-shrink-0 mt-0.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${highlight ? 'bg-brand-teal-100 ring-1 ring-brand-teal-200/50' : 'bg-white ring-1 ring-border'}`}>
          <Icon className={`h-4 w-4 ${highlight ? 'text-brand-teal-600' : 'text-muted-foreground'}`} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE'
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 transition-all duration-200 hover:bg-muted/50 hover:border-border">
      <div className="flex-shrink-0 mt-0.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100 ring-1 ring-emerald-200/50' : 'bg-amber-100 ring-1 ring-amber-200/50'}`}>
          <CheckCircleIcon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-amber-600'}`} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Status</p>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <p className="text-sm font-medium text-foreground">{status}</p>
        </div>
      </div>
    </div>
  )
}

function ManagerInfo({ manager }: { manager: Employee['manager'] }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 transition-all duration-200 hover:bg-muted/50 hover:border-border">
      <div className="flex-shrink-0 mt-0.5">
        <div className="h-8 w-8 rounded-lg bg-white ring-1 ring-border flex items-center justify-center">
          <UserCircleIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Manager</p>
        {manager ? (
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-brand-navy-100 flex items-center justify-center ring-1 ring-brand-navy-200/50">
              <span className="text-[10px] font-semibold text-brand-navy-600">
                {manager.firstName.charAt(0)}{manager.lastName.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {manager.firstName} {manager.lastName}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">No manager assigned</p>
        )}
      </div>
    </div>
  )
}

export function EmployeeJobOrgTab({ employee }: { employee: Employee }) {
  const employmentTypeLabel =
    EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ||
    employee.employmentType

  return (
    <div className="rounded-xl border border-border bg-card p-5 md:p-6 stagger-children">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoItem
          icon={BuildingIcon}
          label="Department"
          value={employee.department ?? 'Not assigned'}
          highlight
        />
        <InfoItem
          icon={BriefcaseIcon}
          label="Role / Title"
          value={employee.position}
          highlight
        />
        <InfoItem
          icon={BriefcaseIcon}
          label="Employment Type"
          value={employmentTypeLabel}
        />
        <InfoItem
          icon={CalendarIcon}
          label="Join Date"
          value={formatDate(employee.joinDate)}
        />
        <StatusBadge status={employee.status} />
        <ManagerInfo manager={employee.manager} />
      </div>
    </div>
  )
}

