import * as React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md' | 'lg'
  trend?: {
    value: number
    label?: string
  }
  className?: string
  onClick?: () => void
}

const variantStyles = {
  default: {
    container: '',
    icon: 'text-gray-400',
    value: 'text-gray-900',
    border: ''
  },
  success: {
    container: 'bg-green-50',
    icon: 'text-green-600',
    value: 'text-green-600',
    border: 'border-green-200'
  },
  warning: {
    container: 'bg-orange-50',
    icon: 'text-orange-600',
    value: 'text-orange-600',
    border: 'border-orange-400'
  },
  danger: {
    container: 'bg-red-50',
    icon: 'text-red-600',
    value: 'text-red-600',
    border: 'border-red-400'
  },
  info: {
    container: 'bg-cyan-50',
    icon: 'text-cyan-600',
    value: 'text-cyan-600',
    border: 'border-cyan-400'
  }
}

const sizeStyles = {
  sm: {
    padding: 'p-2',
    titleSize: 'text-xs',
    valueSize: 'text-lg',
    subtitleSize: 'text-xs',
    iconSize: 'h-4 w-4'
  },
  md: {
    padding: 'p-4',
    titleSize: 'text-sm',
    valueSize: 'text-2xl',
    subtitleSize: 'text-xs',
    iconSize: 'h-6 w-6'
  },
  lg: {
    padding: 'p-6',
    titleSize: 'text-base',
    valueSize: 'text-3xl',
    subtitleSize: 'text-sm',
    iconSize: 'h-8 w-8'
  }
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  size = 'md',
  trend,
  className,
  onClick
}: StatsCardProps) {
  const styles = variantStyles[variant]
  const sizes = sizeStyles[size]
  
  return (
    <div
      className={cn(
        'border rounded-lg transition-all',
        sizes.padding,
        styles.container,
        styles.border,
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn('text-muted-foreground', sizes.titleSize)}>{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={cn('font-bold', sizes.valueSize, styles.value)}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className={cn('text-gray-500', sizes.subtitleSize)}>{subtitle}</p>
            )}
          </div>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={cn(
                'text-xs font-medium',
                trend.value >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-xs text-gray-500">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <Icon className={cn(sizes.iconSize, styles.icon)} />
        )}
      </div>
    </div>
  )
}

// Grid component for consistent card layouts
export function StatsCardGrid({
  children,
  cols = 4,
  gap = 'gap-4',
  className
}: {
  children: React.ReactNode
  cols?: 2 | 3 | 4 | 5 | 6
  gap?: 'gap-1' | 'gap-2' | 'gap-4'
  className?: string
}) {
  const colsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3', 
    4: 'md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
  }[cols]
  
  return (
    <div className={cn('grid', gap, colsClass, className)}>
      {children}
    </div>
  )
}