'use client'

export function CardSkeleton() {
  return (
    <div className="dashboard-card p-6 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-muted rounded w-2/3 mb-2"></div>
      <div className="h-4 bg-muted rounded w-1/4"></div>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="h-4 bg-muted rounded w-3/4"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-muted rounded w-1/2"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-muted rounded w-2/3"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-6 bg-muted rounded-full w-20"></div>
      </td>
    </tr>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="dashboard-card p-6">
            <div className="h-4 bg-muted rounded w-24 mb-3"></div>
            <div className="h-8 bg-muted rounded w-16 mb-2"></div>
            <div className="h-3 bg-muted rounded w-20"></div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 dashboard-card p-6">
          <div className="h-5 bg-muted rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-card p-6">
          <div className="h-5 bg-muted rounded w-28 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-border">
                <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="dashboard-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3">
                <div className="h-3 bg-muted rounded w-20"></div>
              </th>
              <th className="text-left px-4 py-3">
                <div className="h-3 bg-muted rounded w-24"></div>
              </th>
              <th className="text-left px-4 py-3">
                <div className="h-3 bg-muted rounded w-16"></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...Array(rows)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-4">
                  <div className="h-4 bg-muted rounded w-32"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-muted rounded w-24"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-6 bg-muted rounded-full w-16"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  }

  return (
    <div
      className={`animate-spin rounded-full border-accent border-t-transparent ${sizeClasses[size]} ${className}`}
    />
  )
}

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-lg p-6 shadow-soft-lg flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-foreground font-medium">{message}</p>
      </div>
    </div>
  )
}

export function FullPageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
