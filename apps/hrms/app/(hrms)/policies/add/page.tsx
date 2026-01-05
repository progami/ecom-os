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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useNavigationHistory } from '@/lib/navigation-history'
import { CreatePolicySchema } from '@/lib/validations'

type FormData = z.infer<typeof CreatePolicySchema>

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
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Policy Information</h3>
                <p className="text-xs text-muted-foreground mt-1">Enter the basic details for this policy</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="title">Policy Title <span className="text-destructive">*</span></Label>
                  <Input
                    {...register('title')}
                    placeholder="e.g., Annual Leave Policy"
                    className={cn(errors.title && 'border-destructive')}
                  />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
                  <NativeSelect {...register('category')} className={cn(errors.category && 'border-destructive')}>
                    <option value="">Select category...</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Region <span className="text-destructive">*</span></Label>
                  <NativeSelect {...register('region')} className={cn(errors.region && 'border-destructive')}>
                    <option value="">Select region...</option>
                    {regionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.region && <p className="text-xs text-destructive">{errors.region.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                  <NativeSelect {...register('status')} className={cn(errors.status && 'border-destructive')}>
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.status && <p className="text-xs text-destructive">{errors.status.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    {...register('version')}
                    placeholder="e.g., 1.0"
                    className={cn(errors.version && 'border-destructive')}
                  />
                  {errors.version && <p className="text-xs text-destructive">{errors.version.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="effectiveDate">Effective Date</Label>
                  <Input
                    {...register('effectiveDate')}
                    type="date"
                    className={cn(errors.effectiveDate && 'border-destructive')}
                  />
                  {errors.effectiveDate && <p className="text-xs text-destructive">{errors.effectiveDate.message}</p>}
                </div>
              </div>
            </div>

            <CardDivider />

            {/* Summary */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                <p className="text-xs text-muted-foreground mt-1">Brief overview of the policy (1-2 sentences)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  {...register('summary')}
                  rows={3}
                  placeholder="A brief summary of what this policy covers..."
                  className={cn('resize-none', errors.summary && 'border-destructive')}
                />
                {errors.summary && <p className="text-xs text-destructive">{errors.summary.message}</p>}
              </div>
            </div>

            <CardDivider />

            {/* Content */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Policy Content</h3>
                <p className="text-xs text-muted-foreground mt-1">Full policy text. You can use markdown formatting.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  {...register('content')}
                  rows={16}
                  className={cn('font-mono', errors.content && 'border-destructive')}
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
                {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
              <Button type="button" variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Policy'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
