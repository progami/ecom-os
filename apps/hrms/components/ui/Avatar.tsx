'use client'

import { useState } from 'react'

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

  // Get initials from alt text
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
        className={`${sizeClass} rounded-full object-cover ${className}`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-blue-100 flex items-center justify-center font-medium text-blue-700 ${className}`}
    >
      {initials || '?'}
    </div>
  )
}
