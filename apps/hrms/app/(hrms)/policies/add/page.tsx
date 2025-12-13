'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PoliciesApi } from '@/lib/api-client'
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

export default function AddPolicyPage() {
  const router = useRouter()
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
      await PoliciesApi.create({
        title: String(payload.title),
        category: String(payload.category),
        region: String(payload.region),
        status: String(payload.status || 'DRAFT'),
        version: payload.version ? String(payload.version) : undefined,
        effectiveDate: payload.effectiveDate ? String(payload.effectiveDate) : undefined,
        summary: payload.summary ? String(payload.summary) : undefined,
        content: payload.content ? String(payload.content) : undefined,
      })
      router.push('/policies')
    } catch (e: any) {
      setError(e.message || 'Failed to create policy')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Add Policy"
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
            <FormSection title="Policy Information" description="Enter the basic details for this policy">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <FormField
                    label="Policy Title"
                    name="title"
                    required
                    placeholder="e.g., Annual Leave Policy"
                  />
                </div>
                <SelectField
                  label="Category"
                  name="category"
                  required
                  options={categoryOptions}
                  placeholder="Select category..."
                />
                <SelectField
                  label="Region"
                  name="region"
                  required
                  options={regionOptions}
                  placeholder="Select region..."
                />
                <SelectField
                  label="Status"
                  name="status"
                  required
                  options={statusOptions}
                  defaultValue="DRAFT"
                />
                <FormField
                  label="Version"
                  name="version"
                  defaultValue="1.0"
                  placeholder="e.g., 1.0"
                />
                <FormField
                  label="Effective Date"
                  name="effectiveDate"
                  type="date"
                />
              </div>
            </FormSection>

            <CardDivider />

            {/* Summary */}
            <FormSection title="Summary" description="Brief overview of the policy (1-2 sentences)">
              <TextareaField
                label="Summary"
                name="summary"
                rows={3}
                placeholder="A brief summary of what this policy covers..."
                resizable={false}
              />
            </FormSection>

            <CardDivider />

            {/* Content */}
            <FormSection title="Policy Content" description="Full policy text. You can use markdown formatting.">
              <TextareaField
                label="Content"
                name="content"
                rows={16}
                monospace
                placeholder={`# Policy Title

## Purpose
Describe the purpose of this policy...

## Scope
Who this policy applies to...

## Policy Statement
The main policy content...

## Procedures
Step-by-step procedures...

## Compliance
Consequences of non-compliance...`}
              />
            </FormSection>

            {/* Actions */}
            <FormActions>
              <Button variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Saving...' : 'Save Policy'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
