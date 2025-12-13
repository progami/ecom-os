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
import { useNavigationHistory } from '@/lib/navigation-history'

const categoryOptions = [
  { value: 'LEAVE', label: 'Leave' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'CONDUCT', label: 'Conduct' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'COMPENSATION', label: 'Compensation' },
  { value: 'OTHER', label: 'Other' },
]

const regionOptions = [
  { value: 'ALL', label: 'All Regions' },
  { value: 'KANSAS_US', label: 'US (Kansas)' },
  { value: 'PAKISTAN', label: 'Pakistan' },
]

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
]

function getNextVersions(current: string): { minor: string; major: string } {
  const match = current.match(/^(\d+)\.(\d+)$/)
  if (!match) return { minor: '1.1', major: '2.0' }
  const major = parseInt(match[1], 10)
  const minor = parseInt(match[2], 10)
  return {
    minor: `${major}.${minor + 1}`,
    major: `${major + 1}.0`,
  }
}

export default function EditPolicyPage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
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

    // Validate version bump is selected
    if (!payload.newVersion) {
      setError('You must select a new version when updating a policy')
      setSubmitting(false)
      return
    }

    try {
      await PoliciesApi.update(id, {
        title: String(payload.title),
        category: String(payload.category),
        region: String(payload.region),
        status: String(payload.status),
        version: String(payload.newVersion),
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
          showBack
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
          showBack
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
        showBack
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
                  label="Region"
                  name="region"
                  required
                  options={regionOptions}
                  defaultValue={policy.region}
                />
                <SelectField
                  label="Status"
                  name="status"
                  required
                  options={statusOptions}
                  defaultValue={policy.status}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Current Version
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600">
                    v{policy.version}
                  </div>
                </div>
                <SelectField
                  label="New Version"
                  name="newVersion"
                  required
                  options={[
                    { value: getNextVersions(policy.version).minor, label: `v${getNextVersions(policy.version).minor} (Minor update)` },
                    { value: getNextVersions(policy.version).major, label: `v${getNextVersions(policy.version).major} (Major update)` },
                  ]}
                  placeholder="Select new version..."
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
              <Button variant="secondary" onClick={goBack}>
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
