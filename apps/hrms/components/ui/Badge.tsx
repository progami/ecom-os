type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default'

type BadgeProps = {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  default: 'bg-slate-100 text-slate-600',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}

// Helper to get variant from status string
export function getStatusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'published' || s === 'approved') return 'success'
  if (s === 'draft' || s === 'pending' || s === 'review') return 'warning'
  if (s === 'archived' || s === 'inactive' || s === 'suspended') return 'default'
  if (s === 'rejected' || s === 'error' || s === 'failed') return 'error'
  return 'info'
}

// Convenience component for status badges
type StatusBadgeProps = {
  status: string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <Badge variant={getStatusVariant(status)} className={className}>
      {status}
    </Badge>
  )
}
