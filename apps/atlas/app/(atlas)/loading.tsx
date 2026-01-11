export default function Loading() {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Header skeleton */}
      <header className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* Icon placeholder */}
            <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-2">
              {/* Title placeholder */}
              <div className="h-7 w-40 bg-muted rounded-md animate-pulse" />
              {/* Description placeholder */}
              <div className="h-4 w-64 bg-muted/70 rounded-md animate-pulse" />
            </div>
          </div>
          {/* Action button placeholder */}
          <div className="h-10 w-32 bg-muted rounded-lg animate-pulse hidden sm:block" />
        </div>
      </header>

      {/* Content skeleton */}
      <div className="space-y-6">
        {/* Results count skeleton */}
        <div className="h-5 w-28 bg-muted/60 rounded animate-pulse" />

        {/* Table skeleton */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex gap-4">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse hidden sm:block" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse hidden md:block" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse hidden lg:block" />
            </div>
          </div>

          {/* Table rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-4 border-b border-border last:border-0"
            >
              {/* Avatar */}
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse flex-shrink-0" />
              {/* Name and details */}
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 bg-muted rounded animate-pulse" />
                <div className="h-3 w-48 bg-muted/60 rounded animate-pulse" />
              </div>
              {/* Additional columns */}
              <div className="h-4 w-24 bg-muted/70 rounded animate-pulse hidden sm:block" />
              <div className="h-4 w-20 bg-muted/70 rounded animate-pulse hidden md:block" />
              <div className="h-6 w-16 bg-muted rounded-full animate-pulse hidden lg:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
