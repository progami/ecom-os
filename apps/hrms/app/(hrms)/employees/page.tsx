'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { EmployeesApi, type Employee } from '@/lib/api-client'

// Icon components
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  )
}

// Page Header Component
function PageHeader({
  title,
  description,
  icon: Icon,
  actions
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6 md:px-8 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-500 shadow-md">
              <Icon className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="flex flex-col">
            {description && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {description}
              </span>
            )}
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}

function getStatusBadgeClass(status: string) {
  const statusLower = status.toLowerCase()
  if (statusLower === 'active') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
  if (statusLower === 'on_leave' || statusLower === 'on leave') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
  if (statusLower === 'terminated' || statusLower === 'resigned') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
  return 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/20'
}

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await EmployeesApi.list({ q })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error fetching employees:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  return (
    <>
      <PageHeader
        title="Employees"
        description="People"
        icon={UsersIcon}
        actions={
          <Link
            href="/employees/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Add Employee
          </Link>
        }
      />

      <div className="space-y-4">
        {/* Search */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="pl-10 pr-4 py-2.5 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              Search
            </button>
          </form>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading...' : `${items.length} employee${items.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Employee</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Department</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Position</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Join Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-200"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-200 rounded w-28"></div>
                            <div className="h-3 bg-slate-200 rounded w-20"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                      <td className="px-5 py-4"><div className="h-6 bg-slate-200 rounded-full w-16"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
                          <UsersIcon className="h-7 w-7 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">No employees found</p>
                        <p className="text-xs text-slate-500 mb-4">Get started by adding your first employee</p>
                        <Link
                          href="/employees/add"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                        >
                          <UserPlusIcon className="h-4 w-4" />
                          Add Employee
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-sm">
                            <span className="text-sm font-semibold text-white">
                              {e.firstName?.charAt(0)}{e.lastName?.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {e.firstName} {e.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{e.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {(e as any).department || '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {e.position}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(e.status)}`}>
                          {e.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {e.joinDate}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
