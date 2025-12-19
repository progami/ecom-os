'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { TenantConfig, TenantCode, TENANTS } from '@/lib/tenant/constants'
import { Globe } from '@/lib/lucide-icons'

interface TenantIndicatorProps {
  className?: string
  collapsed?: boolean
}

/**
 * Display-only indicator showing current region.
 * Region switching is only allowed from the WorldMap (landing page).
 */
export function TenantIndicator({ className, collapsed }: TenantIndicatorProps) {
  const [current, setCurrent] = useState<TenantConfig | null>(null)

  useEffect(() => {
    // Fetch current tenant on mount
    fetch('/api/tenant/current')
      .then((res) => res.json())
      .then((data) => {
        if (data.current?.code) {
          setCurrent(TENANTS[data.current.code as TenantCode])
        }
      })
      .catch(console.error)
  }, [])

  if (!current) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 text-slate-400', className)}>
        <Globe className="h-4 w-4 animate-pulse" />
        {!collapsed && <span className="text-sm">Loading...</span>}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', className)}>
      <span className="text-lg">{current.flag}</span>
      {!collapsed && (
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-slate-900">{current.displayName}</span>
          <span className="text-xs text-slate-500">{current.timezone}</span>
        </div>
      )}
    </div>
  )
}
