'use client'

import type { Employee } from '@/lib/api-client'
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserCircleIcon,
  UsersIcon,
  HashtagIcon,
  ClockIcon,
} from '@/components/ui/Icons'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'
import { formatDate } from '../utils'

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getTenure(joinDate: string): { display: string; years: number; months: number } {
  const start = new Date(joinDate)
  const now = new Date()
  const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  let display: string
  if (totalMonths < 1) display = 'Just started'
  else if (totalMonths < 12) display = `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`
  else if (months === 0) display = `${years} year${years !== 1 ? 's' : ''}`
  else display = `${years}y ${months}m`

  return { display, years, months }
}

export function EmployeeOverviewTab({ employee }: { employee: Employee }) {
  const tenure = getTenure(employee.joinDate)
  const employmentTypeLabel =
    EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ||
    employee.employmentType

  return (
    <div className="space-y-5 stagger-children">
      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border">
        {/* Subtle geometric background pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-teal-500/[0.03] rounded-full" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-navy-500/[0.03] rounded-full" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar Section */}
            <div className="flex-shrink-0 flex flex-col items-center md:items-start gap-3">
              <div className="relative group">
                {employee.avatar ? (
                  <img
                    src={employee.avatar}
                    alt={`${employee.firstName} ${employee.lastName}`}
                    className="h-28 w-28 md:h-32 md:w-32 rounded-2xl object-cover shadow-soft-lg ring-1 ring-border transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="h-28 w-28 md:h-32 md:w-32 rounded-2xl bg-gradient-to-br from-brand-teal-400 to-brand-teal-600 flex items-center justify-center shadow-soft-lg ring-1 ring-brand-teal-400/20">
                    <span className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                      {getInitials(employee.firstName, employee.lastName)}
                    </span>
                  </div>
                )}
                {/* Status indicator */}
                <div className="absolute -bottom-1.5 -right-1.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-card border border-border shadow-sm">
                  <span className={`h-2 w-2 rounded-full ${employee.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {employee.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {/* Name and Title */}
              <div className="mb-4">
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-1">
                  {employee.firstName} {employee.lastName}
                </h1>
                <p className="text-lg text-brand-teal-600 font-medium">{employee.position}</p>
              </div>

              {/* Quick Stats Row */}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BuildingIcon className="h-4 w-4 text-brand-navy-400" />
                  <span className="text-sm font-medium text-foreground">{employee.department}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ClockIcon className="h-4 w-4 text-brand-navy-400" />
                  <span className="text-sm font-medium text-foreground">{tenure.display}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HashtagIcon className="h-4 w-4 text-brand-navy-400" />
                  <span className="text-sm font-medium text-foreground">{employee.employeeId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contact Card */}
        <div className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-soft hover:border-brand-teal-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-teal-50 to-brand-teal-100 flex items-center justify-center ring-1 ring-brand-teal-200/50">
              <EnvelopeIcon className="h-5 w-5 text-brand-teal-600" />
            </div>
            <h3 className="font-semibold text-foreground">Contact</h3>
          </div>
          <div className="space-y-4">
            <div className="group">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Email</p>
              <a
                href={`mailto:${employee.email}`}
                className="text-sm font-medium text-brand-teal-600 hover:text-brand-teal-700 transition-colors inline-flex items-center gap-1.5 group-hover:underline underline-offset-2"
              >
                {employee.email}
              </a>
            </div>
            {employee.phone ? (
              <div className="group">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Phone</p>
                <a
                  href={`tel:${employee.phone}`}
                  className="text-sm font-medium text-brand-teal-600 hover:text-brand-teal-700 transition-colors inline-flex items-center gap-1.5 group-hover:underline underline-offset-2"
                >
                  <PhoneIcon className="h-3.5 w-3.5" />
                  {employee.phone}
                </a>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground/60 italic">No phone on file</div>
            )}
          </div>
        </div>

        {/* Employment Card */}
        <div className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-soft hover:border-brand-navy-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-navy-50 to-brand-navy-100 flex items-center justify-center ring-1 ring-brand-navy-200/50">
              <BriefcaseIcon className="h-5 w-5 text-brand-navy-600" />
            </div>
            <h3 className="font-semibold text-foreground">Employment</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Type</p>
              <p className="text-sm font-medium text-foreground">{employmentTypeLabel}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Start Date</p>
              <p className="text-sm font-medium text-foreground">{formatDate(employee.joinDate)}</p>
            </div>
          </div>
        </div>

        {/* Team Card */}
        <div className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-soft hover:border-brand-navy-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-navy-50 to-brand-navy-100 flex items-center justify-center ring-1 ring-brand-navy-200/50">
              <UsersIcon className="h-5 w-5 text-brand-navy-600" />
            </div>
            <h3 className="font-semibold text-foreground">Team</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Department</p>
              <p className="text-sm font-medium text-foreground">{employee.department}</p>
            </div>
            {employee.manager ? (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Reports to</p>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-brand-navy-100 flex items-center justify-center ring-1 ring-brand-navy-200/50">
                    <UserCircleIcon className="h-4 w-4 text-brand-navy-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {employee.manager.firstName} {employee.manager.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{employee.manager.position}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground/60 italic">No manager assigned</div>
            )}
          </div>
        </div>
      </div>

      {/* Roles Section - if employee has roles */}
      {employee.roles && employee.roles.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-navy-50 to-brand-navy-100 flex items-center justify-center ring-1 ring-brand-navy-200/50">
              <svg className="h-4 w-4 text-brand-navy-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground">System Roles</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {employee.roles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-navy-50 text-brand-navy-700 border border-brand-navy-100 transition-colors hover:bg-brand-navy-100"
              >
                {role.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
