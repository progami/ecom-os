'use client'

import type { Employee } from '@/lib/api-client'
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  EnvelopeIcon,
  UserCircleIcon,
  UsersIcon,
} from '@/components/ui/Icons'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'
import { formatDate } from '../utils'

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getTenure(joinDate: string): string {
  const start = new Date(joinDate)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())

  if (months < 1) return 'Just started'
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12

  if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years}y ${remainingMonths}m`
}

export function EmployeeOverviewTab({ employee }: { employee: Employee }) {
  const tenure = getTenure(employee.joinDate)
  const employmentTypeLabel =
    EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ||
    employee.employmentType

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-800 via-brand-navy-700 to-brand-navy-900 p-6 md:p-8">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-teal-400 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-brand-teal-500 blur-3xl" />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {employee.avatar ? (
              <img
                src={employee.avatar}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="h-24 w-24 md:h-28 md:w-28 rounded-2xl object-cover ring-4 ring-white/20 shadow-xl"
              />
            ) : (
              <div className="h-24 w-24 md:h-28 md:w-28 rounded-2xl bg-brand-teal-500 flex items-center justify-center ring-4 ring-white/20 shadow-xl">
                <span className="text-3xl md:text-4xl font-bold text-white">
                  {getInitials(employee.firstName, employee.lastName)}
                </span>
              </div>
            )}
          </div>

          {/* Name & Position */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-lg text-brand-teal-300 font-medium mt-1">{employee.position}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="inline-flex items-center gap-1.5 text-sm text-white/70">
                <BuildingIcon className="h-4 w-4" />
                {employee.department}
              </span>
              <span className="text-white/30">•</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/70">
                <CalendarIcon className="h-4 w-4" />
                {tenure}
              </span>
              <span className="text-white/30">•</span>
              <span className="text-sm text-white/70">{employee.employeeId}</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="md:self-start">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-brand-teal-500/20 text-brand-teal-300 border border-brand-teal-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-teal-400 animate-pulse" />
              {employee.status}
            </span>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Contact Card */}
        <div className="rounded-xl border border-border bg-card p-5 hover:border-brand-teal-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-brand-teal-500/10 flex items-center justify-center">
              <EnvelopeIcon className="h-4 w-4 text-brand-teal-600" />
            </div>
            <h3 className="font-semibold text-foreground">Contact</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Email</p>
              <a
                href={`mailto:${employee.email}`}
                className="text-sm font-medium text-brand-teal-600 hover:text-brand-teal-700 hover:underline"
              >
                {employee.email}
              </a>
            </div>
            {employee.phone ? (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Phone</p>
                <a
                  href={`tel:${employee.phone}`}
                  className="text-sm font-medium text-brand-teal-600 hover:text-brand-teal-700 hover:underline"
                >
                  {employee.phone}
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {/* Employment Card */}
        <div className="rounded-xl border border-border bg-card p-5 hover:border-brand-teal-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-brand-navy-500/10 flex items-center justify-center">
              <BriefcaseIcon className="h-4 w-4 text-brand-navy-600" />
            </div>
            <h3 className="font-semibold text-foreground">Employment</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Type</p>
              <p className="text-sm font-medium text-foreground">{employmentTypeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Start Date</p>
              <p className="text-sm font-medium text-foreground">{formatDate(employee.joinDate)}</p>
            </div>
          </div>
        </div>

        {/* Team Card */}
        <div className="rounded-xl border border-border bg-card p-5 hover:border-brand-teal-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-brand-navy-500/10 flex items-center justify-center">
              <UsersIcon className="h-4 w-4 text-brand-navy-600" />
            </div>
            <h3 className="font-semibold text-foreground">Team</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Department</p>
              <p className="text-sm font-medium text-foreground">{employee.department}</p>
            </div>
            {employee.manager ? (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Reports to</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-6 w-6 rounded-full bg-brand-navy-100 flex items-center justify-center">
                    <UserCircleIcon className="h-4 w-4 text-brand-navy-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {employee.manager.firstName} {employee.manager.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{employee.manager.position}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Roles Section - if employee has roles */}
      {employee.roles && employee.roles.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-3">System Roles</h3>
          <div className="flex flex-wrap gap-2">
            {employee.roles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-navy-50 text-brand-navy-700 border border-brand-navy-100"
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
