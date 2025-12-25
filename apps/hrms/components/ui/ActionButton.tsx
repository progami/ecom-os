'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { LockClosedIcon } from '@/components/ui/Icons'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ActionButtonProps = {
  label: string
  onClick?: () => void | Promise<void>
  href?: string
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  disabledReason?: string
  loading?: boolean
  icon?: React.ReactNode
  className?: string
}

export function ActionButton({
  label,
  onClick,
  href,
  variant = 'primary',
  size = 'md',
  disabled = false,
  disabledReason,
  loading = false,
  icon,
  className,
}: ActionButtonProps) {
  const showReason = disabled && Boolean(disabledReason)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    if (disabled && !disabledReason) {
      // eslint-disable-next-line no-console
      console.warn(`[ActionButton] disabledReason missing for "${label}"`)
    }
  }, [disabled, disabledReason, label])

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        href={href}
        disabled={disabled}
        loading={loading}
        onClick={onClick ? () => void onClick() : undefined}
        icon={icon}
        className={className}
      >
        {label}
      </Button>
      {showReason ? (
        <div className="flex items-start gap-1.5 text-xs text-gray-600">
          <LockClosedIcon className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
          <span>{disabledReason}</span>
        </div>
      ) : null}
    </div>
  )
}

