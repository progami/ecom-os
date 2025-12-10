'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { PoliciesApi, type Policy } from '@/lib/api-client'

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  )
}

function PageHeader({
  title,
  description,
  icon: Icon,
  backHref
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  backHref?: string
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-soft backdrop-blur-xl sm:px-6 md:px-8 mb-6">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
          </Link>
        )}
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
    </header>
  )
}

function FormField({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
  children
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
        />
      )}
    </div>
  )
}

export default function EditPolicyPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await PoliciesApi.get(id)
        setPolicy(data)
      } catch (e: any) {
        setError(e.message || 'Failed to load policy')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      await PoliciesApi.update(id, {
        title: String(payload.title),
        category: String(payload.category),
        status: String(payload.status),
        version: payload.version ? String(payload.version) : null,
        effectiveDate: payload.effectiveDate ? String(payload.effectiveDate) : null,
        summary: payload.summary ? String(payload.summary) : null,
        content: payload.content ? String(payload.content) : null,
      })
      router.push(`/policies/${id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to update policy')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Edit Policy"
          description="Company Policies"
          icon={DocumentIcon}
          backHref="/policies"
        />
        <div className="max-w-3xl">
          <div className="dashboard-card p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!policy) {
    return (
      <>
        <PageHeader
          title="Edit Policy"
          description="Company Policies"
          icon={DocumentIcon}
          backHref="/policies"
        />
        <div className="max-w-3xl">
          <div className="dashboard-card p-6">
            <p className="text-red-600">{error || 'Policy not found'}</p>
          </div>
        </div>
      </>
    )
  }

  const effectiveDateFormatted = policy.effectiveDate ? policy.effectiveDate.split('T')[0] : ''

  return (
    <>
      <PageHeader
        title="Edit Policy"
        description="Company Policies"
        icon={DocumentIcon}
        backHref={`/policies/${id}`}
      />

      <div className="max-w-3xl">
        <div className="dashboard-card p-6">
          {error && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Policy Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FormField
                    label="Policy Title"
                    name="title"
                    required
                    defaultValue={policy.title}
                  />
                </div>
                <FormField label="Category" name="category" required>
                  <select
                    id="category"
                    name="category"
                    required
                    defaultValue={policy.category}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="LEAVE">Leave</option>
                    <option value="PERFORMANCE">Performance</option>
                    <option value="CONDUCT">Conduct</option>
                    <option value="SECURITY">Security</option>
                    <option value="COMPENSATION">Compensation</option>
                    <option value="OTHER">Other</option>
                  </select>
                </FormField>
                <FormField label="Status" name="status" required>
                  <select
                    id="status"
                    name="status"
                    defaultValue={policy.status}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </FormField>
                <FormField
                  label="Version"
                  name="version"
                  placeholder="e.g., 1.0"
                  defaultValue={policy.version || ''}
                />
                <FormField
                  label="Effective Date"
                  name="effectiveDate"
                  type="date"
                  defaultValue={effectiveDateFormatted}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Summary</h3>
              <p className="text-xs text-slate-500 mb-2">Brief overview of the policy (1-2 sentences)</p>
              <textarea
                id="summary"
                name="summary"
                rows={2}
                defaultValue={policy.summary || ''}
                placeholder="A brief summary of what this policy covers..."
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
              />
            </div>

            {/* Content */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Policy Content</h3>
              <p className="text-xs text-slate-500 mb-2">Full policy text. You can use markdown formatting.</p>
              <textarea
                id="content"
                name="content"
                rows={15}
                defaultValue={policy.content || ''}
                placeholder="Full policy content..."
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-y min-h-[300px]"
              />
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <Link
                href={`/policies/${id}`}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
