'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PoliciesApi } from '@/lib/api-client'
import { DocumentIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormActions, FormField, FormSection, SelectField, TextareaField } from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'
import { CreatePolicySchema } from '@/lib/validations'
import { POLICY_CATEGORY_OPTIONS, POLICY_REGION_OPTIONS, POLICY_STATUS_OPTIONS } from '@/lib/domain/policy/constants'

type FormData = z.infer<typeof CreatePolicySchema>

export default function AddPolicyPage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(CreatePolicySchema),
    defaultValues: {
      version: '1.0',
      status: 'DRAFT',
    },
  })

  const onSubmit = async (data: FormData) => {
    setSubmitError(null)
    try {
      await PoliciesApi.create(data)
      router.push('/policies')
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to create policy')
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
          {submitError && (
            <Alert variant="error" className="mb-6" onDismiss={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Info */}
            <FormSection
              title="Policy Information"
              description="Enter the basic details for this policy"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FormField
                    label="Policy Title"
                    required
                    placeholder="e.g., Annual Leave Policy"
                    error={errors.title?.message}
                    {...register('title')}
                  />
                </div>

                <SelectField
                  label="Category"
                  required
                  placeholder="Select category..."
                  options={[...POLICY_CATEGORY_OPTIONS]}
                  error={errors.category?.message}
                  {...register('category')}
                />

                <SelectField
                  label="Region"
                  required
                  placeholder="Select region..."
                  options={[...POLICY_REGION_OPTIONS]}
                  error={errors.region?.message}
                  {...register('region')}
                />

                <SelectField
                  label="Status"
                  required
                  options={[...POLICY_STATUS_OPTIONS]}
                  error={errors.status?.message}
                  {...register('status')}
                />

                <FormField
                  label="Version"
                  placeholder="e.g., 1.0"
                  error={errors.version?.message}
                  {...register('version')}
                />

                <FormField
                  label="Effective Date"
                  type="date"
                  error={errors.effectiveDate?.message}
                  {...register('effectiveDate')}
                />
              </div>
            </FormSection>

            <CardDivider />

            {/* Summary */}
            <FormSection
              title="Summary"
              description="Brief overview of the policy (1-2 sentences)"
            >
              <TextareaField
                label="Summary"
                rows={3}
                resizable={false}
                placeholder="A brief summary of what this policy covers..."
                error={errors.summary?.message}
                {...register('summary')}
              />
            </FormSection>

            <CardDivider />

            {/* Content */}
            <FormSection
              title="Policy Content"
              description="Full policy text. You can use markdown formatting."
            >
              <TextareaField
                label="Content"
                rows={16}
                monospace
                resizable={false}
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
                error={errors.content?.message}
                {...register('content')}
              />
            </FormSection>

            {/* Actions */}
            <FormActions>
              <Button type="button" variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Policy'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
