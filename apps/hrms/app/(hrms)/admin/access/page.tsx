'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminApi, type EmployeeAccess } from '@/lib/api-client'
import { LockClosedIcon, SearchIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

function Avatar({ src, name }: { src?: string | null; name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-10 w-10 rounded-full object-cover"
      />
    )
  }

  return (
    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
      <span className="text-sm font-medium text-gray-600">{initials}</span>
    </div>
  )
}

export default function AccessManagementPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<EmployeeAccess[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadEmployees()
  }, [])

  async function loadEmployees() {
    setLoading(true)
    setError(null)
    try {
      const data = await AdminApi.getAccessList()
      setEmployees(data.items)
      setCurrentUserId(data.currentUserId)
    } catch (e: any) {
      if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
        router.replace('/')
        return
      }
      setError(e.message || 'Failed to load access list')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(
    employeeId: string,
    field: 'isSuperAdmin' | 'isHR',
    newValue: boolean
  ) {
    setUpdating(employeeId)
    setError(null)
    try {
      await AdminApi.updateAccess(employeeId, { [field]: newValue })
      // Update local state
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employeeId ? { ...emp, [field]: newValue } : emp
        )
      )
    } catch (e: any) {
      setError(e.message || 'Failed to update access')
    } finally {
      setUpdating(null)
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      emp.firstName.toLowerCase().includes(query) ||
      emp.lastName.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.department?.toLowerCase().includes(query) ||
      emp.position.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <>
        <PageHeader
          title="Access Management"
          description="Manage system roles and permissions"
          icon={<LockClosedIcon className="h-6 w-6 text-white" />}
        />
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-full max-w-md" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Access Management"
        description="Manage system roles and permissions"
        icon={<LockClosedIcon className="h-6 w-6 text-white" />}
      />

      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card padding="lg">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Role Descriptions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                Super Admin
              </span>
              <span>Full system access, final approval authority for violations</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                HR
              </span>
              <span>Can review violations, access all employee records</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    Super Admin
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    HR
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((emp) => {
                const isCurrentUser = emp.id === currentUserId
                const fullName = `${emp.firstName} ${emp.lastName}`

                return (
                  <tr
                    key={emp.id}
                    className={`hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar src={emp.avatar} name={fullName} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {fullName}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-blue-600">(You)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{emp.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {emp.department || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          checked={emp.isSuperAdmin}
                          onChange={(checked) => handleToggle(emp.id, 'isSuperAdmin', checked)}
                          disabled={updating === emp.id || (isCurrentUser && emp.isSuperAdmin)}
                          label={`Toggle Super Admin for ${fullName}`}
                        />
                      </div>
                      {isCurrentUser && emp.isSuperAdmin && (
                        <div className="text-xs text-gray-400 mt-1">Cannot remove own</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          checked={emp.isHR}
                          onChange={(checked) => handleToggle(emp.id, 'isHR', checked)}
                          disabled={updating === emp.id}
                          label={`Toggle HR for ${fullName}`}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No employees match your search' : 'No employees found'}
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500">
          <div className="flex gap-6">
            <span>
              Total: <strong>{employees.length}</strong> employees
            </span>
            <span>
              Super Admins: <strong>{employees.filter((e) => e.isSuperAdmin).length}</strong>
            </span>
            <span>
              HR: <strong>{employees.filter((e) => e.isHR).length}</strong>
            </span>
          </div>
        </div>
      </Card>
    </>
  )
}
