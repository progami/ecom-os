'use client'

import { useState, useEffect } from 'react'

type Standing = 'GREEN' | 'YELLOW' | 'RED'

type StandingData = {
  standing: Standing
  reason: string
  blocksPromotion: boolean
  suggestedAction?: string
}

const STANDING_STYLES: Record<Standing, { bg: string; text: string; dot: string; label: string }> = {
  GREEN: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    dot: 'bg-success-500',
    label: 'Role Model',
  },
  YELLOW: {
    bg: 'bg-warning-50',
    text: 'text-warning-700',
    dot: 'bg-warning-400',
    label: 'Coaching',
  },
  RED: {
    bg: 'bg-danger-50',
    text: 'text-danger-700',
    dot: 'bg-danger-500',
    label: 'At Risk',
  },
}

type StandingBadgeProps = {
  employeeId: string
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function StandingBadge({ employeeId, size = 'sm', showLabel = false }: StandingBadgeProps) {
  const [data, setData] = useState<StandingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStanding() {
      try {
        const response = await fetch(`/api/standing?employeeId=${employeeId}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch {
        // Silently fail - badge just won't show
      } finally {
        setLoading(false)
      }
    }
    fetchStanding()
  }, [employeeId])

  if (loading || !data) {
    return null
  }

  const styles = STANDING_STYLES[data.standing]
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${styles.bg} ${styles.text} ${sizeClasses}`}
      title={data.reason}
    >
      <span className={`${dotSize} rounded-full ${styles.dot}`} />
      {showLabel && styles.label}
    </span>
  )
}

type StandingIndicatorProps = {
  standing: Standing
  reason?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StandingIndicator({ standing, reason, showLabel = true, size = 'md' }: StandingIndicatorProps) {
  const styles = STANDING_STYLES[standing]

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  }

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${styles.bg} ${styles.text} ${sizeClasses[size]}`}
      title={reason}
    >
      <span className={`${dotSizes[size]} rounded-full ${styles.dot}`} />
      {showLabel && styles.label}
    </span>
  )
}
