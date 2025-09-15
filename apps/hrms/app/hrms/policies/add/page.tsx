"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PoliciesApi } from '@/lib/api-client'

export default function AddPolicyPage() {
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
      await PoliciesApi.create({
        title: String(payload.title),
        category: String(payload.category || 'OTHER'),
        summary: payload.summary ? String(payload.summary) : undefined,
        status: String(payload.status || 'ACTIVE'),
      })
      r.push('/hrms/policies')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Add Policy</h1>
        <Link href="/hrms/policies" className="text-sm underline">Back to list</Link>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Title *</label>
          <input name="title" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Category *</label>
          <select name="category" className="w-full px-3 py-2 rounded-md border border-input">
            <option value="LEAVE">LEAVE</option>
            <option value="PERFORMANCE">PERFORMANCE</option>
            <option value="CONDUCT">CONDUCT</option>
            <option value="SECURITY">SECURITY</option>
            <option value="COMPENSATION">COMPENSATION</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Status *</label>
          <select name="status" className="w-full px-3 py-2 rounded-md border border-input">
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Summary</label>
          <textarea name="summary" rows={4} className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div className="md:col-span-2">
          <button disabled={submitting} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save Policy'}
          </button>
        </div>
      </form>
    </div>
  )
}

