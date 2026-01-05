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
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-[hsl(var(--primary))]/5 border-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]',
}

const iconStyles: Record<AlertVariant, string> = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-[hsl(var(--primary))]',
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
    <div className={cn('border rounded-xl p-4', variantStyles[variant], className)}>
      <div className="flex gap-3">
        <div className={iconStyles[variant]}>
          {variantIcons[variant]}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-sm font-semibold mb-1">{title}</h3>
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
