'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-primary border-t-transparent',
        sizeStyles[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

// Full-page loading state wrapper
export interface PageLoadingProps {
  size?: 'sm' | 'md' | 'lg'
}

export function PageLoading({ size = 'md' }: PageLoadingProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner size={size} />
    </div>
  )
}

// Inline loading state for content areas
export interface ContentLoadingProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ContentLoading({ size = 'md', className }: ContentLoadingProps) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <LoadingSpinner size={size} />
    </div>
  )
}
