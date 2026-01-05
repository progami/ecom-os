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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import { cn } from '@/lib/utils'
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
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(EditPolicySchema),
  })

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
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Policy Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="title">Policy Title <span className="text-destructive">*</span></Label>
                  <Input
                    {...register('title')}
                    className={cn(errors.title && 'border-destructive')}
                  />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
                  <NativeSelect {...register('category')} className={cn(errors.category && 'border-destructive')}>
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region <span className="text-destructive">*</span></Label>
                  <NativeSelect {...register('region')} className={cn(errors.region && 'border-destructive')}>
                    {regionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                  <NativeSelect {...register('status')} className={cn(errors.status && 'border-destructive')}>
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label>Current Version</Label>
                  <div className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-muted-foreground">
                    v{policy.version}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newVersion">New Version <span className="text-destructive">*</span></Label>
                  <NativeSelect {...register('newVersion')} className={cn(errors.newVersion && 'border-destructive')}>
                    <option value="">Select new version...</option>
                    <option value={versions.minor}>v{versions.minor} (Minor update)</option>
                    <option value={versions.major}>v{versions.major} (Major update)</option>
                  </NativeSelect>
                  {errors.newVersion && <p className="text-xs text-destructive">{errors.newVersion.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effectiveDate">Effective Date</Label>
                  <Input {...register('effectiveDate')} type="date" />
                </div>
              </div>
            </div>

            <CardDivider />

            {/* Summary */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                <p className="text-xs text-muted-foreground mt-1">Brief overview of the policy</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  {...register('summary')}
                  rows={3}
                  className="resize-none"
                  placeholder="A brief summary of what this policy covers..."
                />
              </div>
            </div>

            <CardDivider />

            {/* Content */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Policy Content</h3>
                <p className="text-xs text-muted-foreground mt-1">Full policy text</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  {...register('content')}
                  rows={16}
                  className="font-mono"
                  placeholder="Full policy content..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
              <Button type="button" variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
