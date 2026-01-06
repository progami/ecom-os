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

function RatingInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  error?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-1 mt-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform"
          >
            {star <= value ? (
              <StarFilledIcon className="h-6 w-6 text-warning-400" />
            ) : (
              <StarIcon className="h-6 w-6 text-muted-foreground/50 hover:text-warning-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
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
  const overallRating = watch('overallRating') ?? 3
  const qualityOfWork = watch('qualityOfWork') ?? 3
  const productivity = watch('productivity') ?? 3
  const communication = watch('communication') ?? 3
  const teamwork = watch('teamwork') ?? 3
  const initiative = watch('initiative') ?? 3
  const attendance = watch('attendance') ?? 3

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
        <form onSubmit={handleSubmit(onSubmit)} className="py-6 space-y-6">
          {errors.root && (
            <Alert variant="error" onDismiss={() => setError('root', { message: '' })}>
              {errors.root.message}
            </Alert>
          )}

          {/* Employee Selection */}
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

          {/* Role & Review Type */}
          <div className="grid grid-cols-2 gap-6">
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
          </div>

          {/* Period & Year */}
          <div className="grid grid-cols-2 gap-6">
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

          {/* Review Date & Manager */}
          <div className="grid grid-cols-2 gap-6">
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
              <Label htmlFor="assignedReviewerId">Manager</Label>
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
          </div>

          {/* Status */}
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

          {/* Ratings Section */}
          <div className="pt-6 border-t border-border">
            <h2 className="text-sm font-medium text-foreground mb-4">Performance Ratings</h2>
            <p className="text-xs text-muted-foreground mb-4">Rate the employee on a scale of 1-5</p>

            <div className="space-y-4">
              <RatingInput
                label="Overall Rating"
                value={overallRating}
                onChange={(v) => setValue('overallRating', v)}
                error={errors.overallRating?.message}
              />

              <div className="grid grid-cols-2 gap-4">
                <RatingInput
                  label="Quality of Work"
                  value={qualityOfWork}
                  onChange={(v) => setValue('qualityOfWork', v)}
                  error={errors.qualityOfWork?.message}
                />
                <RatingInput
                  label="Productivity"
                  value={productivity}
                  onChange={(v) => setValue('productivity', v)}
                  error={errors.productivity?.message}
                />
                <RatingInput
                  label="Communication"
                  value={communication}
                  onChange={(v) => setValue('communication', v)}
                  error={errors.communication?.message}
                />
                <RatingInput
                  label="Teamwork"
                  value={teamwork}
                  onChange={(v) => setValue('teamwork', v)}
                  error={errors.teamwork?.message}
                />
                <RatingInput
                  label="Initiative"
                  value={initiative}
                  onChange={(v) => setValue('initiative', v)}
                  error={errors.initiative?.message}
                />
                <RatingInput
                  label="Attendance"
                  value={attendance}
                  onChange={(v) => setValue('attendance', v)}
                  error={errors.attendance?.message}
                />
              </div>
            </div>
          </div>

          {/* Feedback Section */}
          <div className="pt-6 border-t border-border">
            <h2 className="text-sm font-medium text-foreground mb-4">Feedback</h2>
            <p className="text-xs text-muted-foreground mb-4">Detailed comments and goals</p>

            <div className="space-y-4">
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
            </div>
          </div>

          {/* Actions */}
          <div className="pt-6 border-t border-border flex justify-end gap-3">
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
