'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Filter, Download } from 'lucide-react'
import Link from 'next/link'
import EmployeeTable from './components/EmployeeTable'
import EmployeeFilters from './components/EmployeeFilters'

export default function EmployeesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<{department?: string; status?: string; employmentType?: string; joined?: string}>({})

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (filters.department) params.set('department', filters.department)
    if (filters.status) params.set('status', filters.status)
    if (filters.employmentType) params.set('employmentType', filters.employmentType)
    if (filters.joined) params.set('joined', filters.joined)
    params.set('take', '10000')
    const res = await fetch(`/api/employees?${params.toString()}`)
    if (!res.ok) return alert('Export failed')
    const data = await res.json()
    const rows = data.items || []
    const header = ['employeeId','firstName','lastName','email','phone','department','position','status','joinDate']
    const csv = [header.join(',')]
    for (const r of rows) {
      csv.push([
        r.employeeId, r.firstName, r.lastName, r.email, r.phone||'', r.department, r.position, r.status, r.joinDate?.slice(0,10)
      ].map(v => (v ?? '').toString().replace(/"/g,'""')).map(v => /[",\n]/.test(v)?`"${v}"`:v).join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employees.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Employees</h1>
          <p className="text-muted-foreground mt-2">Manage your workforce</p>
        </div>
        
        <Link
          href="/hrms/employees/add"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={20} />
          <span>Add Employee</span>
        </Link>
      </div>

      {/* Search and Filters Bar */}
      <div className="gradient-border">
        <div className="gradient-border-content p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search employees by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input w-full pl-10 pr-4"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="secondary-button"
              >
                <Filter size={20} />
                <span>Filters</span>
              </button>
              
              <button onClick={handleExport} className="secondary-button">
                <Download size={20} />
                <span>Export</span>
              </button>
            </div>
          </div>
          
          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <EmployeeFilters value={filters} onChange={setFilters} />
            </div>
          )}
        </div>
      </div>

      {/* Employee Table */}
      <EmployeeTable searchQuery={searchQuery} filters={filters} />
    </div>
  )
}
