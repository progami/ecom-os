'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MeApi, PoliciesApi, type Policy } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { ArrowLeftIcon, DocumentIcon, PencilIcon } from '@/components/ui/Icons'
import { POLICY_CATEGORY_LABELS, POLICY_REGION_LABELS, POLICY_STATUS_LABELS } from '@/lib/domain/policy/constants'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PolicyDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [me, setMe] = useState<{ isHR: boolean; isSuperAdmin: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [policyData, meData] = await Promise.all([
        PoliciesApi.get(id),
        MeApi.get().catch(() => null),
      ])
      setPolicy(policyData)
      setMe(meData ? { isHR: Boolean(meData.isHR), isSuperAdmin: Boolean(meData.isSuperAdmin) } : null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load policy'
      setError(message)
      setPolicy(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const canEdit = Boolean(me?.isHR || me?.isSuperAdmin)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </Card>
      </div>
    )
  }

  if (!policy) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <p className="text-sm font-medium text-foreground">Policy not found</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <div className="mt-4">
            <Button variant="secondary" href="/policies">Back to Policies</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/policies"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Policies
      </Link>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main card */}
      <Card padding="lg">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <DocumentIcon className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{policy.title}</h1>
              <p className="text-sm text-muted-foreground">
                Version {policy.version}
              </p>
            </div>
          </div>
          <StatusBadge status={POLICY_STATUS_LABELS[policy.status as keyof typeof POLICY_STATUS_LABELS] ?? policy.status} />
        </div>

        {/* Details */}
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Category</p>
              <p className="text-base text-foreground">
                {POLICY_CATEGORY_LABELS[policy.category as keyof typeof POLICY_CATEGORY_LABELS] ?? policy.category}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Region</p>
              <p className="text-base text-foreground">
                {POLICY_REGION_LABELS[policy.region as keyof typeof POLICY_REGION_LABELS] ?? policy.region}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Effective Date</p>
              <p className="text-base text-foreground">{formatDate(policy.effectiveDate)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Last Updated</p>
              <p className="text-base text-foreground">{formatDate(policy.updatedAt)}</p>
            </div>
          </div>

          {policy.summary && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Summary</p>
              <p className="text-base text-foreground whitespace-pre-line">{policy.summary}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="pt-6 border-t border-border">
            <div className="flex justify-end gap-3">
              <Button href={`/policies/${id}/edit`} icon={<PencilIcon className="h-4 w-4" />}>
                Edit Policy
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Policy content */}
      {policy.content && (
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-foreground mb-4">Policy Content</h2>
          <div className="prose prose-sm max-w-none prose-headings:text-accent prose-h1:text-xl prose-h1:font-bold prose-h2:text-lg prose-h2:font-semibold prose-h2:border-b prose-h2:border-accent/20 prose-h2:pb-2 prose-h2:mt-6 prose-table:text-sm prose-th:bg-accent/5 prose-th:text-primary prose-th:p-2 prose-th:border prose-th:border-accent/20 prose-td:p-2 prose-td:border prose-td:border-border prose-strong:text-primary prose-a:text-accent hover:prose-a:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {policy.content}
            </ReactMarkdown>
          </div>
        </Card>
      )}

      {/* Created date */}
      {policy.createdAt && (
        <p className="text-sm text-muted-foreground text-center">
          Created on {formatDate(policy.createdAt)}
        </p>
      )}
    </div>
  )
}
