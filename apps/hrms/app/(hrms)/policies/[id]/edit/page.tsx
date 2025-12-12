'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PoliciesApi, type Policy } from '@/lib/api-client'
import { DocumentIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  FormField,
  SelectField,
  TextareaField,
  FormSection,
  FormActions,
} from '@/components/ui/FormField'

const categoryOptions = [
  { value: 'LEAVE', label: 'Leave' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'CONDUCT', label: 'Conduct' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'COMPENSATION', label: 'Compensation' },
  { value: 'OTHER', label: 'Other' },
]

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
]

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
        version: payload.version ? String(payload.version) : undefined,
        effectiveDate: payload.effectiveDate ? String(payload.effectiveDate) : undefined,
        summary: payload.summary ? String(payload.summary) : undefined,
        content: payload.content ? String(payload.content) : undefined,
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
          icon={<DocumentIcon className="h-6 w-6 text-white" />}
          backHref="/policies"
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
            </div>
          </Card>
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
          icon={<DocumentIcon className="h-6 w-6 text-white" />}
          backHref="/policies"
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{error || 'Policy not found'}</Alert>
          </Card>
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
        icon={<DocumentIcon className="h-6 w-6 text-white" />}
        backHref={`/policies/${id}`}
      />

      <div className="max-w-3xl">
        <Card padding="lg">
          {error && (
            <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-8">
            {/* Basic Info */}
            <FormSection title="Policy Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <FormField
                    label="Policy Title"
                    name="title"
                    required
                    defaultValue={policy.title}
                  />
                </div>
                <SelectField
                  label="Category"
                  name="category"
                  required
                  options={categoryOptions}
                  defaultValue={policy.category}
                />
                <SelectField
                  label="Status"
                  name="status"
                  required
                  options={statusOptions}
                  defaultValue={policy.status}
                />
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
            </FormSection>

            <CardDivider />

            {/* Summary */}
            <FormSection title="Summary" description="Brief overview of the policy">
              <TextareaField
                label="Summary"
                name="summary"
                rows={3}
                defaultValue={policy.summary || ''}
                placeholder="A brief summary of what this policy covers..."
                resizable={false}
              />
            </FormSection>

            <CardDivider />

            {/* Content */}
            <FormSection title="Policy Content" description="Full policy text">
              <TextareaField
                label="Content"
                name="content"
                rows={16}
                monospace
                defaultValue={policy.content || ''}
                placeholder="Full policy content..."
              />
            </FormSection>

            {/* Actions */}
            <FormActions>
              <Button variant="secondary" href={`/policies/${id}`}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
