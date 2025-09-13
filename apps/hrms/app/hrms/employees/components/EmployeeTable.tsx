"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MoreVertical, Eye, Trash2, Mail, Phone, Check, X, Edit } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import TableToolbar from '@/app/hrms/components/TableToolbar'

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatar?: string
  department: string
  position: string
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED'
  joinDate: string
}

interface EmployeeTableProps {
  searchQuery: string
  filters?: {
    department?: string
    status?: string
    employmentType?: string
    joined?: string
  }
  onChanged?: () => void
}

export default function EmployeeTable({ searchQuery, filters, onChanged }: EmployeeTableProps) {
  const router = useRouter()
  const [showDropdown, setShowDropdown] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<any>({})

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (filters?.department) params.set('department', filters.department)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.employmentType) params.set('employmentType', filters.employmentType)
    if (filters?.joined) params.set('joined', filters.joined)
    params.set('take', '100')
    params.set('skip', '0')
    return params.toString()
  }, [searchQuery, filters, reloadTick])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/employees?${query}`, { signal: controller.signal })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setEmployees(data.items || [])
      } catch (e: any) {
        if (e.name !== 'AbortError') setError('Failed to load employees')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [query])

  useEffect(() => {
    const handler = () => setReloadTick(t => t + 1)
    window.addEventListener('employees:reload', handler)
    return () => window.removeEventListener('employees:reload', handler)
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this employee?')) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setEmployees(prev => prev.filter(e => e.id !== id))
      onChanged?.()
    } else {
      alert('Delete failed')
    }
  }

  const startEdit = (e: Employee) => {
    setEditingId(e.id)
    setEditDraft({ department: e.department, position: e.position, status: e.status })
  }
  const cancelEdit = () => { setEditingId(null); setEditDraft({}) }
  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/employees/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDraft) })
    if (!res.ok) return alert('Failed to save')
    const updated = await res.json()
    setEmployees(prev => prev.map(e => e.id === id ? updated : e))
    setEditingId(null)
  }

  // unified status badge colors
  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'ON_LEAVE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'TERMINATED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const parseCSV = async (file: File) => {
    const text = await file.text()
    // naive CSV parse supporting quotes
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
    if (lines.length < 2) return alert('CSV is empty')
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = lines.slice(1).map(line => {
      const cells: string[] = []
      let cur = ''
      let inq = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inq && line[i+1] === '"') { cur += '"'; i++; }
          else inq = !inq
        } else if (ch === ',' && !inq) { cells.push(cur); cur=''; }
        else cur += ch
      }
      cells.push(cur)
      const obj: any = {}
      header.forEach((h, idx) => { obj[h] = (cells[idx]||'').trim() })
      return obj
    })
    for (const r of rows) {
      const payload: any = {
        employeeId: r.employeeid || r.employee_id || r.id,
        firstName: r.firstname || r.first_name,
        lastName: r.lastname || r.last_name,
        email: r.email,
        phone: r.phone,
        department: r.department,
        position: r['position/title'] || r.position || r.title,
        employmentType: (r.employmenttype || '').toUpperCase() || 'FULL_TIME',
        status: (r.status || 'ACTIVE').toUpperCase(),
        joinDate: r.joindate || r.join_date,
        reportsTo: r.reportsto || r.reports_to,
        city: r.city,
        country: r.country,
        currency: r.currency,
        salary: r.salary ? Number(r.salary) : undefined,
      }
      if (!payload.employeeId || !payload.firstName || !payload.lastName || !payload.email || !payload.department || !payload.position || !payload.joinDate) continue
      await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setReloadTick(t => t + 1)
  }

  const exportCSV = async () => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (filters?.department) params.set('department', filters.department)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.employmentType) params.set('employmentType', filters.employmentType)
    if (filters?.joined) params.set('joined', filters.joined)
    params.set('take', '10000')
    const res = await fetch(`/api/employees?${params.toString()}`)
    if (!res.ok) return alert('Export failed')
    const data = await res.json()
    const rows = data.items || []
    const header = ['employeeId','firstName','lastName','email','phone','department','position','status','employmentType','joinDate']
    const csv = [header.join(',')]
    for (const r of rows) {
      csv.push([
        r.employeeId, r.firstName, r.lastName, r.email, r.phone||'', r.department, r.position, r.status, r.employmentType, r.joinDate?.slice(0,10)
      ].map((v:any) => (v ?? '').toString().replace(/"/g,'""')).map((v:string) => /[",\n]/.test(v)?`"${v}"`:v).join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employees.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // duplicate removed; using unified getStatusColor above

  return (
    <div>
      <TableToolbar onImport={parseCSV} onExport={exportCSV} />
      <div className="hrms-table-wrapper">
        <table className="hrms-table">
          <thead>
            <tr className="hrms-thead-row">
              <th className="hrms-th">Employee</th>
              <th className="hrms-th">Department</th>
              <th className="hrms-th">Position</th>
              <th className="hrms-th">Status</th>
              <th className="hrms-th">Join Date</th>
              <th className="hrms-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className="hrms-row cursor-pointer"
                onClick={() => { if (!editingId) router.push(`/hrms/employees/${employee.employeeId}`) }}
              >
                <td className="hrms-td">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {employee.firstName[0]}{employee.lastName[0]}
                    </div>
                    <div>
                      <Link
                        href={`/hrms/employees/${employee.employeeId}`}
                        className="font-medium text-purple-400 hover:text-purple-300"
                        onClick={(e)=>e.stopPropagation()}
                      >
                        {employee.firstName} {employee.lastName}
                      </Link>
                      <p className="text-sm text-muted-foreground">{employee.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td className="hrms-td" onClick={(e)=>e.stopPropagation()}>
                  {editingId === employee.id ? (
                    <input value={editDraft.department} onChange={e=>setEditDraft({...editDraft, department: e.target.value})} className="form-input px-2 py-1 w-full" />
                  ) : (
                    <p className="text-foreground">{employee.department}</p>
                  )}
                </td>
                <td className="hrms-td" onClick={(e)=>e.stopPropagation()}>
                  {editingId === employee.id ? (
                    <input value={editDraft.position} onChange={e=>setEditDraft({...editDraft, position: e.target.value})} className="form-input px-2 py-1 w-full" />
                  ) : (
                    <p className="text-foreground">{employee.position}</p>
                  )}
                </td>
                <td className="hrms-td" onClick={(e)=>e.stopPropagation()}>
                  {editingId === employee.id ? (
                    <select value={editDraft.status} onChange={e=>setEditDraft({...editDraft, status: e.target.value})} className="form-input px-2 py-1 w-auto">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ON_LEAVE">ON_LEAVE</option>
                      <option value="TERMINATED">TERMINATED</option>
                      <option value="RESIGNED">RESIGNED</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
                      {employee.status.replace('_', ' ')}
                    </span>
                  )}
                </td>
                <td className="hrms-td">
                  <p className="text-foreground">{new Date(employee.joinDate).toLocaleDateString()}</p>
                </td>
                <td className="hrms-td">
                  <div className="relative">
                    {editingId === employee.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(employee.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Save"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Cancel"><X size={16} /></button>
                      </div>
                    ) : (
                    <button
                      onClick={() => setShowDropdown(showDropdown === employee.id ? null : employee.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      aria-label="More actions"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClickCapture={(e) => e.stopPropagation()}
                    >
                      <MoreVertical size={16} />
                    </button>
                    )}
                    
                    {showDropdown === employee.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-10" onClick={(e)=>e.stopPropagation()}>
                        <Link
                          href={`/hrms/employees/${employee.employeeId}`}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Eye size={16} />
                          <span>View Details</span>
                        </Link>
                        <button onClick={()=>{ setShowDropdown(null); startEdit(employee) }} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left">
                          <Edit size={16} />
                          <span>Edit</span>
                        </button>
                        {/* Edit route not implemented in minimal scope */}
                        <a
                          href={`mailto:${employee.email}`}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Mail size={16} />
                          <span>Send Email</span>
                        </a>
                        <a
                          href={`tel:${employee.phone}`}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Phone size={16} />
                          <span>Call</span>
                        </a>
                        <button onClick={() => handleDelete(employee.id)} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-red-600 dark:text-red-300 w-full">
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {loading && (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      )}
      {error && (
        <div className="text-center py-8 text-red-400">{error}</div>
      )}
      {!loading && employees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No employees found matching your search.</p>
        </div>
      )}
    </div>
  )
}
