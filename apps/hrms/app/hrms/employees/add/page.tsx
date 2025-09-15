"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EmployeesApi } from '@/lib/api-client'

export default function AddEmployeePage() {
  const r = useRouter()
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
        department: String(payload.department || payload.departmentName || ''),
        position: String(payload.position),
        joinDate: String(payload.joinDate),
        employmentType: String(payload.employmentType || 'FULL_TIME'),
        status: String(payload.status || 'ACTIVE'),
      })
      r.push('/hrms/employees')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Add Employee</h1>
        <Link href="/hrms/employees" className="text-sm underline">Back to list</Link>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Employee ID *</label>
          <input name="employeeId" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Email *</label>
          <input name="email" type="email" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">First Name *</label>
          <input name="firstName" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Last Name *</label>
          <input name="lastName" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Department *</label>
          <input name="department" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Position *</label>
          <input name="position" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Join Date *</label>
          <input name="joinDate" type="date" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Employment Type *</label>
          <select name="employmentType" className="w-full px-3 py-2 rounded-md border border-input">
            <option value="FULL_TIME">FULL_TIME</option>
            <option value="PART_TIME">PART_TIME</option>
            <option value="CONTRACT">CONTRACT</option>
            <option value="INTERN">INTERN</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Status *</label>
          <select name="status" className="w-full px-3 py-2 rounded-md border border-input">
            <option value="ACTIVE">ACTIVE</option>
            <option value="ON_LEAVE">ON_LEAVE</option>
            <option value="TERMINATED">TERMINATED</option>
            <option value="RESIGNED">RESIGNED</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <button disabled={submitting} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save Employee'}
          </button>
        </div>
      </form>
    </div>
  )
}
