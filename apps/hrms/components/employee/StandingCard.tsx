'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { SpinnerIcon, ExclamationCircleIcon, CheckCircleIcon } from '@/components/ui/Icons'

type Standing = 'GREEN' | 'YELLOW' | 'RED'

type StandingData = {
  standing: Standing
  reason: string
  blocksPromotion: boolean
  suggestedAction?: 'TRAINING' | 'PIP' | 'TERMINATION_REVIEW'
}

const STANDING_CONFIG: Record<Standing, {
  bg: string
  border: string
  text: string
  title: string
  icon: typeof CheckCircleIcon
  iconColor: string
}> = {
  GREEN: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    title: 'Role Model',
    icon: CheckCircleIcon,
    iconColor: 'text-emerald-500',
  },
  YELLOW: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    title: 'Needs Coaching',
    icon: ExclamationCircleIcon,
    iconColor: 'text-amber-500',
  },
  RED: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    title: 'At Risk',
    icon: ExclamationCircleIcon,
    iconColor: 'text-red-500',
  },
}

const ACTION_LABELS: Record<string, string> = {
  TRAINING: 'Training Recommended',
  PIP: 'Performance Improvement Plan',
  TERMINATION_REVIEW: 'Termination Review',
}

type StandingCardProps = {
  employeeId: string
}

export function StandingCard({ employeeId }: StandingCardProps) {
  const [data, setData] = useState<StandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStanding() {
      try {
        setLoading(true)
        const response = await fetch(`/api/standing?employeeId=${employeeId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch standing')
        }
        const result = await response.json()
        setData(result)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load standing'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    fetchStanding()
  }, [employeeId])

  if (loading) {
    return (
      <Card padding="lg">
        <div className="flex items-center justify-center h-24">
          <SpinnerIcon className="h-6 w-6 animate-spin text-cyan-600" />
        </div>
      </Card>
    )
  }

  if (error || !data) {
    return null
  }

  const config = STANDING_CONFIG[data.standing]
  const Icon = config.icon

  return (
    <Card padding="lg" className={`${config.bg} ${config.border} border`}>
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-full ${config.bg}`}>
          <Icon className={`h-6 w-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold ${config.text}`}>{config.title}</h3>
            {data.blocksPromotion && (
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                Blocks Promotion
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mb-2">{data.reason}</p>
          {data.suggestedAction && (
            <p className="text-xs font-medium text-slate-500">
              Suggested Action: {ACTION_LABELS[data.suggestedAction] || data.suggestedAction}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
