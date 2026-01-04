import { CheckCircleIcon, ExclamationCircleIcon, XIcon } from './Icons'
import { cn } from '@/lib/utils'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

type AlertProps = {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  onDismiss?: () => void
  className?: string
}

const variantStyles: Record<AlertVariant, string> = {
  success: 'bg-success-50 border-success-200 text-success-800',
  error: 'bg-danger-50 border-danger-200 text-danger-800',
  warning: 'bg-warning-50 border-warning-200 text-warning-800',
  info: 'bg-brand-navy-50 border-brand-navy-200 text-brand-navy-800',
}

const iconStyles: Record<AlertVariant, string> = {
  success: 'text-success-600',
  error: 'text-danger-600',
  warning: 'text-warning-600',
  info: 'text-brand-navy-600',
}

const variantIcons: Record<AlertVariant, React.ReactNode> = {
  success: <CheckCircleIcon className="h-5 w-5" />,
  error: <ExclamationCircleIcon className="h-5 w-5" />,
  warning: <ExclamationCircleIcon className="h-5 w-5" />,
  info: <ExclamationCircleIcon className="h-5 w-5" />,
}

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  className = '',
}: AlertProps) {
  return (
    <div className={cn('border rounded-lg p-4', variantStyles[variant], className)}>
      <div className="flex gap-3">
        <div className={iconStyles[variant]}>
          {variantIcons[variant]}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-sm font-medium mb-1">{title}</h3>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="hover:opacity-70 transition-opacity"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
