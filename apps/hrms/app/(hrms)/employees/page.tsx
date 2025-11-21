"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { EmployeesApi, type Employee } from '@/lib/api-client'

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([])
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await EmployeesApi.list({ q })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error fetching employees:', err)
      setItems([])
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage your workforce</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
          href="/employees/add"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
          >
            + Add Employee
          </Link>
        </div>
      </div>

      <div className="dashboard-card p-6">
        <div className="flex gap-3 mb-6">
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search name, email, ID..."
            className="px-4 py-2 rounded-lg border border-input w-full input-focus"
          />
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium text-sm whitespace-nowrap"
          >
            Search
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left p-3 font-semibold">Employee</th>
                <th className="text-left p-3 font-semibold">Department</th>
                <th className="text-left p-3 font-semibold">Position</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Join Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id} className="table-row-hover border-b border-border">
                  <td className="p-3 font-medium text-foreground">
                    {e.firstName} {e.lastName}
                    <span className="text-muted-foreground text-xs ml-2">({e.employeeId})</span>
                  </td>
                  <td className="p-3 text-foreground">{(e as any).department || '—'}</td>
                  <td className="p-3 text-foreground">{e.position}</td>
                  <td className="p-3">
                    <span className="badge-success">{e.status}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{e.joinDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
