'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PerformanceReviewsApi, type PerformanceReview } from '@/lib/api-client'
import { ClipboardDocumentCheckIcon, PlusIcon, StarFilledIcon } from '@/components/ui/Icons'
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
          className={`h-4 w-4 ${star <= rating ? 'text-amber-400' : 'text-slate-200'}`}
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
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-32" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
          <td className="px-4 py-4"><div className="h-5 bg-slate-200 rounded w-20" /></td>
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
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowSkeleton />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={6}
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
                      <p className="font-medium text-slate-900">
                        {r.employee?.firstName} {r.employee?.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{r.employee?.department}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {REVIEW_TYPE_LABELS[r.reviewType] || r.reviewType}
                  </TableCell>
                  <TableCell className="text-slate-600">{r.reviewPeriod}</TableCell>
                  <TableCell className="text-slate-500">{formatDate(r.reviewDate)}</TableCell>
                  <TableCell>
                    <RatingStars rating={r.overallRating} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={STATUS_LABELS[r.status] || r.status} />
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
