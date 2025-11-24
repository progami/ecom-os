'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { EmployeesApi, type Employee } from '@/lib/api-client'

// Icon components
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
    <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-soft backdrop-blur-xl sm:px-6 md:px-8 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
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
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}

function getStatusBadgeClass(status: string) {
  const statusLower = status.toLowerCase()
  if (statusLower === 'active') return 'bg-green-100 text-green-700'
  if (statusLower === 'on_leave' || statusLower === 'on leave') return 'bg-amber-100 text-amber-700'
  if (statusLower === 'terminated' || statusLower === 'resigned') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-700'
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
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-soft text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Employee
          </Link>
        }
      />

      <div className="space-y-4">
        {/* Search */}
        <div className="dashboard-card p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors text-sm font-medium"
            >
              Search
            </button>
          </form>
        </div>

        {/* Results count */}
        <div className="bg-slate-100 px-4 py-2 rounded-lg">
          <p className="text-sm text-slate-600">
            {loading ? 'Loading...' : `Showing ${items.length} employee${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Table */}
        <div className="dashboard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Position</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Join Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                      <td className="px-4 py-4"><div className="h-6 bg-slate-200 rounded-full w-16"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <UsersIcon className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 text-sm">No employees found</p>
                      <Link
                        href="/employees/add"
                        className="inline-flex items-center text-cyan-600 hover:text-cyan-700 text-sm font-medium mt-2"
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Add your first employee
                      </Link>
                    </td>
                  </tr>
                ) : (
                  items.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-cyan-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-cyan-700">
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
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {(e as any).department || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {e.position}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(e.status)}`}>
                          {e.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
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
