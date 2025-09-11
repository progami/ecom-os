import { Skeleton } from '@/components/ui/skeleton'

interface PageSkeletonProps {
  variant?: 'table' | 'cards' | 'form' | 'chart'
  rows?: number
}

export function PageSkeleton({ variant = 'table', rows = 5 }: PageSkeletonProps) {
  if (variant === 'cards') {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 border rounded-lg">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'chart') {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1">
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  // Default table variant
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" /> {/* Table header */}
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}