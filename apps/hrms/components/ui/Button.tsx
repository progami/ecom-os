import Link from 'next/link'
import { SpinnerIcon } from './Icons'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  href?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  className?: string
  icon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  icon,
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`

  const content = (
    <>
      {loading ? (
        <SpinnerIcon className="h-4 w-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </>
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={combinedClassName}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={combinedClassName}
    >
      {content}
    </button>
  )
}

// Icon button for actions like back, edit, delete
type IconButtonProps = {
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  label: string
  variant?: 'default' | 'ghost'
  size?: 'sm' | 'md'
  className?: string
}

export function IconButton({
  icon,
  onClick,
  href,
  label,
  variant = 'default',
  size = 'md',
  className = '',
}: IconButtonProps) {
  const sizeClasses = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const variantClasses = variant === 'ghost'
    ? 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
    : 'border border-gray-300 hover:bg-gray-50 text-gray-600'

  const baseClasses = `flex items-center justify-center rounded-lg transition-colors ${sizeClasses} ${variantClasses} ${className}`

  if (href) {
    return (
      <Link href={href} className={baseClasses} aria-label={label}>
        {icon}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={baseClasses} aria-label={label}>
      {icon}
    </button>
  )
}
