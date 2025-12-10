'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EmployeesApi, type Employee } from '@/lib/api-client'

// Icons
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
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

// Page Header
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
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-slate-100">
              <Icon className="h-6 w-6 text-slate-700" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {description && (
              <p className="text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}

function getStatusBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'active') return 'bg-green-100 text-green-700'
  if (s === 'on_leave' || s === 'on leave') return 'bg-yellow-100 text-yellow-700'
  if (s === 'terminated' || s === 'resigned') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-700'
}

export default function EmployeesPage() {
  const router = useRouter()
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700"
          >
            <PlusIcon className="h-4 w-4" />
            Add Employee
          </Link>
        }
      />

      <div className="space-y-6">
        {/* Search */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>

        {/* Results */}
        <p className="text-sm text-slate-500">
          {loading ? 'Loading...' : `${items.length} employee${items.length !== 1 ? 's' : ''}`}
        </p>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Position</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Join Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200" />
                        <div className="space-y-1">
                          <div className="h-4 bg-slate-200 rounded w-24" />
                          <div className="h-3 bg-slate-200 rounded w-16" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-4"><div className="h-5 bg-slate-200 rounded w-16" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <UsersIcon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">No employees found</p>
                    <Link
                      href="/employees/add"
                      className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700 text-sm mt-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add your first employee
                    </Link>
                  </td>
                </tr>
              ) : (
                items.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => router.push(`/employees/${e.id}/edit`)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm font-medium">
                          {e.firstName?.charAt(0)}{e.lastName?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{e.firstName} {e.lastName}</p>
                          <p className="text-xs text-slate-500">{e.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{(e as any).department || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{e.position}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusBadge(e.status)}`}>
                        {e.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">{e.joinDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
