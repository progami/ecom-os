'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PoliciesApi, type Policy } from '@/lib/api-client'
import { DocumentIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormActions, FormField, FormSection, SelectField, TextareaField } from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'
import { POLICY_CATEGORY_OPTIONS, POLICY_REGION_OPTIONS, POLICY_STATUS_OPTIONS } from '@/lib/domain/policy/constants'

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

const EditPolicySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  category: z.string().min(1, 'Category is required'),
  region: z.string().min(1, 'Region is required'),
  status: z.string().min(1, 'Status is required'),
  newVersion: z.string().min(1, 'New version is required'),
  effectiveDate: z.string().optional().nullable(),
  summary: z.string().max(1000).optional().nullable(),
  content: z.string().max(50000).optional().nullable(),
})

type FormData = z.infer<typeof EditPolicySchema>

export default function EditPolicyPage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const params = useParams()
  const id = params.id as string

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(EditPolicySchema),
  })

  const category = watch('category')
  const region = watch('region')

  useEffect(() => {
    if (category === 'CONDUCT' && region !== 'ALL') {
      setValue('region', 'ALL', { shouldValidate: true })
    }
  }, [category, region, setValue])

  useEffect(() => {
    async function load() {
      try {
        const data = await PoliciesApi.get(id)
        setPolicy(data)
        const versions = getNextVersions(data.version)
        reset({
          title: data.title,
          category: data.category,
          region: data.region,
          status: data.status,
          newVersion: versions.minor,
          effectiveDate: data.effectiveDate?.split('T')[0],
          summary: data.summary,
          content: data.content,
        })
      } catch (e: any) {
        setLoadError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await PoliciesApi.update(id, {
        title: data.title,
        category: data.category,
        region: data.region,
        status: data.status,
        version: data.newVersion,
        effectiveDate: data.effectiveDate,
        summary: data.summary,
        content: data.content,
      })
      router.push(`/policies/${id}`)
    } catch (e: any) {
      setError('root', { message: e.message })
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
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
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
            <Alert variant="error">{loadError}</Alert>
          </Card>
        </div>
      </>
    )
  }

  const versions = getNextVersions(policy.version)

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
          {errors.root && (
            <Alert variant="error" className="mb-6" onDismiss={() => setError('root', { message: '' })}>
              {errors.root.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Info */}
            <FormSection title="Policy Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <FormField
                    label="Policy Title"
                    required
                    error={errors.title?.message}
                    {...register('title')}
                  />
                </div>

                <SelectField
                  label="Category"
                  required
                  options={[...POLICY_CATEGORY_OPTIONS]}
                  error={errors.category?.message}
                  {...register('category')}
                />

                <SelectField
                  label="Region"
                  required
                  options={[...POLICY_REGION_OPTIONS]}
                  error={errors.region?.message}
                  disabled={category === 'CONDUCT'}
                  {...register('region')}
                />

                <SelectField
                  label="Status"
                  required
                  options={[...POLICY_STATUS_OPTIONS]}
                  error={errors.status?.message}
                  {...register('status')}
                />

                <FormField label="Current Version" name="currentVersion">
                  <div className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-muted-foreground">
                    v{policy.version}
                  </div>
                </FormField>

                <SelectField
                  label="New Version"
                  required
                  placeholder="Select new version..."
                  options={[
                    { value: versions.minor, label: `v${versions.minor} (Minor update)` },
                    { value: versions.major, label: `v${versions.major} (Major update)` },
                  ]}
                  error={errors.newVersion?.message}
                  {...register('newVersion')}
                />

                <FormField
                  label="Effective Date"
                  type="date"
                  {...register('effectiveDate')}
                />
              </div>
            </FormSection>

            <CardDivider />

            {/* Summary */}
            <FormSection title="Summary" description="Brief overview of the policy">
              <TextareaField
                label="Summary"
                rows={3}
                resizable={false}
                placeholder="A brief summary of what this policy covers..."
                {...register('summary')}
              />
            </FormSection>

            <CardDivider />

            {/* Content */}
            <FormSection title="Policy Content" description="Full policy text">
              <TextareaField
                label="Content"
                rows={16}
                monospace
                resizable={false}
                placeholder="Full policy content..."
                {...register('content')}
              />
            </FormSection>

            {/* Actions */}
            <FormActions>
              <Button type="button" variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
