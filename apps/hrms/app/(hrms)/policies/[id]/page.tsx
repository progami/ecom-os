'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PoliciesApi, type Policy } from '@/lib/api-client'
import { DocumentIcon, PencilIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

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

function getRegionLabel(region: string) {
  const map: Record<string, string> = {
    KANSAS_US: 'US (Kansas)',
    PAKISTAN: 'Pakistan',
  }
  return map[region] || region
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  )
}

export default function ViewPolicyPage() {
  const params = useParams()
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
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    )
  }

  if (error || !policy) {
    return (
      <div className="py-12">
        <EmptyState
          icon={<DocumentIcon className="h-12 w-12" />}
          title={error || 'Policy not found'}
          description="The policy you're looking for doesn't exist or has been removed."
          action={{
            label: 'Back to policies',
            href: '/policies',
          }}
        />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={policy.title}
        description="Policy"
        icon={<DocumentIcon className="h-6 w-6 text-white" />}
        backHref="/policies"
        actions={
          <Button href={`/policies/${id}/edit`} icon={<PencilIcon className="h-4 w-4" />}>
            Edit
          </Button>
        }
      />

      <div className="max-w-4xl space-y-6">
        {/* Meta Info */}
        <Card padding="md">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            <MetaItem label="Category">
              {getCategoryLabel(policy.category)}
            </MetaItem>
            <MetaItem label="Region">
              {getRegionLabel(policy.region)}
            </MetaItem>
            <MetaItem label="Status">
              <StatusBadge status={policy.status} />
            </MetaItem>
            <MetaItem label="Version">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                v{policy.version}
              </span>
            </MetaItem>
            <MetaItem label="Effective Date">
              {formatDate(policy.effectiveDate)}
            </MetaItem>
          </div>
        </Card>

        {/* Summary */}
        {policy.summary && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Summary</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{policy.summary}</p>
          </Card>
        )}

        {/* Content */}
        {policy.content && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Policy Content</h2>
            <div className="prose prose-sm max-w-none prose-headings:text-cyan-700 prose-h1:text-xl prose-h1:font-bold prose-h2:text-lg prose-h2:font-semibold prose-h2:border-b prose-h2:border-cyan-200 prose-h2:pb-2 prose-h2:mt-6 prose-table:text-sm prose-th:bg-cyan-50 prose-th:text-cyan-900 prose-th:p-2 prose-th:border prose-th:border-cyan-200 prose-td:p-2 prose-td:border prose-td:border-slate-200 prose-strong:text-cyan-800 prose-a:text-cyan-600 hover:prose-a:text-cyan-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {policy.content}
              </ReactMarkdown>
            </div>
          </Card>
        )}

        {/* No content message */}
        {!policy.content && !policy.summary && (
          <Card padding="lg">
            <EmptyState
              icon={<DocumentIcon className="h-10 w-10" />}
              title="No content has been added"
              description="This policy doesn't have any content yet."
              action={{
                label: 'Add content',
                href: `/policies/${id}/edit`,
              }}
            />
          </Card>
        )}
      </div>
    </>
  )
}
