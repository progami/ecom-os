"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ResourcesApi } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { FolderIcon } from '@/components/ui/Icons'
import { useNavigationHistory } from '@/lib/navigation-history'

export default function AddResourcePage() {
  const r = useRouter()
  const { goBack } = useNavigationHistory()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any
    try {
      await ResourcesApi.create({
        name: String(payload.name),
        category: String(payload.category || 'OTHER'),
        subcategory: payload.subcategory ? String(payload.subcategory) : undefined,
        email: payload.email ? String(payload.email) : undefined,
        phone: payload.phone ? String(payload.phone) : undefined,
        website: payload.website ? String(payload.website) : undefined,
        description: payload.description ? String(payload.description) : undefined,
        rating: payload.rating ? Number(payload.rating) : undefined,
      })
      r.push('/resources')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="Add Resource"
        description="Company Resources"
        icon={<FolderIcon className="h-6 w-6 text-white" />}
        showBack
      />

      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Name *</label>
          <input name="name" required className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Category *</label>
          <select name="category" className="w-full px-3 py-2 rounded-md border border-input">
            <option value="ACCOUNTING">ACCOUNTING</option>
            <option value="LEGAL">LEGAL</option>
            <option value="DESIGN">DESIGN</option>
            <option value="MARKETING">MARKETING</option>
            <option value="IT">IT</option>
            <option value="HR">HR</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Subcategory</label>
          <input name="subcategory" className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input name="email" type="email" className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Phone</label>
          <input name="phone" className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Website</label>
          <input name="website" className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Description</label>
          <textarea name="description" rows={4} className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div>
          <label className="block text-sm mb-1">Rating</label>
          <input name="rating" type="number" step="0.1" min="0" max="5" className="w-full px-3 py-2 rounded-md border border-input" />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button type="button" onClick={goBack} className="px-4 py-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">
            Cancel
          </button>
          <button disabled={submitting} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save Resource'}
          </button>
        </div>
      </form>
    </div>
  )
}
