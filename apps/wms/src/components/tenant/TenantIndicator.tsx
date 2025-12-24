'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { TenantConfig, TenantCode, TENANTS } from '@/lib/tenant/constants'
import { Globe, MapPin, LogOut } from '@/lib/lucide-icons'

interface TenantIndicatorProps {
  className?: string
  collapsed?: boolean
}

// Format timezone to readable city name
function formatTimezone(timezone: string): string {
  // Extract city from timezone (e.g., "America/Los_Angeles" -> "Los Angeles")
  const parts = timezone.split('/')
  const city = parts[parts.length - 1].replace(/_/g, ' ')
  return city
}

/**
 * Display-only indicator showing current region.
 * Region switching is only allowed from the WorldMap (landing page).
 */
export function TenantIndicator({ className, collapsed }: TenantIndicatorProps) {
  const [current, setCurrent] = useState<TenantConfig | null>(null)
  const router = useRouter()

  const handleLogout = () => {
    router.push('/')
  }

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
      <div className={cn('flex items-center gap-3 px-3 py-2.5 text-slate-400', className)}>
        <Globe className="h-5 w-5 animate-pulse" />
        {!collapsed && <span className="text-sm">Loading...</span>}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 transition-colors hover:bg-slate-100/50'
        )}
      >
        <span className="text-xl">{current.flag}</span>
        {!collapsed && (
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-semibold text-slate-900">{current.name}</span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{formatTimezone(current.timezone)}</span>
            </span>
          </div>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-slate-500 transition-colors hover:bg-slate-100/50 hover:text-slate-700"
        title="Switch Region"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  )
}
