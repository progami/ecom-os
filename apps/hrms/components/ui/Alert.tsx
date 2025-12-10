import { CheckCircleIcon, ExclamationCircleIcon, XIcon } from './Icons'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

type AlertProps = {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  onDismiss?: () => void
  className?: string
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: 'text-green-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: 'text-yellow-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-500',
  },
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
  const styles = variantStyles[variant]

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-lg p-4 ${className}`}>
      <div className="flex gap-3">
        <div className={styles.icon}>
          {variantIcons[variant]}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`text-sm font-medium ${styles.text} mb-1`}>{title}</h3>
          )}
          <div className={`text-sm ${styles.text}`}>{children}</div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${styles.text} hover:opacity-70 transition-opacity`}
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
