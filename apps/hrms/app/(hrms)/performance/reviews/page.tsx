'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PerformanceReviewsApi, type PerformanceReview } from '@/lib/api-client'
import { ClipboardDocumentCheckIcon, PlusIcon, StarFilledIcon, ClockIcon, ExclamationTriangleIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SearchForm } from '@/components/ui/SearchForm'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

const REVIEW_TYPE_LABELS: Record<string, string> = {
  PROBATION: 'Probation',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  PROMOTION: 'Promotion',
  PIP: 'PIP',
}

function DeadlineBadge({ review }: { review: PerformanceReview }) {
  const deadline = review.deadline || (review as any).quarterlyCycle?.deadline
  if (!deadline) return null

  const now = new Date()
  const deadlineDate = new Date(deadline)
  const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  // Already completed - no badge needed
  if (review.status !== 'DRAFT') return null

  // Escalated
  if (review.escalatedToHR) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <ExclamationTriangleIcon className="h-3 w-3" />
        Escalated
      </span>
    )
  }

  // Overdue
  if (daysUntil < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <ClockIcon className="h-3 w-3" />
        {Math.abs(daysUntil)}d overdue
      </span>
    )
  }

  // Due soon (1-3 days)
  if (daysUntil <= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <ClockIcon className="h-3 w-3" />
        {daysUntil}d left
      </span>
    )
  }

  // Normal (> 3 days)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <ClockIcon className="h-3 w-3" />
      {daysUntil}d left
    </span>
  )
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending',
  COMPLETED: 'Completed',
  ACKNOWLEDGED: 'Acknowledged',
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarFilledIcon
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
          <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded w-20" /></td>
          <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded w-20" /></td>
        </tr>
      ))}
    </>
  )
}

export default function PerformanceReviewsPage() {
  const router = useRouter()
  const [items, setItems] = useState<PerformanceReview[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await PerformanceReviewsApi.list({ q })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error fetching reviews:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <>
      <ListPageHeader
        title="Performance Reviews"
        description="Track employee performance evaluations"
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        action={
          <Button href="/performance/reviews/add" icon={<PlusIcon className="h-4 w-4" />}>
            New Review
          </Button>
        }
      />

      <div className="space-y-6">
        <Card padding="md">
          <SearchForm
            value={q}
            onChange={setQ}
            onSubmit={load}
            placeholder="Search by employee name or reviewer..."
          />
        </Card>

        <ResultsCount
          count={items.length}
          singular="review"
          plural="reviews"
          loading={loading}
        />

        <Table>
          <TableHeader>
            <TableHead>Employee</TableHead>
            <TableHead>Review Type</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Deadline</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowSkeleton />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={7}
                icon={<ClipboardDocumentCheckIcon className="h-10 w-10" />}
                title="No reviews found"
              />
            ) : (
              items.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(`/performance/reviews/${r.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">
                        {r.employee?.firstName} {r.employee?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{r.employee?.department}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {REVIEW_TYPE_LABELS[r.reviewType] || r.reviewType}
                  </TableCell>
                  <TableCell className="text-gray-600">{r.reviewPeriod}</TableCell>
                  <TableCell className="text-gray-500">{formatDate(r.reviewDate)}</TableCell>
                  <TableCell>
                    <RatingStars rating={r.overallRating} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={STATUS_LABELS[r.status] || r.status} />
                  </TableCell>
                  <TableCell>
                    <DeadlineBadge review={r} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
