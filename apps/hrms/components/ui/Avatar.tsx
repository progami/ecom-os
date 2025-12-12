'use client'

type AvatarProps = {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({ src, alt = '', size = 'md', className = '' }: AvatarProps) {
  const sizeClass = sizeClasses[size]

  // Get initials from alt text
  const initials = alt
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-600 ${className}`}
    >
      {initials || '?'}
    </div>
  )
}
