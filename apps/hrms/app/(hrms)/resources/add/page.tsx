'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ResourcesApi } from '@/lib/api-client'
import { FolderIcon } from '@/components/ui/Icons'
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
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'IT', label: 'IT' },
  { value: 'HR', label: 'HR' },
  { value: 'OTHER', label: 'Other' },
]

const ratingOptions = [
  { value: '', label: 'No rating' },
  { value: '1', label: '1 - Poor' },
  { value: '2', label: '2 - Fair' },
  { value: '3', label: '3 - Good' },
  { value: '4', label: '4 - Very Good' },
  { value: '5', label: '5 - Excellent' },
]

export default function AddResourcePage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as Record<string, string>

    try {
      await ResourcesApi.create({
        name: String(payload.name),
        category: String(payload.category),
        subcategory: payload.subcategory ? String(payload.subcategory) : undefined,
        email: payload.email ? String(payload.email) : undefined,
        phone: payload.phone ? String(payload.phone) : undefined,
        website: payload.website ? String(payload.website) : undefined,
        description: payload.description ? String(payload.description) : undefined,
        rating: payload.rating ? Number(payload.rating) : undefined,
      })
      router.push('/resources')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create resource'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Add Resource"
        description="Service Providers"
        icon={<FolderIcon className="h-6 w-6 text-white" />}
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
            {/* Basic Information */}
            <FormSection
              title="Basic Information"
              description="Enter the name and category of this resource"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <FormField
                    label="Resource Name"
                    name="name"
                    required
                    placeholder="e.g., ABC Legal Services"
                  />
                </div>
                <SelectField
                  label="Category"
                  name="category"
                  required
                  options={categoryOptions}
                  placeholder="Select category..."
                />
                <FormField
                  label="Subcategory"
                  name="subcategory"
                  placeholder="e.g., Tax Consulting"
                  hint="Optional specialization within the category"
                />
              </div>
            </FormSection>

            <CardDivider />

            {/* Contact Information */}
            <FormSection
              title="Contact Information"
              description="How to reach this service provider"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="contact@example.com"
                />
                <FormField
                  label="Phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                />
                <div className="sm:col-span-2">
                  <FormField
                    label="Website"
                    name="website"
                    type="url"
                    placeholder="https://www.example.com"
                    hint="Full URL including https://"
                  />
                </div>
              </div>
            </FormSection>

            <CardDivider />

            {/* Additional Details */}
            <FormSection
              title="Additional Details"
              description="Optional information about this resource"
            >
              <div className="grid grid-cols-1 gap-5">
                <TextareaField
                  label="Description"
                  name="description"
                  rows={4}
                  placeholder="Describe the services offered, specializations, and any relevant notes..."
                  resizable={false}
                />
                <div className="sm:w-1/2">
                  <SelectField
                    label="Rating"
                    name="rating"
                    options={ratingOptions}
                    placeholder="Select rating..."
                  />
                </div>
              </div>
            </FormSection>

            {/* Actions */}
            <FormActions>
              <Button type="button" variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Saving...' : 'Save Resource'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
