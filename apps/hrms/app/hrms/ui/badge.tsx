import * as React from 'react'

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  const base = 'badge'
  const map: Record<Tone, string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    neutral: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }
  return <span className={`${base} ${map[tone]}`}>{children}</span>
}

