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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">Manage your workforce</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hrms/employees/add" className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">+ Add Employee</Link>
          <Link href="/hrms" className="text-sm underline">Back to Dashboard</Link>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, email, ID..." className="px-3 py-2 rounded-md border border-input w-full" />
        <button onClick={load} className="px-3 py-2 rounded-md bg-primary text-primary-foreground">Search</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Employee</th>
              <th className="text-left p-2">Department</th>
              <th className="text-left p-2">Position</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Join Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map(e => (
              <tr key={e.id} className="border-b border-gray-200 dark:border-gray-800">
                <td className="p-2 font-medium">{e.firstName} {e.lastName} <span className="text-muted-foreground text-xs">({e.employeeId})</span></td>
                <td className="p-2">{(e as any).department || '—'}</td>
                <td className="p-2">{e.position}</td>
                <td className="p-2">{e.status}</td>
                <td className="p-2">{e.joinDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
