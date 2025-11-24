'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EmployeesApi } from '@/lib/api-client'

// Icon components
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  )
}

// Page Header Component
function PageHeader({
  title,
  description,
  icon: Icon,
  backHref
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  backHref?: string
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-soft backdrop-blur-xl sm:px-6 md:px-8 mb-6">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
          </Link>
        )}
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 shadow-md">
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {description && (
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70">
              {description}
            </span>
          )}
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        </div>
      </div>
    </header>
  )
}

// Form Field Component
function FormField({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  children
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
        />
      )}
    </div>
  )
}

export default function AddEmployeePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      await EmployeesApi.create({
        employeeId: String(payload.employeeId),
        firstName: String(payload.firstName),
        lastName: String(payload.lastName),
        email: String(payload.email),
        department: String(payload.department || ''),
        position: String(payload.position),
        joinDate: String(payload.joinDate),
        employmentType: String(payload.employmentType || 'FULL_TIME'),
        status: String(payload.status || 'ACTIVE'),
      })
      router.push('/employees')
    } catch (e: any) {
      setError(e.message || 'Failed to create employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Add Employee"
        description="People"
        icon={UsersIcon}
        backHref="/employees"
      />

      <div className="max-w-2xl">
        <div className="dashboard-card p-6">
          {error && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            {/* Basic Info Section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Employee ID"
                  name="employeeId"
                  required
                  placeholder="e.g., EMP001"
                />
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  required
                  placeholder="employee@company.com"
                />
                <FormField
                  label="First Name"
                  name="firstName"
                  required
                  placeholder="John"
                />
                <FormField
                  label="Last Name"
                  name="lastName"
                  required
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Work Info Section */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Work Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Department"
                  name="department"
                  required
                  placeholder="e.g., Engineering"
                />
                <FormField
                  label="Position"
                  name="position"
                  required
                  placeholder="e.g., Software Engineer"
                />
                <FormField
                  label="Join Date"
                  name="joinDate"
                  type="date"
                  required
                />
                <FormField label="Employment Type" name="employmentType" required>
                  <select
                    id="employmentType"
                    name="employmentType"
                    defaultValue="FULL_TIME"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </FormField>
                <FormField label="Status" name="status" required>
                  <select
                    id="status"
                    name="status"
                    defaultValue="ACTIVE"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="TERMINATED">Terminated</option>
                    <option value="RESIGNED">Resigned</option>
                  </select>
                </FormField>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <Link
                href="/employees"
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save Employee'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
