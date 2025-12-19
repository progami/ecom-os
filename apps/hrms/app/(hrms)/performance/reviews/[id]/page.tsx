'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PerformanceReviewsApi, type PerformanceReview } from '@/lib/api-client'
import { ClipboardDocumentCheckIcon, PencilIcon, TrashIcon, StarFilledIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'

const REVIEW_TYPE_LABELS: Record<string, string> = {
  PROBATION: 'Probation (90-day)',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  PROMOTION: 'Promotion',
  PIP: 'Performance Improvement Plan',
}

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

function RatingDisplay({ label, value }: { label: string; value: number | null | undefined }) {
  const hasRating = value != null && value > 0
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      {hasRating ? (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarFilledIcon
              key={star}
              className={`h-4 w-4 ${star <= value ? 'text-amber-400' : 'text-gray-200'}`}
            />
          ))}
          <span className="ml-2 text-sm font-medium text-gray-700">{value}/5</span>
        </div>
      ) : (
        <span className="text-sm text-gray-400">Not rated</span>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{value}</dd>
    </div>
  )
}

export default function ViewReviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [review, setReview] = useState<PerformanceReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await PerformanceReviewsApi.get(id)
        setReview(data)
      } catch (e: any) {
        setError(e.message || 'Failed to load review')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this review?')) return
    setDeleting(true)
    try {
      await PerformanceReviewsApi.delete(id)
      router.push('/performance/reviews')
    } catch (e: any) {
      setError(e.message || 'Failed to delete review')
      setDeleting(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Performance Review"
          description="Loading..."
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-6 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
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
          title="Performance Review"
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

  return (
    <>
      <PageHeader
        title="Performance Review"
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

        <Card padding="lg">
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

          <dl className="divide-y divide-gray-100">
            <DetailRow label="Review Type" value={REVIEW_TYPE_LABELS[review.reviewType] || review.reviewType} />
            <DetailRow label="Review Period" value={review.reviewPeriod} />
            <DetailRow label="Review Date" value={formatDate(review.reviewDate)} />
            <DetailRow label="Reviewer" value={review.reviewerName} />
          </dl>
        </Card>

        <Card padding="lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Ratings</h3>
          <div className="bg-amber-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Overall Rating</span>
              {review.overallRating > 0 ? (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarFilledIcon
                      key={star}
                      className={`h-6 w-6 ${star <= review.overallRating ? 'text-amber-400' : 'text-gray-200'}`}
                    />
                  ))}
                  <span className="ml-2 text-lg font-semibold text-gray-900">{review.overallRating}/5</span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Not rated</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">Feedback</h3>
            <dl className="space-y-4">
              {review.strengths && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Strengths</dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap">{review.strengths}</dd>
                </div>
              )}
              {review.areasToImprove && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Areas to Improve</dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap">{review.areasToImprove}</dd>
                </div>
              )}
              {review.goals && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Goals for Next Period</dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap">{review.goals}</dd>
                </div>
              )}
              {review.comments && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Additional Comments</dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap">{review.comments}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleDelete}
            loading={deleting}
            icon={<TrashIcon className="h-4 w-4" />}
          >
            Delete
          </Button>
          <Button
            href={`/performance/reviews/${id}/edit`}
            icon={<PencilIcon className="h-4 w-4" />}
          >
            Edit Review
          </Button>
        </div>
      </div>
    </>
  )
}
