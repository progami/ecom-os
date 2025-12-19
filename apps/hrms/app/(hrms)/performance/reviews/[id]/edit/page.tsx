'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PerformanceReviewsApi, type PerformanceReview } from '@/lib/api-client'
import { ClipboardDocumentCheckIcon, StarIcon, StarFilledIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'
import {
  FormField,
  SelectField,
  TextareaField,
} from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'

const reviewTypeOptions = [
  { value: 'PROBATION', label: 'Probation (90-day)' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'PIP', label: 'Performance Improvement Plan' },
]

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  DRAFT: 'Draft',
  PENDING_HR_REVIEW: 'Pending HR Review',
  PENDING_SUPER_ADMIN: 'Pending Admin Approval',
  PENDING_ACKNOWLEDGMENT: 'Pending Acknowledgment',
  ACKNOWLEDGED: 'Acknowledged',
  COMPLETED: 'Completed',
}

function RatingInput({ name, label, value, onChange, required = false }: {
  name: string
  label: string
  value: number
  onChange: (v: number) => void
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform"
          >
            {star <= value ? (
              <StarFilledIcon className="h-6 w-6 text-amber-400" />
            ) : (
              <StarIcon className="h-6 w-6 text-gray-300 hover:text-amber-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-500">{value}/5</span>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  )
}

export default function EditReviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { goBack } = useNavigationHistory()

  const [review, setReview] = useState<PerformanceReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Rating states
  const [overallRating, setOverallRating] = useState(3)
  const [qualityOfWork, setQualityOfWork] = useState(3)
  const [productivity, setProductivity] = useState(3)
  const [communication, setCommunication] = useState(3)
  const [teamwork, setTeamwork] = useState(3)
  const [initiative, setInitiative] = useState(3)
  const [attendance, setAttendance] = useState(3)

  useEffect(() => {
    async function load() {
      try {
        const data = await PerformanceReviewsApi.get(id)
        setReview(data)

        // Initialize rating states from loaded data
        setOverallRating(data.overallRating || 3)
        setQualityOfWork(data.qualityOfWork || 3)
        setProductivity(data.productivity || 3)
        setCommunication(data.communication || 3)
        setTeamwork(data.teamwork || 3)
        setInitiative(data.initiative || 3)
        setAttendance(data.attendance || 3)

        // Auto-start review if NOT_STARTED
        if (data.status === 'NOT_STARTED') {
          try {
            const started = await PerformanceReviewsApi.start(id)
            setReview(started)
            setSuccessMessage('Review started. Fill in the ratings and feedback below.')
          } catch (e: any) {
            console.error('Failed to auto-start review:', e)
            // Non-fatal - continue with editing
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load review')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Check if review is editable
  const isEditable = review && ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT'].includes(review.status)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isEditable) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      const updated = await PerformanceReviewsApi.update(id, {
        reviewType: String(payload.reviewType),
        reviewPeriod: String(payload.reviewPeriod),
        reviewDate: String(payload.reviewDate),
        overallRating: parseInt(payload.overallRating, 10),
        qualityOfWork: parseInt(payload.qualityOfWork, 10),
        productivity: parseInt(payload.productivity, 10),
        communication: parseInt(payload.communication, 10),
        teamwork: parseInt(payload.teamwork, 10),
        initiative: parseInt(payload.initiative, 10),
        attendance: parseInt(payload.attendance, 10),
        strengths: payload.strengths || null,
        areasToImprove: payload.areasToImprove || null,
        goals: payload.goals || null,
        comments: payload.comments || null,
      })
      setReview(updated)
      setSuccessMessage('Review saved as draft')
    } catch (e: any) {
      setError(e.message || 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!isEditable) return

    // First save the current form state
    const form = document.querySelector('form') as HTMLFormElement
    const fd = new FormData(form)
    const payload = Object.fromEntries(fd.entries()) as any

    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Save first
      await PerformanceReviewsApi.update(id, {
        reviewType: String(payload.reviewType),
        reviewPeriod: String(payload.reviewPeriod),
        reviewDate: String(payload.reviewDate),
        overallRating: parseInt(payload.overallRating, 10),
        qualityOfWork: parseInt(payload.qualityOfWork, 10),
        productivity: parseInt(payload.productivity, 10),
        communication: parseInt(payload.communication, 10),
        teamwork: parseInt(payload.teamwork, 10),
        initiative: parseInt(payload.initiative, 10),
        attendance: parseInt(payload.attendance, 10),
        strengths: payload.strengths || null,
        areasToImprove: payload.areasToImprove || null,
        goals: payload.goals || null,
        comments: payload.comments || null,
      })

      // Then submit for review
      await PerformanceReviewsApi.submit(id)
      router.push('/performance/reviews')
    } catch (e: any) {
      // Show validation errors if present
      if (e.details && Array.isArray(e.details)) {
        setError(e.details.join(', '))
      } else {
        setError(e.message || 'Failed to submit review')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Edit Performance Review"
          description="Loading..."
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          </Card>
        </div>
      </>
    )
  }

  if (!review) {
    return (
      <>
        <PageHeader
          title="Edit Performance Review"
          description="Not Found"
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{error || 'Review not found'}</Alert>
          </Card>
        </div>
      </>
    )
  }

  // Non-editable state - redirect to view page
  if (!isEditable) {
    router.replace(`/performance/reviews/${id}`)
    return null
  }

  return (
    <>
      <PageHeader
        title="Edit Performance Review"
        description={`${review.employee?.firstName} ${review.employee?.lastName}`}
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl space-y-6">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        <form onSubmit={handleSave}>
          {/* Employee Info Card */}
          <Card padding="lg" className="mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {review.employee?.firstName} {review.employee?.lastName}
                </h2>
                <p className="text-sm text-gray-500">
                  {review.employee?.position} • {review.employee?.department}
                </p>
              </div>
              <StatusBadge status={STATUS_LABELS[review.status] || review.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Review Type"
                name="reviewType"
                required
                options={reviewTypeOptions}
                defaultValue={review.reviewType}
              />
              <FormField
                label="Review Period"
                name="reviewPeriod"
                required
                placeholder="e.g., Q4 2025"
                defaultValue={review.reviewPeriod}
                disabled={!!review.periodType}
              />
              <FormField
                label="Review Date"
                name="reviewDate"
                type="date"
                required
                defaultValue={formatDateForInput(review.reviewDate)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reviewer
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
                  {review.assignedReviewer
                    ? `${review.assignedReviewer.firstName} ${review.assignedReviewer.lastName}`
                    : review.reviewerName}
                  {review.assignedReviewer?.position && (
                    <span className="text-gray-500 ml-1">({review.assignedReviewer.position})</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Performance Ratings Card */}
          <Card padding="lg" className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Ratings</h3>

            {/* Overall Rating - Highlighted */}
            <div className="bg-amber-50 rounded-lg p-4 mb-6">
              <RatingInput
                name="overallRating"
                label="Overall Rating"
                value={overallRating}
                onChange={setOverallRating}
                required
              />
            </div>

            {/* Individual Ratings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <RatingInput
                name="qualityOfWork"
                label="Quality of Work"
                value={qualityOfWork}
                onChange={setQualityOfWork}
                required={review.reviewType === 'QUARTERLY'}
              />
              <RatingInput
                name="productivity"
                label="Productivity"
                value={productivity}
                onChange={setProductivity}
                required={review.reviewType === 'QUARTERLY'}
              />
              <RatingInput
                name="communication"
                label="Communication"
                value={communication}
                onChange={setCommunication}
                required={review.reviewType === 'QUARTERLY'}
              />
              <RatingInput
                name="teamwork"
                label="Teamwork"
                value={teamwork}
                onChange={setTeamwork}
                required={review.reviewType === 'QUARTERLY'}
              />
              <RatingInput
                name="initiative"
                label="Initiative"
                value={initiative}
                onChange={setInitiative}
                required={review.reviewType === 'QUARTERLY'}
              />
              <RatingInput
                name="attendance"
                label="Attendance"
                value={attendance}
                onChange={setAttendance}
                required={review.reviewType === 'QUARTERLY'}
              />
            </div>
          </Card>

          {/* Feedback Card */}
          <Card padding="lg" className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Feedback</h3>
            <div className="space-y-4">
              <TextareaField
                label="Strengths"
                name="strengths"
                rows={3}
                placeholder="Key strengths demonstrated..."
                defaultValue={review.strengths || ''}
              />
              <TextareaField
                label="Areas to Improve"
                name="areasToImprove"
                rows={3}
                placeholder="Areas that need development..."
                defaultValue={review.areasToImprove || ''}
              />
              <TextareaField
                label="Goals for Next Period"
                name="goals"
                rows={3}
                placeholder="Objectives and targets..."
                defaultValue={review.goals || ''}
              />
              <TextareaField
                label="Additional Comments"
                name="comments"
                rows={3}
                placeholder="Any other observations..."
                defaultValue={review.comments || ''}
              />
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={goBack}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={saving}>
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              loading={submitting}
            >
              Submit for Review
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
