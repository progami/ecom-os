'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type AvatarProps = {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
}

export function Avatar({ src, alt = '', size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = sizeClasses[size]

  const initials = alt
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(sizeClass, 'rounded-full object-cover ring-2 ring-white shadow-sm', className)}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className={cn(
        sizeClass,
        'rounded-full bg-gradient-to-br from-[hsl(var(--accent))]/20 to-[hsl(var(--accent))]/5 flex items-center justify-center font-semibold text-[hsl(var(--accent))] ring-2 ring-white shadow-sm',
        className
      )}
    >
      {initials || '?'}
    </div>
  )
}
