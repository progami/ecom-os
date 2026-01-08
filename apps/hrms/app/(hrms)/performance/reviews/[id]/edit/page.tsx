'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ApiError,
  MeApi,
  PerformanceReviewsApi,
  type Me,
  type PerformanceReview,
} from '@/lib/api-client'
import {
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  StarIcon,
  StarFilledIcon,
  UserIcon,
} from '@/components/ui/Icons'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  REVIEW_PERIOD_TYPES,
  REVIEW_PERIOD_TYPE_LABELS,
  getAllowedReviewPeriodTypes,
  inferReviewPeriodParts,
} from '@/lib/review-period'
import { UpdatePerformanceReviewSchema } from '@/lib/validations'

type FormData = z.infer<typeof UpdatePerformanceReviewSchema>

const REVIEW_TYPES = [
  { value: 'PROBATION', label: 'Probation (90-day)' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
]

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  DRAFT: 'Draft',
  PENDING_HR_REVIEW: 'Pending HR Review',
  PENDING_ACKNOWLEDGMENT: 'Pending Acknowledgment',
  ACKNOWLEDGED: 'Acknowledged',
  COMPLETED: 'Completed',
}

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
  disabled = false,
  error,
}: {
  label: string
  description?: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
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
            onClick={() => !disabled && onChange(star)}
            disabled={disabled}
            className={cn(
              'p-0.5 transition-transform',
              disabled ? 'opacity-60 cursor-not-allowed' : 'hover:scale-110'
            )}
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

export default function EditReviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const currentYear = new Date().getFullYear()

  const [review, setReview] = useState<PerformanceReview | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('details')

  const periodYearOptions = Array.from({ length: 8 }, (_, idx) => currentYear - 5 + idx)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<FormData>({
    resolver: zodResolver(UpdatePerformanceReviewSchema),
    defaultValues: {
      reviewType: 'ANNUAL',
      periodType: 'ANNUAL',
      periodYear: currentYear,
      overallRating: 3,
      qualityOfWork: 3,
      productivity: 3,
      communication: 3,
      teamwork: 3,
      initiative: 3,
      attendance: 3,
    },
  })

  const reviewType = watch('reviewType') ?? 'ANNUAL'
  const periodType = watch('periodType') ?? 'ANNUAL'
  const ratings = {
    overallRating: watch('overallRating') ?? 3,
    qualityOfWork: watch('qualityOfWork') ?? 3,
    productivity: watch('productivity') ?? 3,
    communication: watch('communication') ?? 3,
    teamwork: watch('teamwork') ?? 3,
    initiative: watch('initiative') ?? 3,
    attendance: watch('attendance') ?? 3,
  }

  useEffect(() => {
    async function load() {
      try {
        const [data, meData] = await Promise.all([
          PerformanceReviewsApi.get(id),
          MeApi.get().catch(() => null),
        ])
        setReview(data)
        setMe(meData)

        const inferredPeriod = inferReviewPeriodParts(data.reviewPeriod)
        const formPeriodType = data.periodType || inferredPeriod.periodType || 'ANNUAL'
        const formPeriodYear = data.periodYear ?? inferredPeriod.periodYear ?? currentYear

        reset({
          reviewType: (data.reviewType || 'ANNUAL') as 'PROBATION' | 'QUARTERLY' | 'ANNUAL',
          periodType: formPeriodType as any,
          periodYear: formPeriodYear,
          reviewDate: data.reviewDate ? new Date(data.reviewDate).toISOString().split('T')[0] : '',
          roleTitle: data.roleTitle || data.employee?.position || '',
          overallRating: data.overallRating || 3,
          qualityOfWork: data.qualityOfWork || 3,
          productivity: data.productivity || 3,
          communication: data.communication || 3,
          teamwork: data.teamwork || 3,
          initiative: data.initiative || 3,
          attendance: data.attendance || 3,
          strengths: data.strengths || '',
          areasToImprove: data.areasToImprove || '',
          goals: data.goals || '',
          comments: data.comments || '',
        })

        if (data.status === 'NOT_STARTED') {
          try {
            const started = await PerformanceReviewsApi.start(id)
            setReview(started)
            setSuccessMessage('Review started. Fill in the ratings and feedback below.')
          } catch (e: any) {
            console.error('Failed to auto-start review:', e)
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load review')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, currentYear, reset])

  useEffect(() => {
    const allowedTypes = getAllowedReviewPeriodTypes(reviewType)
    if (!allowedTypes.includes(periodType as any)) {
      setValue('periodType', allowedTypes[0] as any)
    }
  }, [reviewType, periodType, setValue])

  const isDraft = Boolean(
    review && ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT'].includes(review.status)
  )
  const isHrOrAdmin = Boolean(me?.isHR || me?.isSuperAdmin)
  const canEditMeta = Boolean(review) && (isDraft || isHrOrAdmin)
  const canEditContent = isDraft

  const detailsHasErrors = Boolean(
    errors.reviewType || errors.periodType || errors.periodYear ||
    errors.reviewDate || errors.roleTitle
  )
  const ratingsHasErrors = Boolean(
    errors.overallRating || errors.qualityOfWork || errors.productivity ||
    errors.communication || errors.teamwork || errors.initiative || errors.attendance
  )

  async function onSave(data: FormData) {
    if (!review || !canEditMeta) return

    setError(null)
    setSuccessMessage(null)

    try {
      const update: Record<string, unknown> = {}

      if (canEditMeta) {
        update.reviewType = data.reviewType
        update.periodType = data.periodType
        update.periodYear = data.periodYear
        update.reviewDate = data.reviewDate
        update.roleTitle = data.roleTitle
      }

      if (canEditContent) {
        update.overallRating = data.overallRating
        update.qualityOfWork = data.qualityOfWork
        update.productivity = data.productivity
        update.communication = data.communication
        update.teamwork = data.teamwork
        update.initiative = data.initiative
        update.attendance = data.attendance
        update.strengths = data.strengths || null
        update.areasToImprove = data.areasToImprove || null
        update.goals = data.goals || null
        update.comments = data.comments || null
      }

      const updated = await PerformanceReviewsApi.update(id, update)
      setReview(updated)
      setSuccessMessage(canEditContent ? 'Review saved as draft' : 'Review metadata updated')
    } catch (e: any) {
      setError(e.message || 'Failed to save review')
    }
  }

  async function handleSubmitForReview() {
    if (!review || !canEditContent) return

    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const formValues = watch()
      await PerformanceReviewsApi.update(id, {
        reviewType: formValues.reviewType,
        periodType: formValues.periodType,
        periodYear: formValues.periodYear,
        reviewDate: formValues.reviewDate,
        roleTitle: formValues.roleTitle,
        overallRating: formValues.overallRating,
        qualityOfWork: formValues.qualityOfWork,
        productivity: formValues.productivity,
        communication: formValues.communication,
        teamwork: formValues.teamwork,
        initiative: formValues.initiative,
        attendance: formValues.attendance,
        strengths: formValues.strengths || null,
        areasToImprove: formValues.areasToImprove || null,
        goals: formValues.goals || null,
        comments: formValues.comments || null,
      })

      await PerformanceReviewsApi.submit(id)
      router.push('/performance/reviews')
    } catch (e: any) {
      if (e instanceof ApiError && Array.isArray(e.body?.details)) {
        const details = e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim())
        setError(
          details.length
            ? details.join(', ')
            : e.body?.error || e.message || 'Failed to submit review'
        )
        return
      }
      setError(e.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const allowedPeriodTypes = getAllowedReviewPeriodTypes(reviewType)
  const periodTypeOptions = REVIEW_PERIOD_TYPES
    .filter((type) => allowedPeriodTypes.includes(type as any))
    .map((type) => ({ value: type, label: REVIEW_PERIOD_TYPE_LABELS[type] }))

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

  if (!review) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <Alert variant="error">{error || 'Review not found'}</Alert>
          <div className="mt-4">
            <Button variant="secondary" href="/performance/reviews">Back to Reviews</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!canEditMeta) {
    router.replace(`/performance/reviews/${id}`)
    return null
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
        {/* Header with employee info */}
        <div className="flex items-start gap-3 pb-6 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {review.employee?.firstName} {review.employee?.lastName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {review.employee?.position} • {review.employee?.department}
                </p>
              </div>
              <StatusBadge status={STATUS_LABELS[review.status] || review.status} />
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="pt-6 space-y-4">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {!canEditContent && (
            <Alert variant="info">
              This review is in workflow stage ({STATUS_LABELS[review.status] || review.status}).
              You can update metadata, but ratings and feedback are read-only.
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSave)} className="pt-6">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reviewType">Review Type</Label>
                  <NativeSelect
                    {...register('reviewType')}
                    disabled={!canEditMeta}
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
                  <Label htmlFor="periodType">Review Period</Label>
                  <NativeSelect
                    {...register('periodType')}
                    disabled={!canEditMeta}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodYear">Year</Label>
                  <NativeSelect
                    {...register('periodYear')}
                    disabled={!canEditMeta}
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
                <div>
                  <Label htmlFor="reviewDate">Review Date</Label>
                  <Input
                    {...register('reviewDate')}
                    type="date"
                    disabled={!canEditMeta}
                    className={cn('mt-1.5', errors.reviewDate && 'border-destructive')}
                  />
                  {errors.reviewDate && (
                    <p className="text-xs text-destructive mt-1">{errors.reviewDate.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="roleTitle">Role</Label>
                <Input
                  {...register('roleTitle')}
                  placeholder="Employee's role"
                  disabled={!canEditMeta}
                  className={cn('mt-1.5', errors.roleTitle && 'border-destructive')}
                />
                {errors.roleTitle && (
                  <p className="text-xs text-destructive mt-1">{errors.roleTitle.message}</p>
                )}
              </div>

              <div>
                <Label>Manager / Reviewer</Label>
                <div className="mt-1.5 px-3 py-2 bg-muted border border-border rounded-md text-sm text-foreground">
                  {review.assignedReviewer
                    ? `${review.assignedReviewer.firstName} ${review.assignedReviewer.lastName}`
                    : review.reviewerName || '—'}
                  {review.assignedReviewer?.position && (
                    <span className="text-muted-foreground ml-1">
                      ({review.assignedReviewer.position})
                    </span>
                  )}
                </div>
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
                    disabled={!canEditContent}
                    error={errors[field.key]?.message}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {canEditContent
                  ? 'Click stars to rate from 1 (lowest) to 5 (highest)'
                  : 'Ratings are read-only in this workflow stage'}
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
                  disabled={!canEditContent}
                  className="mt-1.5 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="areasToImprove">Areas to Improve</Label>
                <Textarea
                  {...register('areasToImprove')}
                  rows={3}
                  placeholder="Areas that need development..."
                  disabled={!canEditContent}
                  className="mt-1.5 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="goals">Goals for Next Period</Label>
                <Textarea
                  {...register('goals')}
                  rows={3}
                  placeholder="Objectives and targets..."
                  disabled={!canEditContent}
                  className="mt-1.5 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="comments">Additional Comments</Label>
                <Textarea
                  {...register('comments')}
                  rows={3}
                  placeholder="Any other observations..."
                  disabled={!canEditContent}
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
            <Button type="submit" variant="secondary" loading={isSaving}>
              {canEditContent ? 'Save Draft' : 'Save Changes'}
            </Button>
            {canEditContent && (
              <Button type="button" onClick={handleSubmitForReview} loading={submitting}>
                Submit for Review
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
