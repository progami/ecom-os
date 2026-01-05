'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PerformanceReviewsApi, EmployeesApi, MeApi, type Employee, type Me } from '@/lib/api-client'
import { ClipboardDocumentCheckIcon, StarIcon, StarFilledIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  FormField,
  SelectField,
  TextareaField,
  FormSection,
  FormActions,
} from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'
import { REVIEW_PERIOD_TYPES, REVIEW_PERIOD_TYPE_LABELS, getAllowedReviewPeriodTypes } from '@/lib/review-period'
import { CreatePerformanceReviewSchema } from '@/lib/validations'

type FormData = z.infer<typeof CreatePerformanceReviewSchema>

// Simplified for small team (15-20 people)
const reviewTypeOptions = [
  { value: 'PROBATION', label: 'Probation (90-day)' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
]

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
]

const reviewPeriodTypeOptions = REVIEW_PERIOD_TYPES.map((value) => ({
  value,
  label: REVIEW_PERIOD_TYPE_LABELS[value],
}))

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
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="flex items-center gap-1">
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
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  )
}

function AddReviewForm() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const searchParams = useSearchParams()
  const preselectedEmployeeId = searchParams.get('employeeId')
  const currentYear = new Date().getFullYear()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [loadingEmployees, setLoadingEmployees] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
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

  const [error, setError] = useState<string | null>(null)
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

  const periodYearOptions = Array.from({ length: 8 }, (_, idx) => currentYear - 5 + idx).map((y) => ({
    value: String(y),
    label: String(y),
  }))

  useEffect(() => {
    async function loadEmployees() {
      try {
        const [meData, data] = await Promise.all([
          MeApi.get(),
          EmployeesApi.listManageable(),
        ])
        setMe(meData)
        setEmployees(data.items || [])
      } catch (e) {
        console.error('Failed to load manageable employees:', e)
      } finally {
        setLoadingEmployees(false)
      }
    }
    loadEmployees()
  }, [])

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

  // Update periodType when reviewType changes
  useEffect(() => {
    const allowedTypes = getAllowedReviewPeriodTypes(reviewType)
    if (!allowedTypes.includes(periodType as any)) {
      setValue('periodType', allowedTypes[0] as any)
    }
  }, [reviewType, periodType, setValue])

  async function onSubmit(data: FormData) {
    setError(null)
    try {
      await PerformanceReviewsApi.create(data)
      router.push('/performance/reviews')
    } catch (e: any) {
      setError(e.message || 'Failed to create review')
    }
  }

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeId})`,
  }))

  const managerOptions = [
    ...(me ? [{ value: me.id, label: `Me (${me.employeeId})` }] : []),
    ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeId})` })),
  ]

  const allowedPeriodTypes = getAllowedReviewPeriodTypes(reviewType)
  const periodTypeOptions = reviewPeriodTypeOptions.filter((opt) =>
    allowedPeriodTypes.includes(opt.value as any)
  )

  return (
    <Card padding="lg">
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <FormSection title="Review Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <SelectField
                label="Employee"
                required
                options={employeeOptions}
                placeholder={loadingEmployees ? 'Loading employees...' : 'Select employee...'}
                error={errors.employeeId?.message}
                {...register('employeeId')}
              />
            </div>
            <FormField
              label="Role"
              required
              error={errors.roleTitle?.message}
              {...register('roleTitle')}
            />
            <SelectField
              label="Review Type"
              required
              options={reviewTypeOptions}
              error={errors.reviewType?.message}
              {...register('reviewType')}
            />
            <SelectField
              label="Review Period"
              required
              options={periodTypeOptions}
              error={errors.periodType?.message}
              {...register('periodType')}
            />
            <SelectField
              label="Year"
              required
              options={periodYearOptions}
              error={errors.periodYear?.message}
              {...register('periodYear')}
            />
            <FormField
              label="Review Date"
              type="date"
              required
              error={errors.reviewDate?.message}
              {...register('reviewDate')}
            />
            <SelectField
              label="Manager"
              required
              options={managerOptions}
              placeholder={loadingEmployees ? 'Loading employees...' : 'Select manager...'}
              error={errors.assignedReviewerId?.message}
              {...register('assignedReviewerId')}
            />
            <SelectField
              label="Status"
              required
              options={statusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
          </div>
        </FormSection>

        <CardDivider />

        <FormSection title="Performance Ratings" description="Rate the employee on a scale of 1-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <RatingInput
                label="Overall Rating"
                value={overallRating}
                onChange={(v) => setValue('overallRating', v)}
                error={errors.overallRating?.message}
              />
            </div>
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
        </FormSection>

        <CardDivider />

        <FormSection title="Feedback" description="Detailed comments and goals">
          <div className="space-y-5">
            <TextareaField
              label="Strengths"
              rows={3}
              placeholder="Key strengths demonstrated..."
              error={errors.strengths?.message}
              {...register('strengths')}
            />
            <TextareaField
              label="Areas to Improve"
              rows={3}
              placeholder="Areas that need development..."
              error={errors.areasToImprove?.message}
              {...register('areasToImprove')}
            />
            <TextareaField
              label="Goals for Next Period"
              rows={3}
              placeholder="Objectives and targets..."
              error={errors.goals?.message}
              {...register('goals')}
            />
            <TextareaField
              label="Additional Comments"
              rows={3}
              placeholder="Any other observations..."
              error={errors.comments?.message}
              {...register('comments')}
            />
          </div>
        </FormSection>

        <FormActions>
          <Button variant="secondary" type="button" onClick={goBack}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Review'}
          </Button>
        </FormActions>
      </form>
    </Card>
  )
}

export default function AddReviewPage() {
  return (
    <>
      <PageHeader
        title="New Performance Review"
        description="Performance"
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl">
        <Suspense fallback={
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </Card>
        }>
          <AddReviewForm />
        </Suspense>
      </div>
    </>
  )
}
