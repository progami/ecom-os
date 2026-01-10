'use client'

import Link from 'next/link'
import type { PerformanceReview } from '@/lib/api-client'
import { ChevronRightIcon, ClipboardDocumentCheckIcon, StarFilledIcon } from '@/components/ui/Icons'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDate, getReviewStatusConfig } from '../utils'

export function EmployeePerformanceTab({
  reviews,
  loading,
}: {
  reviews: PerformanceReview[]
  loading: boolean
}) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Performance Reviews</h2>
        {reviews.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8">
          <ClipboardDocumentCheckIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No performance reviews yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const statusConfig = getReviewStatusConfig(review.status)
            const avgRating = review.overallRating || 0

            return (
              <Link key={review.id} href={`/performance/reviews/${review.id}`} className="block group">
                <div className="rounded-lg border border-border bg-card p-4 hover:border-input hover:bg-muted/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-foreground">{review.reviewPeriod}</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                            statusConfig.bgClass,
                            statusConfig.textClass
                          )}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>Reviewer: {review.reviewerName || '—'}</span>
                        <span>•</span>
                        <span>{formatDate(review.reviewDate)}</span>
                      </div>
                      {avgRating > 0 ? (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums">
                          <StarFilledIcon className="h-3.5 w-3.5 text-warning" />
                          <span>{avgRating}/10</span>
                        </div>
                      ) : null}
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

