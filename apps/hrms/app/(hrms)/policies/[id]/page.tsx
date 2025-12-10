'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}

function getStatusBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'active') return 'bg-green-100 text-green-700'
  if (s === 'draft') return 'bg-yellow-100 text-yellow-700'
  if (s === 'archived') return 'bg-slate-100 text-slate-600'
  return 'bg-blue-100 text-blue-700'
}

function getCategoryLabel(category: string) {
  const map: Record<string, string> = {
    LEAVE: 'Leave',
    PERFORMANCE: 'Performance',
    CONDUCT: 'Conduct',
    SECURITY: 'Security',
    COMPENSATION: 'Compensation',
    OTHER: 'Other',
  }
  return map[category] || category
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function ViewPolicyPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="h-64 bg-slate-200 rounded" />
      </div>
    )
  }

  if (error || !policy) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-red-600 mb-4">{error || 'Policy not found'}</p>
        <Link href="/policies" className="text-cyan-600 hover:text-cyan-700">
          Back to policies
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-soft backdrop-blur-xl sm:px-6 md:px-8 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/policies"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 shadow-md">
              <DocumentIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70">
                Policy
              </span>
              <h1 className="text-2xl font-semibold text-slate-900">{policy.title}</h1>
            </div>
          </div>
          <Link
            href={`/policies/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700"
          >
            <PencilIcon className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </header>

      <div className="max-w-4xl space-y-6">
        {/* Meta Info */}
        <div className="dashboard-card p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">Category</p>
              <p className="text-sm font-medium text-slate-900">{getCategoryLabel(policy.category)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">Status</p>
              <span className={`inline-block text-xs px-2 py-1 rounded font-medium ${getStatusBadge(policy.status)}`}>
                {policy.status}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">Version</p>
              <p className="text-sm text-slate-900">{policy.version || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">Effective Date</p>
              <p className="text-sm text-slate-900">{formatDate(policy.effectiveDate)}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        {policy.summary && (
          <div className="dashboard-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Summary</h2>
            <p className="text-sm text-slate-600">{policy.summary}</p>
          </div>
        )}

        {/* Content */}
        {policy.content && (
          <div className="dashboard-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Policy Content</h2>
            <div className="prose prose-sm prose-slate max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                {policy.content}
              </pre>
            </div>
          </div>
        )}

        {/* No content message */}
        {!policy.content && !policy.summary && (
          <div className="dashboard-card p-12 text-center">
            <DocumentIcon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No content has been added to this policy yet.</p>
            <Link
              href={`/policies/${id}/edit`}
              className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700 text-sm mt-2"
            >
              <PencilIcon className="h-4 w-4" />
              Add content
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
