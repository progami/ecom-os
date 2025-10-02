import { Loader2 } from '@/lib/lucide-icons'

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
  className?: string
}

export function LoadingState({
  message = 'Loading...',
  size = 'md',
  fullScreen = false,
  className = ''
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <Loader2 className={`animate-spin text-cyan-600 ${sizeClasses[size]}`} />
      {message && (
        <p className="text-sm text-slate-600">{message}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return content
}

interface LoadingOverlayProps {
  loading: boolean
  children: React.ReactNode
  message?: string
}

export function LoadingOverlay({
  loading,
  children,
  message = 'Loading...'
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
          <LoadingState message={message} />
        </div>
      )}
    </div>
  )
}

interface SkeletonProps {
  className?: string
  animate?: boolean
}

export function Skeleton({ 
  className = '', 
  animate = true 
}: SkeletonProps) {
  return (
    <div 
      className={`
        bg-slate-200 rounded
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `}
    />
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="w-full">
      <div className="bg-slate-50 p-4 border-b">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="p-4 border-b">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={colIndex} 
                className={`h-4 ${colIndex === 0 ? 'w-32' : 'w-20'}`} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}