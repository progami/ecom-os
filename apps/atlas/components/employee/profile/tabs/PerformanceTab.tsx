'use client'

import Link from 'next/link'
import type { PerformanceReview } from '@/lib/api-client'
import { ChevronRightIcon, ClipboardDocumentCheckIcon, StarFilledIcon } from '@/components/ui/Icons'
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Performance Reviews</h2>
        <p className="text-sm text-muted-foreground">
          {reviews.length > 0
            ? `${reviews.length} review${reviews.length !== 1 ? 's' : ''} on file`
            : 'Track performance evaluations and feedback'}
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <ClipboardDocumentCheckIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No performance reviews yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Reviews will appear here once submitted
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />

          <div className="space-y-3">
            {reviews.map((review) => {
              const statusConfig = getReviewStatusConfig(review.status)
              const avgRating = review.overallRating ?? 0

              return (
                <Link key={review.id} href={`/performance/reviews/${review.id}`} className="block group relative">
                  <div className="flex gap-4 pl-10">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        'absolute left-2 top-5 h-3 w-3 rounded-full border-2 bg-card z-10',
                        review.status === 'COMPLETED'
                          ? 'border-brand-teal-500'
                          : review.status === 'PENDING_SELF_REVIEW' || review.status === 'PENDING_MANAGER_REVIEW'
                            ? 'border-warning-500'
                            : review.status === 'DRAFT'
                              ? 'border-muted-foreground/50'
                              : 'border-brand-navy-500'
                      )}
                    />

                    {/* Card */}
                    <div className="flex-1 rounded-xl border border-border bg-card p-4 hover:border-brand-teal-500/30 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
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
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>Reviewer: {review.reviewerName ?? '—'}</span>
                            <span className="text-muted-foreground/50">•</span>
                            <span>{formatDate(review.reviewDate)}</span>
                          </div>
                          {avgRating > 0 ? (
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                              <StarFilledIcon className="h-3.5 w-3.5 text-warning" />
                              <span className="tabular-nums">{avgRating}/10</span>
                            </div>
                          ) : null}
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
