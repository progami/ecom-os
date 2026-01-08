'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'
import { executeAction } from '@/lib/actions/execute-action'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline'
import {
  ArrowLeftIcon,
  StarIcon,
  StarFilledIcon,
  UserIcon,
} from '@/components/ui/Icons'
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

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
    <div className="group relative flex items-center justify-between py-4 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30 -mx-4 px-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-1 ml-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !disabled && onChange(star)}
            disabled={disabled}
            className={cn(
              'p-1 rounded-full transition-all duration-150',
              disabled
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:scale-110 hover:bg-warning/10 active:scale-95'
            )}
          >
            {star <= value ? (
              <StarFilledIcon className="h-5 w-5 text-warning" />
            ) : (
              <StarIcon className={cn(
                'h-5 w-5 transition-colors',
                disabled ? 'text-muted' : 'text-muted-foreground/30 group-hover:text-warning/50'
              )} />
            )}
          </button>
        ))}
        <span className={cn(
          'ml-3 text-sm font-semibold min-w-[2.5rem] text-right tabular-nums',
          value >= 4 ? 'text-success' : value >= 3 ? 'text-foreground' : 'text-warning'
        )}>
          {value}/5
        </span>
      </div>
    </div>
  )
}

function RatingDisplay({ label, value }: { label: string; value: number | null | undefined }) {
  const hasRating = value != null && value > 0
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {hasRating ? (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarFilledIcon
              key={star}
              className={cn('h-4 w-4', star <= (value ?? 0) ? 'text-warning' : 'text-muted')}
            />
          ))}
          <span className={cn(
            'ml-2 text-sm font-semibold tabular-nums',
            (value ?? 0) >= 4 ? 'text-success' : (value ?? 0) >= 3 ? 'text-foreground' : 'text-warning'
          )}>
            {value}/5
          </span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground italic">Not rated</span>
      )}
    </div>
  )
}

export default function PerformanceReviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const currentYear = new Date().getFullYear()

  const [dto, setDto] = useState<WorkflowRecordDTO | null>(null)
  const [review, setReview] = useState<PerformanceReview | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetails(null)

    try {
      const [workflow, raw, meData] = await Promise.all([
        PerformanceReviewsApi.getWorkflowRecord(id),
        PerformanceReviewsApi.get(id),
        MeApi.get().catch(() => null),
      ])
      setDto(workflow)
      setReview(raw)
      setMe(meData)

      // Initialize form with review data
      const inferredPeriod = inferReviewPeriodParts(raw.reviewPeriod)
      const formPeriodType = raw.periodType || inferredPeriod.periodType || 'ANNUAL'
      const formPeriodYear = raw.periodYear ?? inferredPeriod.periodYear ?? currentYear

      reset({
        reviewType: (raw.reviewType || 'ANNUAL') as 'PROBATION' | 'QUARTERLY' | 'ANNUAL',
        periodType: formPeriodType as any,
        periodYear: formPeriodYear,
        reviewDate: raw.reviewDate ? new Date(raw.reviewDate).toISOString().split('T')[0] : '',
        roleTitle: raw.roleTitle || raw.employee?.position || '',
        overallRating: raw.overallRating || 3,
        qualityOfWork: raw.qualityOfWork || 3,
        productivity: raw.productivity || 3,
        communication: raw.communication || 3,
        teamwork: raw.teamwork || 3,
        initiative: raw.initiative || 3,
        attendance: raw.attendance || 3,
        strengths: raw.strengths || '',
        areasToImprove: raw.areasToImprove || '',
        goals: raw.goals || '',
        comments: raw.comments || '',
      })

      // Auto-start if NOT_STARTED
      if (raw.status === 'NOT_STARTED') {
        try {
          const started = await PerformanceReviewsApi.start(id)
          setReview(started)
          setSuccessMessage('Review started. Fill in the ratings and feedback below.')
        } catch (e) {
          console.error('Failed to auto-start review:', e)
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load performance review'
      setError(message)
      setDto(null)
      setReview(null)
    } finally {
      setLoading(false)
    }
  }, [id, currentYear, reset])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const allowedTypes = getAllowedReviewPeriodTypes(reviewType)
    if (!allowedTypes.includes(periodType as any)) {
      setValue('periodType', allowedTypes[0] as any)
    }
  }, [reviewType, periodType, setValue])

  // Permissions
  const isDraft = useMemo(() => {
    return Boolean(review && ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT'].includes(review.status))
  }, [review])

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

  // Workflow actions
  const onAction = useCallback(
    async (actionId: ActionId) => {
      setError(null)
      setErrorDetails(null)
      try {
        await executeAction(actionId, { type: 'PERFORMANCE_REVIEW', id })
        await load()
      } catch (e) {
        if (e instanceof ApiError && Array.isArray(e.body?.details)) {
          setError(e.body?.error || 'Validation failed')
          setErrorDetails(e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim()))
          return
        }
        const message = e instanceof Error ? e.message : 'Failed to complete action'
        setError(message)
      }
    },
    [id, load]
  )

  // Save draft
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

  // Submit for review
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

  // Workflow stages and timeline
  const stages = dto?.workflow?.stages ?? []
  const timeline = dto?.timeline ?? []
  const actions = dto?.actions ?? { primary: null, secondary: [], more: [] }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link
          href="/performance/reviews"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Reviews
        </Link>
        <Card padding="lg">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
            <div className="h-10 bg-muted rounded" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </Card>
      </div>
    )
  }

  if (!dto || !review) {
    return (
      <div className="space-y-6">
        <Link
          href="/performance/reviews"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Reviews
        </Link>
        <Card padding="lg">
          <p className="text-sm font-medium text-foreground">Performance review</p>
          <p className="text-sm text-muted-foreground mt-1">{error ?? 'Not found'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/performance/reviews"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Reviews
      </Link>

      {/* Alerts */}
      {error && (
        <Alert
          variant="error"
          title={errorDetails?.length ? error : undefined}
          onDismiss={() => {
            setError(null)
            setErrorDetails(null)
          }}
        >
          {errorDetails?.length ? (
            <ul className="list-disc pl-5 space-y-1">
              {errorDetails.map((d, idx) => (
                <li key={`${idx}:${d}`}>{d}</li>
              ))}
            </ul>
          ) : (
            error
          )}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <Card padding="lg">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 ring-2 ring-accent/20">
                <UserIcon className="h-7 w-7 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-semibold text-foreground">
                      {review.employee?.firstName} {review.employee?.lastName}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {review.employee?.position}
                      {review.employee?.department && ` • ${review.employee.department}`}
                    </p>
                  </div>
                  <StatusBadge status={STATUS_LABELS[review.status] || review.status} />
                </div>

                {/* Workflow stages */}
                {stages.length > 0 && (
                  <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
                    {stages.map((stage, idx) => (
                      <div key={stage.id ?? idx} className="flex items-center gap-2">
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            stage.status === 'completed' && 'bg-success',
                            stage.status === 'current' && 'bg-accent',
                            stage.status === 'upcoming' && 'bg-border'
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs whitespace-nowrap',
                            stage.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                          )}
                        >
                          {stage.label}
                        </span>
                        {idx < stages.length - 1 && <div className="w-6 h-px bg-border" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Content - Edit mode or View mode */}
          {canEditMeta ? (
            /* Edit Mode */
            <form onSubmit={handleSubmit(onSave)}>
              <Card padding="lg">
                {!canEditContent && (
                  <Alert variant="info" className="mb-6">
                    This review is in workflow ({STATUS_LABELS[review.status] || review.status}).
                    You can update metadata, but ratings and feedback are read-only.
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
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                  </TabsList>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reviewType">Review Type</Label>
                        <NativeSelect
                          {...register('reviewType')}
                          disabled={!canEditMeta}
                          className={cn(errors.reviewType && 'border-destructive')}
                        >
                          {REVIEW_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </NativeSelect>
                        {errors.reviewType && (
                          <p className="text-xs text-destructive">{errors.reviewType.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="periodType">Period</Label>
                        <NativeSelect
                          {...register('periodType')}
                          disabled={!canEditMeta}
                          className={cn(errors.periodType && 'border-destructive')}
                        >
                          {periodTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </NativeSelect>
                        {errors.periodType && (
                          <p className="text-xs text-destructive">{errors.periodType.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="periodYear">Year</Label>
                        <NativeSelect
                          {...register('periodYear')}
                          disabled={!canEditMeta}
                          className={cn(errors.periodYear && 'border-destructive')}
                        >
                          {periodYearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </NativeSelect>
                        {errors.periodYear && (
                          <p className="text-xs text-destructive">{errors.periodYear.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reviewDate">Review Date</Label>
                        <Input
                          {...register('reviewDate')}
                          type="date"
                          disabled={!canEditMeta}
                          className={cn(errors.reviewDate && 'border-destructive')}
                        />
                        {errors.reviewDate && (
                          <p className="text-xs text-destructive">{errors.reviewDate.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="roleTitle">Role</Label>
                      <Input
                        {...register('roleTitle')}
                        placeholder="Employee's role at time of review"
                        disabled={!canEditMeta}
                        className={cn(errors.roleTitle && 'border-destructive')}
                      />
                      {errors.roleTitle && (
                        <p className="text-xs text-destructive">{errors.roleTitle.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Manager / Reviewer</Label>
                      <div className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground">
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
                    <div className="space-y-1">
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
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      {canEditContent
                        ? 'Click stars to rate from 1 (lowest) to 5 (highest)'
                        : 'Ratings are read-only in this workflow stage'}
                    </p>
                  </TabsContent>

                  {/* Feedback Tab */}
                  <TabsContent value="feedback" className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="strengths">Strengths</Label>
                      <Textarea
                        {...register('strengths')}
                        rows={3}
                        placeholder="Key strengths demonstrated during this period..."
                        disabled={!canEditContent}
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="areasToImprove">Areas to Improve</Label>
                      <Textarea
                        {...register('areasToImprove')}
                        rows={3}
                        placeholder="Areas that need development or improvement..."
                        disabled={!canEditContent}
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goals">Goals for Next Period</Label>
                      <Textarea
                        {...register('goals')}
                        rows={3}
                        placeholder="Objectives and targets for the upcoming period..."
                        disabled={!canEditContent}
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="comments">Additional Comments</Label>
                      <Textarea
                        {...register('comments')}
                        rows={3}
                        placeholder="Any other observations or notes..."
                        disabled={!canEditContent}
                        className="resize-none"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Form actions */}
                <div className="pt-6 mt-6 border-t border-border flex items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground">
                    {canEditContent ? 'Changes are saved as draft until submitted' : 'Limited editing available'}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" variant="secondary" loading={isSaving}>
                      {canEditContent ? 'Save Draft' : 'Save Changes'}
                    </Button>
                    {canEditContent && (
                      <Button type="button" onClick={handleSubmitForReview} loading={submitting}>
                        Submit for Review
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </form>
          ) : (
            /* View Mode - when user cannot edit */
            <div className="space-y-6">
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-4">Review Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Review Type</p>
                    <p className="text-foreground">{review.reviewType?.replaceAll('_', ' ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Period</p>
                    <p className="text-foreground">{review.reviewPeriod || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Role</p>
                    <p className="text-foreground">{review.roleTitle || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Review Date</p>
                    <p className="text-foreground">{formatDate(review.reviewDate)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Manager</p>
                    <p className="text-foreground">
                      {review.assignedReviewer
                        ? `${review.assignedReviewer.firstName} ${review.assignedReviewer.lastName}${review.assignedReviewer.position ? ` (${review.assignedReviewer.position})` : ''}`
                        : review.reviewerName || '—'}
                    </p>
                  </div>
                </div>
              </Card>

              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-4">Ratings</h3>
                <div className="space-y-1">
                  <RatingDisplay label="Overall Rating" value={review.overallRating} />
                  <RatingDisplay label="Quality of Work" value={review.qualityOfWork} />
                  <RatingDisplay label="Productivity" value={review.productivity} />
                  <RatingDisplay label="Communication" value={review.communication} />
                  <RatingDisplay label="Teamwork" value={review.teamwork} />
                  <RatingDisplay label="Initiative" value={review.initiative} />
                  <RatingDisplay label="Attendance" value={review.attendance} />
                </div>
              </Card>

              {(review.strengths || review.areasToImprove || review.goals || review.comments) && (
                <Card padding="lg">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Feedback</h3>
                  <div className="space-y-4">
                    {review.strengths && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Strengths</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{review.strengths}</p>
                      </div>
                    )}
                    {review.areasToImprove && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Areas to Improve</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{review.areasToImprove}</p>
                      </div>
                    )}
                    {review.goals && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Goals</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{review.goals}</p>
                      </div>
                    )}
                    {review.comments && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Comments</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{review.comments}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Workflow actions for view mode */}
              {(actions.primary || actions.secondary.length > 0) && (
                <Card padding="md">
                  <div className="flex items-center justify-end gap-3">
                    {actions.secondary.map((action) => (
                      <Button
                        key={action.id}
                        variant={action.variant === 'danger' ? 'danger' : 'secondary'}
                        disabled={action.disabled}
                        onClick={() => onAction(action.id)}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {actions.primary && (
                      <Button
                        variant={actions.primary.variant === 'danger' ? 'danger' : 'primary'}
                        disabled={actions.primary.disabled}
                        onClick={() => onAction(actions.primary!.id)}
                      >
                        {actions.primary.label}
                      </Button>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Timeline */}
        <div className="space-y-6">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-foreground mb-4">Activity</h3>
            {timeline.length > 0 ? (
              <WorkflowTimeline items={timeline} />
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
