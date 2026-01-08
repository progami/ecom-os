'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PerformanceReviewsApi, EmployeesApi, MeApi, type Employee, type Me } from '@/lib/api-client'
import { ArrowLeftIcon, ClipboardDocumentCheckIcon, StarIcon, StarFilledIcon } from '@/components/ui/Icons'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { REVIEW_PERIOD_TYPES, REVIEW_PERIOD_TYPE_LABELS, getAllowedReviewPeriodTypes } from '@/lib/review-period'
import { CreatePerformanceReviewSchema } from '@/lib/validations'

type FormData = z.infer<typeof CreatePerformanceReviewSchema>

const REVIEW_TYPES = [
  { value: 'PROBATION', label: 'Probation (90-day)' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
]

const RATING_FIELDS = [
  { key: 'overallRating', label: 'Overall Rating', description: 'General performance assessment' },
  { key: 'qualityOfWork', label: 'Quality of Work', description: 'Accuracy and thoroughness' },
  { key: 'productivity', label: 'Productivity', description: 'Output and efficiency' },
  { key: 'communication', label: 'Communication', description: 'Written and verbal skills' },
  { key: 'teamwork', label: 'Teamwork', description: 'Collaboration with others' },
  { key: 'initiative', label: 'Initiative', description: 'Self-motivation and proactivity' },
  { key: 'attendance', label: 'Attendance', description: 'Punctuality and reliability' },
] as const

function RatingInput({
  label,
  description,
  value,
  onChange,
  error,
}: {
  label: string
  description?: string
  value: number
  onChange: (v: number) => void
  error?: string
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-0.5 hover:scale-110 transition-transform"
          >
            {star <= value ? (
              <StarFilledIcon className="h-5 w-5 text-warning-400" />
            ) : (
              <StarIcon className="h-5 w-5 text-muted-foreground/40 hover:text-warning-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-sm font-medium text-muted-foreground w-8">{value}/5</span>
      </div>
    </div>
  )
}

function AddReviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedEmployeeId = searchParams.get('employeeId')
  const currentYear = new Date().getFullYear()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(CreatePerformanceReviewSchema),
    defaultValues: {
      employeeId: preselectedEmployeeId || '',
      reviewType: 'ANNUAL',
      periodType: 'ANNUAL',
      periodYear: currentYear,
      reviewDate: new Date().toISOString().split('T')[0],
      roleTitle: '',
      assignedReviewerId: '',
      overallRating: 3,
      qualityOfWork: 3,
      productivity: 3,
      communication: 3,
      teamwork: 3,
      initiative: 3,
      attendance: 3,
      status: 'DRAFT',
    },
  })

  const reviewType = watch('reviewType')
  const periodType = watch('periodType')
  const selectedEmployeeId = watch('employeeId')
  const ratings = {
    overallRating: watch('overallRating') ?? 3,
    qualityOfWork: watch('qualityOfWork') ?? 3,
    productivity: watch('productivity') ?? 3,
    communication: watch('communication') ?? 3,
    teamwork: watch('teamwork') ?? 3,
    initiative: watch('initiative') ?? 3,
    attendance: watch('attendance') ?? 3,
  }

  const periodYearOptions = Array.from({ length: 8 }, (_, idx) => currentYear - 5 + idx)

  useEffect(() => {
    async function load() {
      try {
        const [meData, data] = await Promise.all([
          MeApi.get(),
          EmployeesApi.listManageable(),
        ])
        setMe(meData)
        setEmployees(data.items || [])
      } catch (e: any) {
        setError('root', { message: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [setError])

  useEffect(() => {
    async function hydrateRoleAndManager() {
      if (!selectedEmployeeId) return
      try {
        const e = await EmployeesApi.get(selectedEmployeeId)
        setValue('roleTitle', e.position || '')
        setValue('assignedReviewerId', e.reportsToId || '')
      } catch (err) {
        console.error('Failed to load employee details:', err)
      }
    }
    hydrateRoleAndManager()
  }, [selectedEmployeeId, setValue])

  useEffect(() => {
    const allowedTypes = getAllowedReviewPeriodTypes(reviewType)
    if (!allowedTypes.includes(periodType as any)) {
      setValue('periodType', allowedTypes[0] as any)
    }
  }, [reviewType, periodType, setValue])

  const onSubmit = async (data: FormData) => {
    try {
      await PerformanceReviewsApi.create(data)
      router.push('/performance/reviews')
    } catch (e: any) {
      setError('root', { message: e.message || 'Failed to create review' })
    }
  }

  const allowedPeriodTypes = getAllowedReviewPeriodTypes(reviewType)
  const periodTypeOptions = REVIEW_PERIOD_TYPES
    .filter((type) => allowedPeriodTypes.includes(type as any))
    .map((type) => ({ value: type, label: REVIEW_PERIOD_TYPE_LABELS[type] }))

  const canCreate = Boolean(me?.isHR || me?.isSuperAdmin || employees.length > 0)

  // Check for errors in each tab to show indicators
  const detailsHasErrors = Boolean(
    errors.employeeId || errors.reviewType || errors.periodType ||
    errors.periodYear || errors.reviewDate || errors.assignedReviewerId ||
    errors.roleTitle || errors.status
  )
  const ratingsHasErrors = Boolean(
    errors.overallRating || errors.qualityOfWork || errors.productivity ||
    errors.communication || errors.teamwork || errors.initiative || errors.attendance
  )

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

  if (!canCreate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <Alert variant="error">You do not have permission to create reviews.</Alert>
          <div className="mt-4">
            <Button variant="secondary" href="/performance/reviews">Back to Reviews</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/performance/reviews"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Reviews
      </Link>

      {/* Main card */}
      <Card padding="lg">
        {/* Header */}
        <div className="flex items-start gap-3 pb-6 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ClipboardDocumentCheckIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">New Performance Review</h1>
            <p className="text-sm text-muted-foreground">
              Create a performance review for an employee
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="pt-6">
          {errors.root && (
            <Alert variant="error" className="mb-6" onDismiss={() => setError('root', { message: '' })}>
              {errors.root.message}
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3 mb-6">
              <TabsTrigger value="details" className="relative">
                Details
                {detailsHasErrors && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="ratings" className="relative">
                Ratings
                {ratingsHasErrors && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="feedback">
                Feedback
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              <div>
                <Label htmlFor="employeeId">Employee</Label>
                <NativeSelect
                  {...register('employeeId')}
                  className={cn('mt-1.5', errors.employeeId && 'border-destructive')}
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </NativeSelect>
                {errors.employeeId && (
                  <p className="text-xs text-destructive mt-1">{errors.employeeId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reviewType">Review Type</Label>
                  <NativeSelect
                    {...register('reviewType')}
                    className={cn('mt-1.5', errors.reviewType && 'border-destructive')}
                  >
                    {REVIEW_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.reviewType && (
                    <p className="text-xs text-destructive mt-1">{errors.reviewType.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <NativeSelect
                    {...register('status')}
                    className={cn('mt-1.5', errors.status && 'border-destructive')}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.status && (
                    <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodType">Review Period</Label>
                  <NativeSelect
                    {...register('periodType')}
                    className={cn('mt-1.5', errors.periodType && 'border-destructive')}
                  >
                    {periodTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.periodType && (
                    <p className="text-xs text-destructive mt-1">{errors.periodType.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="periodYear">Year</Label>
                  <NativeSelect
                    {...register('periodYear')}
                    className={cn('mt-1.5', errors.periodYear && 'border-destructive')}
                  >
                    {periodYearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </NativeSelect>
                  {errors.periodYear && (
                    <p className="text-xs text-destructive mt-1">{errors.periodYear.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reviewDate">Review Date</Label>
                  <Input
                    {...register('reviewDate')}
                    type="date"
                    className={cn('mt-1.5', errors.reviewDate && 'border-destructive')}
                  />
                  {errors.reviewDate && (
                    <p className="text-xs text-destructive mt-1">{errors.reviewDate.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="roleTitle">Role</Label>
                  <Input
                    {...register('roleTitle')}
                    placeholder="Employee's role"
                    className={cn('mt-1.5', errors.roleTitle && 'border-destructive')}
                  />
                  {errors.roleTitle && (
                    <p className="text-xs text-destructive mt-1">{errors.roleTitle.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="assignedReviewerId">Manager / Reviewer</Label>
                <NativeSelect
                  {...register('assignedReviewerId')}
                  className={cn('mt-1.5', errors.assignedReviewerId && 'border-destructive')}
                >
                  <option value="">Select manager...</option>
                  {me && <option value={me.id}>Me ({me.employeeId})</option>}
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </NativeSelect>
                {errors.assignedReviewerId && (
                  <p className="text-xs text-destructive mt-1">{errors.assignedReviewerId.message}</p>
                )}
              </div>
            </TabsContent>

            {/* Ratings Tab */}
            <TabsContent value="ratings">
              <div className="rounded-lg border border-border">
                {RATING_FIELDS.map((field) => (
                  <RatingInput
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={ratings[field.key]}
                    onChange={(v) => setValue(field.key, v)}
                    error={errors[field.key]?.message}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Click stars to rate from 1 (lowest) to 5 (highest)
              </p>
            </TabsContent>

            {/* Feedback Tab */}
            <TabsContent value="feedback" className="space-y-4">
              <div>
                <Label htmlFor="strengths">Strengths</Label>
                <Textarea
                  {...register('strengths')}
                  rows={3}
                  placeholder="Key strengths demonstrated..."
                  className="mt-1.5 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="areasToImprove">Areas to Improve</Label>
                <Textarea
                  {...register('areasToImprove')}
                  rows={3}
                  placeholder="Areas that need development..."
                  className="mt-1.5 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="goals">Goals for Next Period</Label>
                <Textarea
                  {...register('goals')}
                  rows={3}
                  placeholder="Objectives and targets..."
                  className="mt-1.5 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="comments">Additional Comments</Label>
                <Textarea
                  {...register('comments')}
                  rows={3}
                  placeholder="Any other observations..."
                  className="mt-1.5 resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions - always visible */}
          <div className="pt-6 mt-6 border-t border-border flex justify-end gap-3">
            <Button type="button" variant="secondary" href="/performance/reviews">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save Review
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default function AddReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto">
          <Card padding="lg">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </Card>
        </div>
      }
    >
      <AddReviewContent />
    </Suspense>
  )
}
